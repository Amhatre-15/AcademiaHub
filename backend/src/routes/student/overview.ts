import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/prisma';

const router = Router();

router.use(requireAuth, requireRole('STUDENT'));

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentUser = await prisma.student.findUnique({
      where: { userId: req.user!.userId },
      include: {
        studentEngagement: true,
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            class: true,
            division: true,
            batch: true
          }
        }
      }
    });

    if (!studentUser) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    // Default engagement if none exists yet
    const engagement = studentUser.studentEngagement || {
      totalXp: 0,
      level: 1,
      streak: 0,
    };

    const activeEnrollment = studentUser.enrollments[0];

    res.json({
      engagement,
      student: {
        firstName: studentUser.firstName,
        lastName: studentUser.lastName,
      },
      class: activeEnrollment?.class ?? null,
      division: activeEnrollment?.division ?? null,
      batch: activeEnrollment?.batch ?? null,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
