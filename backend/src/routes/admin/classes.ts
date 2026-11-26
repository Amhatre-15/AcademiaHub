import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';

const router = Router();

// All routes require IT_ADMIN
router.use(requireAuth, requireRole('IT_ADMIN'));

// ─── GET /api/admin/classes ───────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { academicYearId, semesterId, academicLevelId } = req.query as {
      academicYearId?: string;
      semesterId?: string;
      academicLevelId?: string;
    };

    const classes = await prisma.class.findMany({
      where: {
        ...(academicYearId && { academicYearId }),
        ...(semesterId && { semesterId }),
        ...(academicLevelId && { academicLevelId }),
      },
      orderBy: { name: 'asc' },
      include: {
        academicLevel: { include: { branch: true } },
        academicYear: true,
        semester: true,
        _count: { select: { divisions: true, enrollments: true } },
      },
    });
    res.json({ classes });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/admin/classes/:id ───────────────────────────────────────
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Invalid class ID.')],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const cls = await prisma.class.findUnique({
        where: { id },
        include: {
          academicLevel: { include: { branch: true } },
          academicYear: true,
          semester: true,
          divisions: {
            include: {
              batches: true,
              _count: { select: { enrollments: true } },
            },
            orderBy: { name: 'asc' },
          },
          _count: { select: { enrollments: true } },
        },
      });

      if (!cls) return next(createError('Class not found.', 404));
      res.json({ class: cls });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/admin/classes ──────────────────────────────────────────
router.post(
  '/',
  [
    body('academicLevelId').isUUID().withMessage('Academic level ID is required.'),
    body('academicYearId').isUUID().withMessage('Academic year ID is required.'),
    body('semesterId').isUUID().withMessage('Semester ID is required.'),
    body('name').trim().notEmpty().withMessage('Class name is required.'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { academicLevelId, academicYearId, semesterId, name } = req.body as {
        academicLevelId: string;
        academicYearId: string;
        semesterId: string;
        name: string;
      };

      const cls = await prisma.class.create({
        data: { academicLevelId, academicYearId, semesterId, name },
        include: {
          academicLevel: { include: { branch: true } },
          academicYear: true,
          semester: true,
        },
      });

      res.status(201).json({ class: cls });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PUT /api/admin/classes/:id ───────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid class ID.'),
    body('name').optional().trim().notEmpty(),
    body('isActive').optional().isBoolean(),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { name, isActive } = req.body as { name?: string; isActive?: boolean };

      const cls = await prisma.class.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(isActive !== undefined && { isActive }),
        },
        include: {
          academicLevel: { include: { branch: true } },
          academicYear: true,
          semester: true,
        },
      });

      res.json({ class: cls });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/admin/classes/:id/divisions ────────────────────────────
router.post(
  '/:id/divisions',
  [
    param('id').isUUID().withMessage('Invalid class ID.'),
    body('name').trim().notEmpty().withMessage('Division name is required (e.g. A, B).'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const classId = req.params.id as string;
      const { name } = req.body as { name: string };

      const division = await prisma.division.create({
        data: { classId, name },
        include: { batches: true },
      });

      res.status(201).json({ division });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/admin/classes/divisions/:divisionId/batches ────────────
router.post(
  '/divisions/:divisionId/batches',
  [
    param('divisionId').isUUID().withMessage('Invalid division ID.'),
    body('name').trim().notEmpty().withMessage('Batch name is required (e.g. B1, B2).'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const divisionId = req.params.divisionId as string;
      const { name } = req.body as { name: string };

      const batch = await prisma.batch.create({
        data: { divisionId, name },
      });

      res.status(201).json({ batch });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DELETE /api/admin/classes/divisions/:divisionId/batches/:batchId ──
router.delete(
  '/divisions/:divisionId/batches/:batchId',
  [
    param('divisionId').isUUID(),
    param('batchId').isUUID(),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const batchId = req.params.batchId as string;

      const batch = await prisma.batch.findUnique({
        where: { id: batchId },
        include: { _count: { select: { enrollments: true } } },
      });

      if (!batch) return next(createError('Batch not found.', 404));

      if (batch._count.enrollments > 0) {
        res.status(409).json({
          error: 'Cannot delete a batch with enrolled students. Deactivate it instead.',
        });
        return;
      }

      await prisma.batch.delete({ where: { id: batchId } });
      res.json({ message: 'Batch deleted.' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
