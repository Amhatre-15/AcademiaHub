import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { AttendanceStatus } from '@prisma/client';

const overrideSchema = z.object({
  finalStatus: z.nativeEnum(AttendanceStatus),
  reason: z.string().min(1, 'Reason is required').max(500),
});

/**
 * GET /api/faculty/attendance/sessions
 * List this faculty's sessions with per-session attendance summary.
 */
export const getFacultySessions = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) {
      return res.status(403).json({ error: 'Faculty profile not found' });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 20), 50);
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      prisma.classSession.findMany({
        where: { facultyId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          subject: { select: { name: true } },
          class: { select: { name: true } },
          division: { select: { name: true } },
          batch: { select: { name: true } },
          _count: { select: { attendanceRecords: true } },
        },
      }),
      prisma.classSession.count({ where: { facultyId } }),
    ]);

    // Aggregate attendance status counts per session
    const sessionIds = sessions.map(s => s.id);
    const summaryRows = await prisma.attendanceRecord.groupBy({
      by: ['sessionId', 'finalStatus'],
      where: { sessionId: { in: sessionIds } },
      _count: { finalStatus: true },
    });

    const summaryMap = new Map<string, Record<string, number>>();
    for (const row of summaryRows) {
      if (!summaryMap.has(row.sessionId)) summaryMap.set(row.sessionId, {});
      summaryMap.get(row.sessionId)![row.finalStatus] = row._count.finalStatus;
    }

    const result = sessions.map(session => ({
      id: session.id,
      date: session.date,
      status: session.status,
      scheduledStart: session.scheduledStart,
      scheduledEnd: session.scheduledEnd,
      actualStart: session.actualStart,
      actualEnd: session.actualEnd,
      subject: session.subject,
      class: session.class,
      division: session.division,
      batch: session.batch,
      totalRecords: session._count.attendanceRecords,
      attendanceSummary: summaryMap.get(session.id) ?? {},
    }));

    return res.json({
      sessions: result,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching faculty sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
};

/**
 * GET /api/faculty/attendance/sessions/:sessionId
 * Full attendance roster for a session owned by this faculty.
 */
export const getSessionAttendance = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) {
      return res.status(403).json({ error: 'Faculty profile not found' });
    }

    const sessionId = req.params.sessionId as string;

    const session = await prisma.classSession.findFirst({
      where: { id: sessionId, facultyId },
      include: {
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
        batch: { select: { id: true, name: true } },
        attendanceCheckpoints: {
          select: {
            id: true,
            checkpointType: true,
            generatedAt: true,
            expiresAt: true,
            closedAt: true,
            isActive: true,
            _count: { select: { submissions: true } },
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found or not assigned to you' });
    }

    // All enrolled students for the session scope
    const enrollments = await prisma.enrollment.findMany({
      where: {
        classId: session.classId,
        ...(session.divisionId ? { divisionId: session.divisionId } : {}),
        ...(session.batchId ? { batchId: session.batchId } : {}),
        status: 'ACTIVE',
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, prn: true },
        },
      },
      orderBy: [
        { student: { firstName: 'asc' } },
        { student: { lastName: 'asc' } },
      ],
    });

    // Attendance records for this session
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: { sessionId },
      include: { overrider: { select: { username: true } } },
    });

    const recordMap = new Map(attendanceRecords.map(r => [r.studentId, r]));

    const roster = enrollments.map(enrollment => {
      const record = recordMap.get(enrollment.student.id);
      return {
        studentId: enrollment.student.id,
        prn: enrollment.student.prn,
        firstName: enrollment.student.firstName,
        lastName: enrollment.student.lastName,
        attendanceRecord: record
          ? {
              id: record.id,
              automatedStatus: record.automatedStatus,
              finalStatus: record.finalStatus,
              startSubmittedAt: record.startSubmittedAt,
              endSubmittedAt: record.endSubmittedAt,
              overrideReason: record.overrideReason,
              overriddenAt: record.overriddenAt,
              overriddenBy: record.overrider?.username ?? null,
            }
          : null,
      };
    });

    const totals = {
      total: roster.length,
      present: roster.filter(r => r.attendanceRecord?.finalStatus === 'PRESENT').length,
      partial: roster.filter(r => r.attendanceRecord?.finalStatus === 'PARTIAL').length,
      late: roster.filter(r => r.attendanceRecord?.finalStatus === 'LATE').length,
      absent: roster.filter(r => r.attendanceRecord?.finalStatus === 'ABSENT').length,
      excused: roster.filter(r => r.attendanceRecord?.finalStatus === 'EXCUSED').length,
      noRecord: roster.filter(r => !r.attendanceRecord).length,
    };

    return res.json({
      session: {
        id: session.id,
        status: session.status,
        date: session.date,
        scheduledStart: session.scheduledStart,
        scheduledEnd: session.scheduledEnd,
        actualStart: session.actualStart,
        actualEnd: session.actualEnd,
        subject: session.subject,
        class: session.class,
        division: session.division,
        batch: session.batch,
        checkpoints: session.attendanceCheckpoints,
      },
      roster,
      summary: totals,
    });
  } catch (error) {
    console.error('Error fetching session attendance:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};

/**
 * PATCH /api/faculty/attendance/sessions/:sessionId/students/:studentId
 * Override a student's attendance. Upserts AttendanceRecord, writes AuditLog.
 */
export const overrideAttendance = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) {
      return res.status(403).json({ error: 'Faculty profile not found' });
    }

    const sessionId = req.params.sessionId as string;
    const studentId = req.params.studentId as string;

    const parsed = overrideSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const { finalStatus, reason } = parsed.data;

    // Verify session ownership
    const session = await prisma.classSession.findFirst({
      where: { id: sessionId, facultyId },
      select: { id: true, classId: true, divisionId: true, batchId: true },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found or not assigned to you' });
    }

    // Verify student is enrolled in this session's class
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId,
        classId: session.classId,
        ...(session.divisionId ? { divisionId: session.divisionId } : {}),
        ...(session.batchId ? { batchId: session.batchId } : {}),
        status: 'ACTIVE',
      },
    });

    if (!enrollment) {
      return res.status(400).json({ error: 'Student is not enrolled in this class' });
    }

    // Get previous status for audit
    const existing = await prisma.attendanceRecord.findUnique({
      where: { sessionId_studentId: { sessionId, studentId } },
      select: { id: true, finalStatus: true },
    });

    const previousStatus = existing?.finalStatus ?? null;

    // Upsert attendance record
    const record = await prisma.attendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId, studentId } },
      create: {
        sessionId,
        studentId,
        automatedStatus: finalStatus, // If faculty creates from scratch, automated matches final
        finalStatus,
        overrideReason: reason,
        overriddenBy: req.user!.userId,
        overriddenAt: new Date(),
      },
      update: {
        finalStatus,
        overrideReason: reason,
        overriddenBy: req.user!.userId,
        overriddenAt: new Date(),
      },
    });

    // Audit log — beforeData null if no previous record
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'ATTENDANCE_OVERRIDE',
        entityType: 'attendance_record',
        entityId: record.id,
        beforeData: previousStatus ? { finalStatus: previousStatus } : undefined,
        afterData: { finalStatus },
        reason,
        ipAddress: req.ip,
      },
    });

    return res.json({
      success: true,
      record: {
        id: record.id,
        automatedStatus: record.automatedStatus,
        finalStatus: record.finalStatus,
        overrideReason: record.overrideReason,
        overriddenAt: record.overriddenAt,
      },
    });
  } catch (error) {
    console.error('Error overriding attendance:', error);
    res.status(500).json({ error: 'Failed to override attendance' });
  }
};
