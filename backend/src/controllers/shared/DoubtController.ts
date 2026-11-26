import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { sessionManager } from '../../websocket/SessionManager';

const createDoubtSchema = z.object({
  question: z.string().trim().min(3, 'Question must be at least 3 characters').max(1000, 'Question too long'),
  isAnonymous: z.boolean().optional().default(false),
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'ANSWERED', 'DISMISSED']),
});

/**
 * GET /api/shared/sessions/:sessionId/doubts
 * List all live doubts for a classroom session, sorted by upvotes descending.
 */
export const listSessionDoubts = async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const studentId = req.user?.studentId;

    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      select: { id: true, classId: true, facultyId: true },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const doubts = await prisma.classroomDoubt.findMany({
      where: { sessionId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            prn: true,
          },
        },
        _count: {
          select: { upvotes: true },
        },
        upvotes: {
          select: { studentId: true },
        },
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Format response and sanitize anonymity for students
    const isFacultyOrAdmin = req.user?.role === 'FACULTY' || req.user?.role === 'IT_ADMIN';
    const formatted = doubts
      .map((d: any) => {
        const isAuthor = !!(studentId && d.studentId === studentId);
        const authorName = d.isAnonymous && !isFacultyOrAdmin && !isAuthor
          ? 'Anonymous Scholar'
          : `${d.student?.firstName ?? 'Student'} ${d.student?.lastName ?? ''}`.trim();

        const hasUpvoted = !!(studentId && d.upvotes?.some((u: any) => u.studentId === studentId));

        return {
          id: d.id,
          sessionId: d.sessionId,
          question: d.question,
          isAnonymous: d.isAnonymous,
          status: d.status,
          createdAt: d.createdAt,
          authorName,
          authorPrn: (isFacultyOrAdmin || isAuthor) ? d.student?.prn : undefined,
          isAuthor,
          upvotesCount: d._count?.upvotes ?? 0,
          hasUpvoted,
        };
      })
      .sort((a: any, b: any) => {
        // Active/pending first, sorted by upvote count descending
        if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
        if (b.status === 'PENDING' && a.status !== 'PENDING') return 1;
        if (b.upvotesCount !== a.upvotesCount) return b.upvotesCount - a.upvotesCount;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    return res.json({ doubts: formatted });
  } catch (error) {
    console.error('Error fetching session doubts:', error);
    return res.status(500).json({ error: 'Failed to fetch doubts' });
  }
};

/**
 * POST /api/student/sessions/:sessionId/doubts
 * Post a new doubt in the live classroom session queue.
 */
export const createDoubt = async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const studentId = req.user?.studentId;

    if (!studentId) {
      return res.status(403).json({ error: 'Only enrolled students can post doubts' });
    }

    const parsed = createDoubtSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
    }

    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      select: { id: true, classId: true, status: true },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'CLOSED') {
      return res.status(400).json({ error: 'Cannot post doubts to a closed session' });
    }

    // Verify student is enrolled in the session's class
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId,
        classId: session.classId,
        status: 'ACTIVE',
      },
    });

    if (!enrollment) {
      return res.status(403).json({ error: 'You are not enrolled in this session class' });
    }

    const doubt = await prisma.classroomDoubt.create({
      data: {
        sessionId,
        studentId,
        question: parsed.data.question,
        isAnonymous: parsed.data.isAnonymous,
        status: 'PENDING',
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            prn: true,
          },
        },
      },
    });

    const authorName = doubt.isAnonymous
      ? 'Anonymous Scholar'
      : `${doubt.student?.firstName ?? 'Student'} ${doubt.student?.lastName ?? ''}`.trim();

    const broadcastPayload = {
      id: doubt.id,
      sessionId: doubt.sessionId,
      question: doubt.question,
      isAnonymous: doubt.isAnonymous,
      status: doubt.status,
      createdAt: doubt.createdAt,
      authorName,
      upvotesCount: 0,
    };

    // Broadcast live to all connected participants in this classroom session
    sessionManager.broadcastToSession(sessionId, {
      type: 'DOUBT_CREATED',
      doubt: broadcastPayload,
    });

    return res.status(201).json({
      doubt: {
        ...broadcastPayload,
        isAuthor: true,
        hasUpvoted: false,
      },
    });
  } catch (error) {
    console.error('Error creating doubt:', error);
    return res.status(500).json({ error: 'Failed to post doubt' });
  }
};

