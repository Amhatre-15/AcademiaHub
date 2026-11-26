import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/prisma';
import { hashPassword } from '../../utils/auth';
import { createError } from '../../middleware/errorHandler';
import { AuditAction } from '@prisma/client';

const router = Router();

// All routes require IT_ADMIN
router.use(requireAuth, requireRole('IT_ADMIN'));

// ─── GET /api/admin/students ──────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, search, page = '1', limit = '50' } = req.query as {
      status?: string;
      search?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (status === 'ACTIVE' || status === 'INACTIVE') {
      where['status'] = status;
    }
    if (search) {
      where['OR'] = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { prn: { contains: search } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        include: {
          user: {
            select: { id: true, username: true, status: true, firstLogin: true, createdAt: true },
          },
          enrollments: {
            where: { status: 'ACTIVE' },
            include: {
              class: { include: { academicLevel: { include: { branch: true } } } },
              division: true,
              batch: true,
            },
          },
        },
      }),
      prisma.student.count({ where }),
    ]);

    res.json({ students, total, page: pageNum, limit: limitNum });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/admin/students/:id ─────────────────────────────────────
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Invalid student ID.')],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const student = await prisma.student.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, username: true, status: true, firstLogin: true, createdAt: true },
          },
          enrollments: {
            include: {
              class: { include: { academicLevel: { include: { branch: true } } } },
              division: true,
              batch: true,
              academicYear: true,
              semester: true,
            },
          },
        },
      });

      if (!student) return next(createError('Student not found.', 404));
      res.json({ student });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/admin/students ─────────────────────────────────────────
