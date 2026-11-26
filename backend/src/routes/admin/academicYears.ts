import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';

const router = Router();

// All routes require IT_ADMIN
router.use(requireAuth, requireRole('IT_ADMIN'));

// ─── GET /api/admin/academic-years ────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const academicYears = await prisma.academicYear.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        _count: { select: { semesters: true, enrollments: true } },
      },
    });
    res.json({ academicYears });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/admin/academic-years ──────────────────────────────────
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Academic year name is required (e.g. 2024-25).'),
    body('startDate').isISO8601().withMessage('Start date must be a valid date.'),
    body('endDate').isISO8601().withMessage('End date must be a valid date.'),
    body('isActive').optional().isBoolean(),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, startDate, endDate, isActive } = req.body as {
        name: string;
        startDate: string;
        endDate: string;
        isActive?: boolean;
      };

      // If making active, deactivate others first
      if (isActive) {
        await prisma.academicYear.updateMany({ data: { isActive: false } });
      }

      const academicYear = await prisma.academicYear.create({
        data: {
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          isActive: isActive ?? false,
        },
      });

      res.status(201).json({ academicYear });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PUT /api/admin/academic-years/:id ───────────────────────────────
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid academic year ID.'),
    body('name').optional().trim().notEmpty(),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('isActive').optional().isBoolean(),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { name, startDate, endDate, isActive } = req.body as {
        name?: string;
        startDate?: string;
        endDate?: string;
        isActive?: boolean;
      };

      // If making active, deactivate others first
      if (isActive === true) {
        await prisma.academicYear.updateMany({
          where: { id: { not: id } },
          data: { isActive: false },
        });
      }

      const academicYear = await prisma.academicYear.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(startDate !== undefined && { startDate: new Date(startDate) }),
          ...(endDate !== undefined && { endDate: new Date(endDate) }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      res.json({ academicYear });
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /api/admin/academic-years/:id/semesters ──────────────────────
router.get(
  '/:id/semesters',
  [param('id').isUUID().withMessage('Invalid academic year ID.')],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const semesters = await prisma.semester.findMany({
        where: { academicYearId: id },
        include: {
          academicLevel: { include: { branch: true } },
        },
        orderBy: { number: 'asc' },
      });
      res.json({ semesters });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/admin/academic-years/:id/semesters ─────────────────────
router.post(
  '/:id/semesters',
  [
    param('id').isUUID().withMessage('Invalid academic year ID.'),
    body('academicLevelId').isUUID().withMessage('Academic level ID is required.'),
    body('number').isInt({ min: 1 }).withMessage('Semester number must be a positive integer.'),
    body('startDate').isISO8601().withMessage('Start date is required.'),
    body('endDate').isISO8601().withMessage('End date is required.'),
    body('isActive').optional().isBoolean(),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academicYearId = req.params.id as string;
      const { academicLevelId, number, startDate, endDate, isActive } = req.body as {
        academicLevelId: string;
        number: number;
        startDate: string;
        endDate: string;
        isActive?: boolean;
      };

      const semester = await prisma.semester.create({
        data: {
          academicYearId,
          academicLevelId,
          number,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          isActive: isActive ?? false,
        },
        include: { academicLevel: true },
      });

      res.status(201).json({ semester });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