/**
 * POST /api/student/sessions/:sessionId/doubts/:doubtId/upvote
 * Toggle upvote for a doubt (+1 / Me Too).
 */
export const toggleUpvote = async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const doubtId = req.params.doubtId as string;
    const studentId = req.user?.studentId;

    if (!studentId) {
      return res.status(403).json({ error: 'Only students can upvote doubts' });
    }

    const doubt = await prisma.classroomDoubt.findFirst({
      where: { id: doubtId, sessionId },
    });

    if (!doubt) {
      return res.status(404).json({ error: 'Doubt not found in this session' });
    }

    // Check existing upvote
    const existing = await prisma.doubtUpvote.findUnique({
      where: {
        doubtId_studentId: {
          doubtId,
          studentId,
        },
      },
    });

    let hasUpvoted = false;
    if (existing) {
      await prisma.doubtUpvote.delete({
        where: { id: existing.id },
      });
      hasUpvoted = false;
    } else {
      await prisma.doubtUpvote.create({
        data: {
          doubtId,
          studentId,
        },
      });
      hasUpvoted = true;
    }

    const upvotesCount = await prisma.doubtUpvote.count({
      where: { doubtId },
    });

    // Broadcast upvote update to all students and faculty in the live classroom
    sessionManager.broadcastToSession(sessionId, {
      type: 'DOUBT_UPVOTED',
      doubtId,
      upvotesCount,
    });

    return res.json({ hasUpvoted, upvotesCount });
  } catch (error) {
    console.error('Error toggling upvote:', error);
    return res.status(500).json({ error: 'Failed to toggle upvote' });
  }
};

/**
 * PATCH /api/faculty/sessions/:sessionId/doubts/:doubtId
 * Update doubt status (e.g. ANSWERED, DISMISSED) by session faculty.
 */
export const updateDoubtStatus = async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const doubtId = req.params.doubtId as string;
    const facultyId = req.user?.facultyId;

    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (req.user?.role !== 'IT_ADMIN' && session.facultyId !== facultyId) {
      return res.status(403).json({ error: 'You do not own this session' });
    }

    const updated = await prisma.classroomDoubt.update({
      where: { id: doubtId },
      data: { status: parsed.data.status },
    });

    // Broadcast to room
    sessionManager.broadcastToSession(sessionId, {
      type: 'DOUBT_STATUS_UPDATED',
      doubtId,
      status: updated.status,
    });

    return res.json({ doubt: updated });
  } catch (error) {
    console.error('Error updating doubt status:', error);
    return res.status(500).json({ error: 'Failed to update doubt status' });
  }
};

/**
 * POST /api/faculty/sessions/:sessionId/whiteboard
 * Persist whiteboard state snapshot.
 */
export const saveWhiteboardState = async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const facultyId = req.user?.facultyId;
    const { whiteboardState } = req.body;

    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (req.user?.role !== 'IT_ADMIN' && session.facultyId !== facultyId) {
      return res.status(403).json({ error: 'You do not own this session' });
    }

    await prisma.classSession.update({
      where: { id: sessionId },
      data: { whiteboardState: typeof whiteboardState === 'string' ? whiteboardState : JSON.stringify(whiteboardState) },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error saving whiteboard state:', error);
    return res.status(500).json({ error: 'Failed to save whiteboard state' });
  }
};

/**
 * GET /api/shared/sessions/:sessionId/whiteboard
 * Retrieve current whiteboard state for session.
 */
export const getWhiteboardState = async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      select: { whiteboardState: true },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.json({ whiteboardState: session.whiteboardState || null });
  } catch (error) {
    console.error('Error getting whiteboard state:', error);
    return res.status(500).json({ error: 'Failed to get whiteboard state' });
  }
};