// Create a single student
router.post(
  '/',
  [
    body('firstName').trim().notEmpty().withMessage('First name is required.'),
    body('lastName').trim().notEmpty().withMessage('Last name is required.'),
    body('prn').trim().notEmpty().withMessage('PRN is required.'),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { firstName, lastName, prn, email, phone } = req.body as {
        firstName: string;
        lastName: string;
        prn: string;
        email?: string;
        phone?: string;
      };

      // Check duplicate PRN
      const existingPrn = await prisma.student.findUnique({ where: { prn } });
      if (existingPrn) {
        res.status(409).json({ error: `A student with PRN ${prn} already exists.` });
        return;
      }

      // Generate unique username from first name
      const username = await generateUniqueUsername(firstName);
      const passwordHash = await hashPassword(prn); // Initial password = PRN

      const student = await prisma.$transaction(async (tx) => {
        const s = await tx.student.create({
          data: {
            firstName,
            lastName,
            prn,
            email: email || undefined,
            phone: phone || undefined,
            user: {
              create: {
                username,
                passwordHash,
                role: 'STUDENT',
                firstLogin: true,
                status: 'ACTIVE',
              },
            },
          },
          include: {
            user: { select: { id: true, username: true, status: true, firstLogin: true } },
          },
        });

        await tx.auditLog.create({
          data: {
            userId: req.user!.userId,
            action: AuditAction.CREATE,
            entityType: 'student',
            entityId: s.id,
            afterData: { prn, firstName, lastName, username },
          },
        });

        return s;
      });

      res.status(201).json({ student });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/admin/students/bulk-parse ─────────────────────────────
// STEP 1: Parse raw copy/paste text and return a preview (no DB writes)
router.post(
  '/bulk-parse',
  [
    body('rawText').notEmpty().withMessage('Raw text is required.'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { rawText } = req.body as { rawText: string };

      const parsed = parseStudentBulkText(rawText);

      // Check existing PRNs in DB
      const prns = parsed.valid.map((r) => r.prn);
      const existingStudents = prns.length
        ? await prisma.student.findMany({
            where: { prn: { in: prns } },
            select: { prn: true },
          })
        : [];
      const existingPrnSet = new Set(existingStudents.map((s) => s.prn));

      // Check existing usernames to predict generated usernames
      const firstNames = parsed.valid.map((r) => r.firstName.toLowerCase());
      const existingUsers = firstNames.length
        ? await prisma.user.findMany({
            where: { username: { in: firstNames } },
            select: { username: true },
          })
        : [];
      const existingUsernameSet = new Set(existingUsers.map((u) => u.username));

      // Annotate valid rows with duplicate flags
      const annotated = parsed.valid.map((row) => ({
        ...row,
        duplicatePrn: existingPrnSet.has(row.prn),
        usernameConflict: existingUsernameSet.has(row.firstName.toLowerCase()),
      }));

      res.json({
        valid: annotated,
        invalid: parsed.invalid,
        summary: {
          totalRows: parsed.valid.length + parsed.invalid.length,
          validRows: parsed.valid.length,
          invalidRows: parsed.invalid.length,
          duplicatePrns: annotated.filter((r) => r.duplicatePrn).length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/admin/students/bulk-import ────────────────────────────
// STEP 2: Actually import the (confirmed) students
router.post(
  '/bulk-import',
  [
    body('students')
      .isArray({ min: 1 })
      .withMessage('Students array must have at least one entry.'),
    body('students.*.firstName').trim().notEmpty().withMessage('First name is required.'),
    body('students.*.lastName').trim().notEmpty().withMessage('Last name is required.'),
    body('students.*.prn').trim().notEmpty().withMessage('PRN is required.'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { students } = req.body as {
        students: Array<{ firstName: string; lastName: string; prn: string; email?: string }>;
      };

      const results: {
        success: Array<{ prn: string; username: string; firstName: string; lastName: string }>;
        skipped: Array<{ prn: string; reason: string }>;
        errors: Array<{ prn: string; reason: string }>;
      } = {
        success: [],
        skipped: [],
        errors: [],
      };

      // Deduplicate within the request
      const seen = new Set<string>();
      for (const s of students) {
        if (seen.has(s.prn)) {
          results.skipped.push({ prn: s.prn, reason: 'Duplicate PRN in import batch' });
          continue;
        }
        seen.add(s.prn);
      }

      const deduped = students.filter((s, idx, arr) => arr.findIndex((x) => x.prn === s.prn) === idx);

      // Pre-fetch all existing PRNs to avoid N+1 queries in the loop
      const incomingPrns = deduped.map(s => s.prn);
      const existingRecords = incomingPrns.length > 0 
        ? await prisma.student.findMany({ where: { prn: { in: incomingPrns } }, select: { prn: true } })
        : [];
      const existingPrnSet = new Set(existingRecords.map(r => r.prn));

      // Process each student individually within transactions
      for (const studentData of deduped) {
        try {
          // Check if PRN already exists using the pre-fetched Set
          if (existingPrnSet.has(studentData.prn)) {
            results.skipped.push({ prn: studentData.prn, reason: `PRN already exists in database` });
            continue;
          }

          const username = await generateUniqueUsername(studentData.firstName);
          const passwordHash = await hashPassword(studentData.prn);

          await prisma.$transaction(async (tx) => {
            const created = await tx.student.create({
              data: {
                firstName: studentData.firstName,
                lastName: studentData.lastName,
                prn: studentData.prn,
                email: studentData.email || undefined,
                user: {
                  create: {
                    username,
                    passwordHash,
                    role: 'STUDENT',
                    firstLogin: true,
                    status: 'ACTIVE',
                  },
                },
              },
              include: { user: { select: { username: true } } },
            });

            await tx.auditLog.create({
              data: {
                userId: req.user!.userId,
                action: AuditAction.CREATE,
                entityType: 'student',
                entityId: created.id,
                afterData: { prn: studentData.prn, username, source: 'bulk_import' },
              },
            });
          });

          results.success.push({
            prn: studentData.prn,
            username,
            firstName: studentData.firstName,
            lastName: studentData.lastName,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          results.errors.push({ prn: studentData.prn, reason: message });
        }
      }

      const statusCode = results.success.length > 0 ? 200 : 422;
      res.status(statusCode).json({
        message: `Import complete: ${results.success.length} created, ${results.skipped.length} skipped, ${results.errors.length} errors.`,
        ...results,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PUT /api/admin/students/:id ─────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid student ID.'),
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { firstName, lastName, email, phone, status } = req.body as {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        status?: 'ACTIVE' | 'INACTIVE';
      };

      const existing = await prisma.student.findUnique({
        where: { id },
        select: { id: true, userId: true },
      });
      if (!existing) return next(createError('Student not found.', 404));

      const student = await prisma.$transaction(async (tx) => {
        const updated = await tx.student.update({
          where: { id },
          data: {
            ...(firstName !== undefined && { firstName }),
            ...(lastName !== undefined && { lastName }),
            ...(email !== undefined && { email: email || null }),
            ...(phone !== undefined && { phone: phone || null }),
            ...(status !== undefined && { status }),
          },
          include: {
            user: { select: { id: true, username: true, status: true, firstLogin: true } },
          },
        });

        // Sync user status
        if (status !== undefined) {
          await tx.user.update({
            where: { id: existing.userId },
            data: { status },
          });
        }

        await tx.auditLog.create({
          data: {
            userId: req.user!.userId,
            action: status === 'INACTIVE' ? AuditAction.ACCOUNT_DEACTIVATE : AuditAction.UPDATE,
            entityType: 'student',
            entityId: id,
            afterData: { status, firstName, lastName },
          },
        });

        return updated;
      });

      res.json({ student });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/admin/students/:id/reset-password ─────────────────────
router.post(
  '/:id/reset-password',
  [param('id').isUUID().withMessage('Invalid student ID.')],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      const student = await prisma.student.findUnique({
        where: { id },
        select: { id: true, userId: true, prn: true },
      });
      if (!student) return next(createError('Student not found.', 404));

      // Reset to PRN
      const newHash = await hashPassword(student.prn);
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: student.userId },
          data: { passwordHash: newHash, firstLogin: true },
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.userId,
            action: AuditAction.UPDATE,
            entityType: 'student',
            entityId: id,
            afterData: { action: 'password_reset_to_prn' },
          },
        });
      });

      res.json({ message: 'Password reset to PRN. Student must change password on next login.' });
    } catch (error) {
      next(error);
    }
  }
);

// ─── HELPER: Parse bulk copy/paste text ──────────────────────────────
export function parseStudentBulkText(rawText: string): {
  valid: Array<{ firstName: string; lastName: string; prn: string; rowNumber: number }>;
  invalid: Array<{ rowNumber: number; rawLine: string; reason: string }>;
} {
  const valid: Array<{ firstName: string; lastName: string; prn: string; rowNumber: number }> = [];
  const invalid: Array<{ rowNumber: number; rawLine: string; reason: string }> = [];

  const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rowNumber = i + 1;

    // Split by tabs first, then collapse multiple spaces
    const parts = line.split(/\t+|\s{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);

    if (parts.length < 2) {
      invalid.push({ rowNumber, rawLine: line, reason: 'Row must contain at least a name and PRN' });
      continue;
    }

    // Last token is expected to be the PRN (numeric, 10 digits typically)
    const potentialPrn = parts[parts.length - 1];
    const prnMatch = /^\d{8,12}$/.test(potentialPrn);

    if (!prnMatch) {
      invalid.push({
        rowNumber,
        rawLine: line,
        reason: `Could not identify a valid PRN (found: "${potentialPrn}"). PRN should be 8-12 digits.`,
      });
      continue;
    }

    const prn = potentialPrn;
    const nameParts = parts.slice(0, -1).join(' ').split(/\s+/);

    if (nameParts.length === 0) {
      invalid.push({ rowNumber, rawLine: line, reason: 'No name found before the PRN' });
      continue;
    }

    // First word = firstName, rest = lastName (supports middle names)
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    if (!firstName) {
      invalid.push({ rowNumber, rawLine: line, reason: 'First name is empty' });
      continue;
    }

    valid.push({ firstName, lastName, prn, rowNumber });
  }

  return { valid, invalid };
}

// ─── HELPER: Generate unique username from first name ─────────────────
export async function generateUniqueUsername(firstName: string): Promise<string> {
  // Clean: lowercase, remove special chars
  const base = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
  let username = base;
  let counter = 2;

  while (true) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (!existing) return username;
    username = `${base}${counter}`;
    counter++;
  }
}

export default router;
