import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import { cacheService } from '../../services/CacheService';

const router = Router();

// All branch routes require IT_ADMIN
router.use(requireAuth, requireRole('IT_ADMIN'));

// ─── GET /api/admin/branches ────────────────────────────────────────
router.get('/', cacheService.cacheMiddleware(120), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { academicLevels: true, subjects: true },
        },
      },
    });
    res.json({ branches });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/admin/branches ────────────────────────────────────────
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Branch name is required.'),
    body('code')
      .trim()
      .notEmpty()
      .withMessage('Branch code is required.')
      .toUpperCase(),
    body('description').optional().trim(),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, code, description } = req.body as {
        name: string;
        code: string;
        description?: string;
      };

      const branch = await prisma.branch.create({
        data: { name, code: code.toUpperCase(), description },
      });

      void cacheService.delPattern('*branches*');
      res.status(201).json({ branch });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PUT /api/admin/branches/:id ─────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid branch ID.'),
    body('name').optional().trim().notEmpty().withMessage('Branch name cannot be empty.'),
    body('code').optional().trim().notEmpty().toUpperCase(),
    body('description').optional().trim(),
    body('isActive').optional().isBoolean(),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { name, code, description, isActive } = req.body as {
        name?: string;
        code?: string;
        description?: string;
        isActive?: boolean;
      };

      const branch = await prisma.branch.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(code !== undefined && { code: code.toUpperCase() }),
          ...(description !== undefined && { description }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      void cacheService.delPattern('*branches*');
      res.json({ branch });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DELETE /api/admin/branches/:id ──────────────────────────────────
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Invalid branch ID.')],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      // Check if any academic levels / subjects exist
      const branchWithDeps = await prisma.branch.findUnique({
        where: { id },
        include: {
          _count: { select: { academicLevels: true, subjects: true } },
        },
      });

      if (!branchWithDeps) {
        return next(createError('Branch not found.', 404));
      }

      if (
        branchWithDeps._count.academicLevels > 0 ||
        branchWithDeps._count.subjects > 0
      ) {
        res.status(409).json({
          error:
            'Cannot delete a branch that has academic levels or subjects. Deactivate it instead.',
        });
        return;
      }

      await prisma.branch.delete({ where: { id: id as string } });
      void cacheService.delPattern('*branches*');
      res.json({ message: 'Branch deleted successfully.' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
