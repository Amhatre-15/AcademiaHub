import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requireFirstLoginComplete } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { hashPassword, verifyPassword, signJwt } from '../utils/auth';
import { createError } from '../middleware/errorHandler';
import { GoogleClassroomController } from '../controllers/shared/GoogleClassroomController';

const router = Router();

// ─────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password } = req.body as { username: string; password: string };

      const user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          passwordHash: true,
          role: true,
          firstLogin: true,
          status: true,
          student: { select: { id: true, firstName: true, lastName: true, prn: true } },
          faculty: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Use same error message for missing user and wrong password to prevent enumeration
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        res.status(401).json({ error: 'Username or password is incorrect.' });
        return;
      }

      if (user.status === 'INACTIVE') {
        res.status(403).json({ error: 'Your account has been deactivated. Please contact administration.' });
        return;
      }

      const token = signJwt(user.id, user.role);

      const profile =
        user.role === 'STUDENT'
          ? user.student
          : user.role === 'FACULTY'
          ? user.faculty
          : null;

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          firstLogin: user.firstLogin,
          profile,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// POST /api/auth/change-password
// Force password change on first login
// ─────────────────────────────────────────────────────────────────
router.post(
  '/change-password',
  requireAuth,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters.')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
      .matches(/[0-9]/).withMessage('Password must contain at least one number.'),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match.');
      }
      return true;
    }),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { currentPassword, newPassword } = req.body as {
        currentPassword: string;
        newPassword: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true, firstLogin: true },
      });

      if (!user) {
        return next(createError('User not found.', 404));
      }

      if (!(await verifyPassword(currentPassword, user.passwordHash))) {
        res.status(400).json({ error: 'Current password is incorrect.' });
        return;
      }

      // Prevent using the same password
      if (await verifyPassword(newPassword, user.passwordHash)) {
        res.status(400).json({ error: 'New password must be different from the current password.' });
        return;
      }

      const newHash = await hashPassword(newPassword);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { passwordHash: newHash, firstLogin: false },
        }),
        prisma.auditLog.create({
          data: {
            userId,
            action: 'PASSWORD_CHANGE',
            entityType: 'user',
            entityId: userId,
          },
        }),
      ]);

      res.json({ message: 'Password changed successfully.' });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// GET /api/auth/me
// Returns the currently authenticated user's profile
// ─────────────────────────────────────────────────────────────────
router.get(
  '/me',
  requireAuth,
  requireFirstLoginComplete,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          role: true,
          firstLogin: true,
          status: true,
          createdAt: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              prn: true,
              email: true,
              phone: true,
              status: true,
            },
          },
          faculty: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              email: true,
              phone: true,
              department: true,
              status: true,
            },
          },
        },
      });

      if (!user) {
        return next(createError('User not found.', 404));
      }

      res.json({ user });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// Client-side token invalidation (stateless JWT)
// ─────────────────────────────────────────────────────────────────
router.post('/logout', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'LOGOUT',
        entityType: 'user',
        entityId: req.user!.userId,
      },
    });
    res.json({ message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────
// Google OAuth2 Flow
// ─────────────────────────────────────────────────────────────────
router.get('/google/url', requireAuth, GoogleClassroomController.getAuthUrl);
router.get('/google/callback', GoogleClassroomController.handleCallback);

export default router;
