import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

/**
 * Validates express-validator results and sends 400 if any errors
 */
export function validateRequest(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation failed.',
      code: 'VALIDATION_ERROR',
      details: errors.array().map((e) => ({
        field: 'path' in e ? e.path : 'unknown',
        message: e.msg,
      })),
    });
    return;
  }
  next();
}
