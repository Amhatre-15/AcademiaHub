import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { sessionManager } from '../../websocket/SessionManager';
import { AuditAction } from '@prisma/client';
import { deriveCheckpointSecret, determineAttendanceStatus, generateAttendanceCode as genCode } from '../../utils/attendance';

// Start a session
export const startSession = async (req: Request, res: Response) => {
  try {
    const { timetableEntryId } = req.body;
    const facultyId = req.user!.facultyId;

    if (!facultyId) {
      return res.status(403).json({ error: 'Only faculty can start a session' });
    }

    const timetableEntry = await prisma.timetableEntry.findUnique({
      where: { id: timetableEntryId },
      include: { class: true, timeSlot: true }
    });

    if (!timetableEntry || timetableEntry.facultyId !== facultyId) {
      return res.status(404).json({ error: 'Timetable entry not found or not assigned to you' });
    }

    // Check if there is already an active session for this faculty
    const existingActive = await prisma.classSession.findFirst({
      where: {
        facultyId,
        status: 'ACTIVE',
      }
    });

    if (existingActive) {
      return res.status(400).json({ error: 'You already have an active session' });
    }

    // Create session
    const session = await prisma.classSession.create({
      data: {
        timetableEntryId: timetableEntry.id,
        facultyId,
        subjectId: timetableEntry.subjectId,
        classId: timetableEntry.classId,
        divisionId: timetableEntry.divisionId,
        batchId: timetableEntry.batchId,
        date: new Date(),
        scheduledStart: timetableEntry.timeSlot.startTime,
        scheduledEnd: timetableEntry.timeSlot.endTime,
        actualStart: new Date(),
        status: 'ACTIVE'
      },
      include: {
        subject: true,
        class: true
      }
    });

    // Notify connected clients that a session has started for this class
    // We could broadcast to a "class_<classId>" room if students are waiting there
    // Or just let students poll/connect when they see it's active.

    return res.status(201).json(session);
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
};

// Get current active session
export const getActiveSession = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;

    const session = await prisma.classSession.findFirst({
      where: {
        facultyId,
        status: 'ACTIVE',
      },
      include: {
        subject: true,
        class: true,
        attendanceCheckpoints: {
          where: { isActive: true }
        }
      }
    });

    if (!session) {
      return res.status(200).json(null); // No active session
    }

    const sessionWithSecrets = {
      ...session,
      serverTime: Date.now(),
      attendanceCheckpoints: session.attendanceCheckpoints.map(cp => ({
        ...cp,
        qrSecret: deriveCheckpointSecret(cp),
        serverTime: Date.now()
      }))
    };

    return res.json(sessionWithSecrets);
  } catch (error) {
    console.error('Error fetching active session:', error);
    res.status(500).json({ error: 'Failed to fetch active session' });
  }
};

// End a session
export const endSession = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const facultyId = req.user!.facultyId;

    if (!facultyId) {
      return res.status(403).json({ error: 'Faculty profile not found' });
    }

    const session = await prisma.classSession.findFirst({
      where: { id, facultyId, status: 'ACTIVE' }
    });

    if (!session) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    // End active checkpoints
    await prisma.attendanceCheckpoint.updateMany({
      where: { sessionId: id, isActive: true },
      data: { isActive: false, closedAt: new Date() }
    });

    // Close session
    const closedSession = await prisma.classSession.update({
      where: { id },
      data: {
        status: 'CLOSED',
        actualEnd: new Date()
      }
    });

    // Calculate final attendance for all enrolled students (background, fire-and-forget)
    calculateFinalAttendance(id);


    // Notify via WS
    sessionManager.broadcastToSession(id, {
      type: 'SESSION_ENDED',
      sessionId: id
    });

    return res.json(closedSession);
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
};

// Generate Attendance Code
export const generateAttendanceCode = async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { checkpointType, durationSeconds } = req.body;
    const facultyId = req.user!.facultyId;

    if (!facultyId) {
      return res.status(403).json({ error: 'Faculty profile not found' });
    }

    if (!['START', 'END'].includes(checkpointType)) {
      return res.status(400).json({ error: 'Invalid checkpoint type' });
    }

    const session = await prisma.classSession.findFirst({
      where: { id: sessionId, facultyId, status: 'ACTIVE' }
    });

    if (!session) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    // Check if this type of checkpoint already exists for this session
    const existing = await prisma.attendanceCheckpoint.findFirst({
      where: { sessionId, checkpointType }
    });

    if (existing) {
      return res.status(400).json({ error: `${checkpointType} checkpoint already generated` });
    }

    // End any currently active checkpoint
    await prisma.attendanceCheckpoint.updateMany({
      where: { sessionId, isActive: true },
      data: { isActive: false, closedAt: new Date() }
    });

    // Use the authoritative unambiguous character-set code generator (no I/O/0/1 confusion)
    const code = genCode();
    
    // Default 60 seconds if not provided
    const duration = durationSeconds ? parseInt(durationSeconds) : 60;
    const expiresAt = new Date(Date.now() + duration * 1000);

    const checkpoint = await prisma.attendanceCheckpoint.create({
      data: {
        sessionId,
        checkpointType,
        code,
        expiresAt,
        isActive: true
      }
    });

    // Broadcast to students in the session that a code is active
    sessionManager.broadcastToSession(sessionId, {
      type: 'ATTENDANCE_CHECKPOINT_STARTED',
      checkpointId: checkpoint.id,
      checkpointType: checkpoint.checkpointType,
      expiresAt: checkpoint.expiresAt.toISOString()
    });

    // Automatically deactivate when expired
    setTimeout(async () => {
      await prisma.attendanceCheckpoint.updateMany({
        where: { id: checkpoint.id, isActive: true },
        data: { isActive: false, closedAt: new Date() }
      });
      sessionManager.broadcastToSession(sessionId, {
        type: 'ATTENDANCE_CHECKPOINT_ENDED',
        checkpointId: checkpoint.id
      });
    }, duration * 1000);

    return res.status(201).json({
      ...checkpoint,
      qrSecret: deriveCheckpointSecret(checkpoint),
      serverTime: Date.now()
    });
  } catch (error) {
    console.error('Error generating attendance code:', error);
    res.status(500).json({ error: 'Failed to generate code' });
  }
};

const overrideSchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(['PRESENT', 'PARTIAL', 'LATE', 'ABSENT', 'EXCUSED']),
  reason: z.string().optional()
});

export const overrideAttendance = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    const userId = req.user!.userId;
    const sessionId = req.params.sessionId as string;

    if (!facultyId) return res.status(403).json({ error: 'Not faculty' });

    const parsed = overrideSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    
    const { studentId, status, reason } = parsed.data;

    // Verify session ownership
    const session = await prisma.classSession.findFirst({
      where: { id: sessionId, facultyId }
    });
    if (!session) return res.status(404).json({ error: 'Session not found or unauthorized' });

    // Verify student is enrolled in this class
    const isEnrolled = await prisma.enrollment.findFirst({
      where: { studentId, classId: session.classId, status: 'ACTIVE' }
    });
    if (!isEnrolled) return res.status(400).json({ error: 'Student is not enrolled in this class' });

    // Fetch existing to log beforeData
    const existing = await prisma.attendanceRecord.findUnique({
      where: { sessionId_studentId: { sessionId, studentId } }
    });

    const updated = await prisma.attendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId, studentId } },
      create: {
        sessionId,
        studentId,
        automatedStatus: 'ABSENT',
        finalStatus: status,
        overrideReason: reason,
        overriddenBy: userId,
        overriddenAt: new Date()
      },
      update: {
        finalStatus: status,
        overrideReason: reason,
        overriddenBy: userId,
        overriddenAt: new Date()
      }
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.ATTENDANCE_OVERRIDE,
        entityType: 'attendance_records',
        entityId: updated.id,
        beforeData: existing ? existing : {},
        afterData: updated,
        reason: reason || 'Manual attendance override by faculty',
        ipAddress: req.ip
      }
    });

    return res.json({ attendance: updated });
  } catch (error) {
    console.error('Error overriding attendance:', error);
    res.status(500).json({ error: 'Failed to override attendance' });
  }
};


// Function to calculate final attendance (Background process)
export async function calculateFinalAttendance(sessionId: string) {
  try {
    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: {
        attendanceCheckpoints: {
          include: { submissions: true }
        }
      }
    });

    if (!session) return;

    // Get all enrolled students for this session's class/batch
    const enrollments = await prisma.enrollment.findMany({
      where: {
        classId: session.classId,
        ...(session.divisionId && { divisionId: session.divisionId }),
        ...(session.batchId && { batchId: session.batchId }),
        status: 'ACTIVE'
      }
    });

    const startCheckpoint = session.attendanceCheckpoints.find(c => c.checkpointType === 'START');
    const endCheckpoint = session.attendanceCheckpoints.find(c => c.checkpointType === 'END');

    const startStudentIds = new Set(startCheckpoint?.submissions.map(s => s.studentId) || []);
    const endStudentIds = new Set(endCheckpoint?.submissions.map(s => s.studentId) || []);

    const recordsData = enrollments.map(enrollment => {
      const studentId = enrollment.studentId;
      const hasStart = startStudentIds.has(studentId);
      const hasEnd = endStudentIds.has(studentId);

      const status = determineAttendanceStatus(hasStart, hasEnd);

      const startSub = startCheckpoint?.submissions.find(s => s.studentId === studentId);
      const endSub = endCheckpoint?.submissions.find(s => s.studentId === studentId);

      return {
        sessionId,
        studentId,
        startSubmittedAt: startSub?.submittedAt || null,
        endSubmittedAt: endSub?.submittedAt || null,
        automatedStatus: status,
        finalStatus: status
      };
    });

    if (recordsData.length > 0) {
      await prisma.attendanceRecord.createMany({
        data: recordsData,
        skipDuplicates: true
      });
    }

    console.log(`✅ Calculated attendance for session ${sessionId} (${recordsData.length} students)`);
  } catch (error) {
    console.error('Error calculating final attendance:', error);
  }
}
