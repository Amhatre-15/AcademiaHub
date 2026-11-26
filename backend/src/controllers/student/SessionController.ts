import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { EngagementService, XP_TABLE } from '../../services/EngagementService';
import { deriveCheckpointSecret, parseDynamicQrPayload, verifyDynamicQrToken } from '../../utils/attendance';
import { sessionManager } from '../../websocket/SessionManager';

// Get active session for student
export const getActiveSession = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;

    if (!studentId) {
      return res.status(403).json({ error: 'Only students can access this route' });
    }

    // Get active enrollments for this student
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId, status: 'ACTIVE' },
      select: { classId: true, divisionId: true, batchId: true }
    });

    if (enrollments.length === 0) {
      return res.status(200).json(null);
    }

    // Find any ACTIVE session that matches the student's enrollments
    const enrollmentConditions = enrollments.map(e => ({
      classId: e.classId,
      ...(e.divisionId ? { divisionId: e.divisionId } : {}),
      ...(e.batchId ? { batchId: e.batchId } : {})
    }));

    const session = await prisma.classSession.findFirst({
      where: {
        status: 'ACTIVE',
        OR: enrollmentConditions
      },
      include: {
        subject: true,
        faculty: true,
        attendanceCheckpoints: {
          where: { isActive: true },
          select: {
            id: true,
            checkpointType: true,
            expiresAt: true,
            isActive: true,
            // Exclude the actual code and qrSecret so students cannot inspect them
          }
        }
      }
    });

    if (!session) {
      return res.status(200).json(null);
    }

    return res.json(session);
  } catch (error) {
    console.error('Error fetching active student session:', error);
    res.status(500).json({ error: 'Failed to fetch active session' });
  }
};

// Submit attendance code or dynamic QR
export const submitAttendance = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    const sessionId = req.params.sessionId as string;
    const { code, qrPayload } = req.body;

    if (!studentId) {
      return res.status(403).json({ error: 'Only students can submit attendance' });
    }

    if (!code && !qrPayload) {
      return res.status(400).json({ error: 'Attendance code or dynamic QR scan is required' });
    }

    let checkpoint: any;

    // 1. Dynamic QR Code Path
    if (qrPayload) {
      const parsed = parseDynamicQrPayload(qrPayload);
      if (!parsed) {
        return res.status(400).json({ error: 'Invalid QR code format' });
      }

      if (parsed.sid && parsed.sid !== sessionId) {
        return res.status(400).json({ error: 'This QR code belongs to a different session' });
      }

      checkpoint = await prisma.attendanceCheckpoint.findFirst({
        where: {
          id: parsed.cid,
          sessionId,
          isActive: true
        }
      });

      if (!checkpoint) {
        return res.status(404).json({ error: 'No active attendance window for this QR code' });
      }

      if (new Date() > checkpoint.expiresAt) {
        return res.status(400).json({ error: 'This attendance window has expired' });
      }

      const secret = deriveCheckpointSecret(checkpoint);
      const verification = verifyDynamicQrToken(secret, checkpoint.id, parsed.t, parsed.hash, 6);

      if (!verification.valid) {
        return res.status(400).json({ error: verification.reason || 'Invalid or expired dynamic QR token' });
      }
    }
    // 2. Fallback Manual Code Path
    else if (code) {
      checkpoint = await prisma.attendanceCheckpoint.findFirst({
        where: {
          sessionId,
          isActive: true
        }
      });

      if (!checkpoint) {
        return res.status(404).json({ error: 'No active attendance window for this session' });
      }

      if (new Date() > checkpoint.expiresAt) {
        return res.status(400).json({ error: 'This attendance code has expired' });
      }

      if (checkpoint.code.toUpperCase() !== code.trim().toUpperCase()) {
        return res.status(400).json({ error: 'Invalid attendance code' });
      }
    }

    if (!checkpoint) {
      return res.status(400).json({ error: 'Unable to process attendance' });
    }

    // Check if student already submitted for this checkpoint
    const existing = await prisma.attendanceCodeSubmission.findUnique({
      where: {
        checkpointId_studentId: {
          checkpointId: checkpoint.id,
          studentId
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'You have already submitted attendance for this checkpoint' });
    }

    // Handle concurrent duplicate submissions gracefully
    try {
      await prisma.attendanceCodeSubmission.create({
        data: {
          checkpointId: checkpoint.id,
          studentId,
          validity: 'VALID',
          ipAddress: req.ip
        }
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(400).json({ error: 'You have already submitted attendance for this checkpoint' });
      }
      throw err;
    }

    // Award Engagement XP once per session, not once per checkpoint. A student
    // submits both START and END, but PRESENT is a single attendance outcome.
    const existingAttendanceXp = await prisma.engagementEvent.findFirst({
      where: { studentId, sessionId, eventType: 'ATTENDANCE_PRESENT' },
    });

    if (!existingAttendanceXp) {
      await EngagementService.addEngagementEvent(
        studentId,
        sessionId,
        'ATTENDANCE_PRESENT',
        XP_TABLE.ATTENDANCE_PRESENT
      );
    }

    // Broadcast attendance submission to session room so faculty live view updates
    sessionManager.broadcastToSession(sessionId, {
      type: 'ATTENDANCE_SUBMITTED',
      checkpointId: checkpoint.id,
      checkpointType: checkpoint.checkpointType,
      studentId
    });

    return res.status(201).json({
      success: true,
      message: qrPayload ? 'Attendance verified via Dynamic QR! 🎉' : 'Attendance recorded successfully! 🎉'
    });
  } catch (error) {
    console.error('Error submitting attendance:', error);
    res.status(500).json({ error: 'Failed to submit attendance' });
  }
};
