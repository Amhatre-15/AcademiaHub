import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Global error handler — must be registered as the last middleware.
 * Never exposes raw database errors or stack traces to the client in production.
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const isDev = env.isDev;

  // Log full error in development, minimal in production
  if (isDev) {
    console.error('[ErrorHandler]', err);
  } else {
    console.error(`[ErrorHandler] ${err.message} (${statusCode})`);
  }

  // Prisma-specific error handling
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as AppError & { meta?: Record<string, unknown>; code?: string };

    if (prismaErr.code === 'P2002') {
      // Unique constraint violation
      res.status(409).json({
        error: 'A record with this information already exists.',
        code: 'DUPLICATE_RECORD',
      });
      return;
    }

    if (prismaErr.code === 'P2025') {
      // Record not found
      res.status(404).json({
        error: 'The requested record was not found.',
        code: 'NOT_FOUND',
      });
      return;
    }

    if (prismaErr.code === 'P2003') {
      // Foreign key constraint
      res.status(400).json({
        error: 'A referenced record does not exist.',
        code: 'INVALID_REFERENCE',
      });
      return;
    }
  }

  if (err.name === 'PrismaClientValidationError') {
    res.status(400).json({
      error: 'Invalid data provided.',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  // JWT errors (already handled in middleware, but guard here too)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    res.status(400).json({
      error: 'Validation failed.',
      code: 'VALIDATION_ERROR',
      details: isDev ? err.message : undefined,
    });
    return;
  }

  res.status(statusCode).json({
    error: statusCode === 500
      ? 'An internal server error occurred. Please try again later.'
      : err.message || 'An unexpected error occurred.',
    code: err.code,
    // Only include stack trace in development
    ...(isDev && { stack: err.stack }),
  });
}

/**
 * Helper to create typed app errors
 */
export function createError(message: string, statusCode: number, code?: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found.`,
    code: 'NOT_FOUND',
  });
}
