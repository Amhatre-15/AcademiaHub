import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';

const router = Router();

// All routes require IT_ADMIN
router.use(requireAuth, requireRole('IT_ADMIN'));

// ─── GET /api/admin/academic-levels ──────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchId } = req.query as { branchId?: string };
    const academicLevels = await prisma.academicLevel.findMany({
      where: branchId ? { branchId } : undefined,
      orderBy: [{ branch: { name: 'asc' } }, { order: 'asc' }],
      include: {
        branch: true,
        _count: { select: { classes: true, semesters: true } },
      },
    });
    res.json({ academicLevels });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/admin/academic-levels ─────────────────────────────────
router.post(
  '/',
  [
    body('branchId').isUUID().withMessage('Branch ID is required.'),
    body('name').trim().notEmpty().withMessage('Level name is required (e.g. FY, SY, TY).'),
    body('description').optional().trim(),
    body('order').optional().isInt({ min: 0 }),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, name, description, order } = req.body as {
        branchId: string;
        name: string;
        description?: string;
        order?: number;
      };

      const level = await prisma.academicLevel.create({
        data: { branchId, name, description, order: order ?? 0 },
        include: { branch: true },
      });

      res.status(201).json({ academicLevel: level });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PUT /api/admin/academic-levels/:id ──────────────────────────────
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid academic level ID.'),
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('order').optional().isInt({ min: 0 }),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { name, description, order } = req.body as {
        name?: string;
        description?: string;
        order?: number;
      };

      const level = await prisma.academicLevel.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(order !== undefined && { order }),
        },
        include: { branch: true },
      });

      res.json({ academicLevel: level });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
