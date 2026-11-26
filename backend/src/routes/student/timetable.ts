import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/prisma';

const router = Router();

// All routes require STUDENT role
router.use(requireAuth, requireRole('STUDENT'));

// ─── GET /api/student/timetable ──────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentUser = await prisma.student.findUnique({
      where: { userId: req.user!.userId },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' }
        }
      }
    });

    if (!studentUser) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    if (studentUser.enrollments.length === 0) {
      return res.json({ entries: [] });
    }

    // Usually a student has 1 active enrollment for the current semester.
    // If they have multiple, we can fetch for all.
    const orConditions = studentUser.enrollments.map((enr) => ({
      classId: enr.classId,
      // If division/batch is specified in enrollment, match it, or if it's null in timetable it means the whole class
      AND: [
        {
          OR: [
            { divisionId: enr.divisionId },
            { divisionId: null }
          ]
        },
        {
          OR: [
            { batchId: enr.batchId },
            { batchId: null }
          ]
        }
      ]
    }));

    const entries = await prisma.timetableEntry.findMany({
      where: {
        isActive: true,
        OR: orConditions
      },
      include: {
        subject: true,
        faculty: { include: { user: true } },
        lectureType: true,
        timeSlot: true,
        class: true,
        division: true,
        batch: true,
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { timeSlot: { order: 'asc' } }
      ]
    });

    res.json({ entries });
  } catch (error) {
    next(error);
  }
});

export default router;
