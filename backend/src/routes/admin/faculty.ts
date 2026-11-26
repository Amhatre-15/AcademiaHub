import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/prisma';
import { hashPassword } from '../../utils/auth';
import { createError } from '../../middleware/errorHandler';
import { AuditAction } from '@prisma/client';

const router = Router();

// All routes require IT_ADMIN
router.use(requireAuth, requireRole('IT_ADMIN'));

// ─── GET /api/admin/faculty ───────────────────────────────────────────
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page = '1', limit = '50' } = req.query as {
        status?: string;
        page?: string;
        limit?: string;
      };

      const pageNum = parseInt(page, 10);
      const limitNum = Math.min(parseInt(limit, 10), 100);
      const skip = (pageNum - 1) * limitNum;

      const where = status === 'ACTIVE' || status === 'INACTIVE'
        ? { status: status as 'ACTIVE' | 'INACTIVE' }
        : {};

      const [faculty, total] = await Promise.all([
        prisma.faculty.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { firstName: 'asc' },
          include: {
            user: {
              select: { id: true, username: true, status: true, firstLogin: true, createdAt: true },
            },
            _count: { select: { assignments: true, sessions: true } },
          },
        }),
        prisma.faculty.count({ where }),
      ]);

      res.json({ faculty, total, page: pageNum, limit: limitNum });
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /api/admin/faculty/:id ───────────────────────────────────────
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Invalid faculty ID.')],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const faculty = await prisma.faculty.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, username: true, status: true, firstLogin: true, createdAt: true },
          },
          assignments: {
            where: { status: 'ACTIVE' },
            include: {
              subject: true,
              class: { include: { academicLevel: { include: { branch: true } } } },
              division: true,
              batch: true,
            },
          },
        },
      });

      if (!faculty) return next(createError('Faculty member not found.', 404));
      res.json({ faculty });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/admin/faculty ──────────────────────────────────────────
router.post(
  '/',
  [
    body('firstName').trim().notEmpty().withMessage('First name is required.'),
    body('lastName').trim().notEmpty().withMessage('Last name is required.'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Invalid email address.'),
    body('phone').optional().trim(),
    body('employeeId').optional().trim(),
    body('department').optional().trim(),
    body('username').optional().trim(),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { firstName, lastName, email, phone, employeeId, department, username } = req.body as {
        firstName: string;
        lastName: string;
        email?: string;
        phone?: string;
        employeeId?: string;
        department?: string;
        username?: string;
      };

      // Generate username from firstName if not provided
      let resolvedUsername = username?.trim() || firstName;
      resolvedUsername = resolvedUsername.toLowerCase().replace(/\s+/g, '');

      // Ensure username uniqueness
      const baseUsername = resolvedUsername;
      let counter = 1;
      while (true) {
        const existing = await prisma.user.findUnique({
          where: { username: resolvedUsername },
        });
        if (!existing) break;
        resolvedUsername = `${baseUsername}${counter}`;
        counter++;
      }

      // Default faculty password: sspu@123
      const defaultPassword = 'sspu@123';
      const passwordHash = await hashPassword(defaultPassword);

      const faculty = await prisma.faculty.create({
        data: {
          firstName,
          lastName,
          email: email || undefined,
          phone: phone || undefined,
          employeeId: employeeId || undefined,
          department: department || undefined,
          user: {
            create: {
              username: resolvedUsername,
              passwordHash,
              role: 'FACULTY',
              firstLogin: true,
              status: 'ACTIVE',
            },
          },
        },
        include: {
          user: {
            select: { id: true, username: true, status: true, firstLogin: true },
          },
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: AuditAction.CREATE,
          entityType: 'faculty',
          entityId: faculty.id,
          afterData: { username: resolvedUsername, firstName, lastName },
        },
      });

      res.status(201).json({ faculty });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PUT /api/admin/faculty/:id ───────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid faculty ID.'),
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('employeeId').optional().trim(),
    body('department').optional().trim(),
    body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid status.'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { firstName, lastName, email, phone, employeeId, department, status } = req.body as {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        employeeId?: string;
        department?: string;
        status?: 'ACTIVE' | 'INACTIVE';
      };

      const existingFaculty = await prisma.faculty.findUnique({
        where: { id },
        include: { user: { select: { id: true } } },
      });
      if (!existingFaculty) return next(createError('Faculty member not found.', 404));

      // Update faculty profile and optionally user status in a transaction
      const faculty = await prisma.$transaction(async (tx) => {
        const updated = await tx.faculty.update({
          where: { id },
          data: {
            ...(firstName !== undefined && { firstName }),
            ...(lastName !== undefined && { lastName }),
            ...(email !== undefined && { email: email || null }),
            ...(phone !== undefined && { phone: phone || null }),
            ...(employeeId !== undefined && { employeeId: employeeId || null }),
            ...(department !== undefined && { department: department || null }),
            ...(status !== undefined && { status }),
          },
          include: {
            user: {
              select: { id: true, username: true, status: true, firstLogin: true },
            },
          },
        });

        // Sync user status with faculty status
        if (status !== undefined) {
          await tx.user.update({
            where: { id: existingFaculty.userId },
            data: { status },
          });
        }

        await tx.auditLog.create({
          data: {
            userId: req.user!.userId,
            action: status === 'INACTIVE' ? AuditAction.ACCOUNT_DEACTIVATE : AuditAction.UPDATE,
            entityType: 'faculty',
            entityId: id,
            afterData: { status, firstName, lastName },
          },
        });

        return updated;
      });

      res.json({ faculty });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/admin/faculty/:id/reset-password ───────────────────────
router.post(
  '/:id/reset-password',
  [param('id').isUUID().withMessage('Invalid faculty ID.')],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      const faculty = await prisma.faculty.findUnique({
        where: { id },
        select: { id: true, userId: true },
      });
      if (!faculty) return next(createError('Faculty member not found.', 404));

      const newHash = await hashPassword('sspu@123');
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: faculty.userId },
          data: { passwordHash: newHash, firstLogin: true },
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.userId,
            action: AuditAction.UPDATE,
            entityType: 'faculty',
            entityId: id,
            afterData: { action: 'password_reset' },
          },
        });
      });

      res.json({ message: 'Password reset successfully. Faculty must change password on next login.' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
