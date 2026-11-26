import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { Role } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  role: Role;
  iat?: number;
  exp?: number;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: Role;
        username: string;
        /** Resolved Faculty.id when role === FACULTY. Set by auth middleware. */
        facultyId?: string;
        /** Resolved Student.id when role === STUDENT. Set by auth middleware. */
        studentId?: string;
      };
    }
  }
}

/**
 * requireAuth middleware:
 * - Validates JWT from Authorization: Bearer <token> header
 * - Fetches user from DB to verify role (never trusts JWT role alone as sole authority)
 * - Attaches req.user with server-verified data
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const token = authHeader.slice(7);

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
      res.status(401).json({ error: 'Invalid or expired token.' });
      return;
    }

    // Always re-verify role from DB to prevent stale/tampered tokens
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        role: true,
        username: true,
        status: true,
        student: { select: { id: true } },
        faculty: { select: { id: true } },
      },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found.' });
      return;
    }

    if (user.status === 'INACTIVE') {
      res.status(403).json({ error: 'Your account has been deactivated. Please contact administration.' });
      return;
    }

    // Attach server-verified user info including profile IDs
    req.user = {
      userId: user.id,
      role: user.role,
      username: user.username,
      facultyId: user.faculty?.id,
      studentId: user.student?.id,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * requireRole middleware factory:
 * - Use after requireAuth
 * - Accepts one or more allowed roles, either as spread args or an array:
 *   requireRole('FACULTY') or requireRole(['FACULTY', 'IT_ADMIN'])
 */
export function requireRole(...rolesOrArray: (Role | Role[])[]): (req: Request, res: Response, next: NextFunction) => void {
  // Flatten supports both requireRole('FACULTY') and requireRole(['FACULTY', 'IT_ADMIN'])
  const roles = rolesOrArray.flat() as Role[];

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'You do not have permission to perform this action.' });
      return;
    }

    next();
  };
}

/**
 * requireFirstLoginComplete middleware:
 * - Blocks API access if first_login is still true (forces password change first)
 */
export async function requireFirstLoginComplete(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { firstLogin: true },
    });

    if (user?.firstLogin) {
      res.status(403).json({
        error: 'Password change required.',
        code: 'FIRST_LOGIN_REQUIRED',
        message: 'Please change your temporary password before continuing.',
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
