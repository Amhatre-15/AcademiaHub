import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';

const router = Router();

// All routes require IT_ADMIN
router.use(requireAuth, requireRole('IT_ADMIN'));

// ─── GET /api/admin/subjects ──────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchId } = req.query as { branchId?: string };
    const subjects = await prisma.subject.findMany({
      where: branchId ? { branchId } : undefined,
      orderBy: { name: 'asc' },
      include: {
        branch: true,
        _count: { select: { facultyAssignments: true } },
      },
    });
    res.json({ subjects });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/admin/subjects ─────────────────────────────────────────
router.post(
  '/',
  [
    body('branchId').isUUID().withMessage('Branch ID is required.'),
    body('name').trim().notEmpty().withMessage('Subject name is required.'),
    body('code').optional().trim().toUpperCase(),
    body('description').optional().trim(),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, name, code, description } = req.body as {
        branchId: string;
        name: string;
        code?: string;
        description?: string;
      };

      const subject = await prisma.subject.create({
        data: {
          branchId,
          name,
          code: code?.toUpperCase() || undefined,
          description,
        },
        include: { branch: true },
      });

      res.status(201).json({ subject });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PUT /api/admin/subjects/:id ──────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid subject ID.'),
    body('name').optional().trim().notEmpty(),
    body('code').optional().trim(),
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

      const subject = await prisma.subject.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(code !== undefined && { code: code?.toUpperCase() || null }),
          ...(description !== undefined && { description }),
          ...(isActive !== undefined && { isActive }),
        },
        include: { branch: true },
      });

      res.json({ subject });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DELETE /api/admin/subjects/:id ──────────────────────────────────
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Invalid subject ID.')],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      const subject = await prisma.subject.findUnique({
        where: { id },
        include: { _count: { select: { facultyAssignments: true, sessions: true } } },
      });

      if (!subject) return next(createError('Subject not found.', 404));

      if (subject._count.facultyAssignments > 0 || subject._count.sessions > 0) {
        res.status(409).json({
          error: 'Cannot delete a subject with faculty assignments or sessions. Deactivate it instead.',
        });
        return;
      }

      await prisma.subject.delete({ where: { id } });
      res.json({ message: 'Subject deleted successfully.' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
