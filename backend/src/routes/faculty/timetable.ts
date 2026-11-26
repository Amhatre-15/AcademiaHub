import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/prisma';

const router = Router();

// All routes require FACULTY role
router.use(requireAuth, requireRole('FACULTY'));

// ─── GET /api/faculty/timetable ──────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // The faculty member's internal ID
    const facultyUser = await prisma.faculty.findUnique({
      where: { userId: req.user!.userId }
    });

    if (!facultyUser) {
      return res.status(404).json({ error: 'Faculty profile not found' });
    }

    const entries = await prisma.timetableEntry.findMany({
      where: {
        facultyId: facultyUser.id,
        isActive: true,
      },
      include: {
        subject: true,
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
