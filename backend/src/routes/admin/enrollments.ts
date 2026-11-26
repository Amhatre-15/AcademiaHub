import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import { AuditAction } from '@prisma/client';

const router = Router();

// All routes require IT_ADMIN
router.use(requireAuth, requireRole('IT_ADMIN'));

// ─── GET /api/admin/enrollments ───────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, classId, semesterId, academicYearId, divisionId, page = '1', limit = '30' } = req.query as {
      studentId?: string;
      classId?: string;
      semesterId?: string;
      academicYearId?: string;
      divisionId?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10)), 200);
    const skip = (pageNum - 1) * limitNum;

    const where = {
      ...(studentId && { studentId }),
      ...(classId && { classId }),
      ...(semesterId && { semesterId }),
      ...(academicYearId && { academicYearId }),
      ...(divisionId && { divisionId }),
      status: 'ACTIVE' as const,
    };

    const [enrollments, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              prn: true,
              user: { select: { username: true, status: true } },
            },
          },
          class: { include: { academicLevel: { include: { branch: true } } } },
          division: true,
          batch: true,
          academicYear: true,
          semester: true,
        },
        orderBy: [{ student: { firstName: 'asc' } }],
      }),
      prisma.enrollment.count({ where }),
    ]);

    res.json({ enrollments, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/admin/enrollments ──────────────────────────────────────
router.post(
  '/',
  [
    body('studentId').isUUID().withMessage('Student ID is required.'),
    body('classId').isUUID().withMessage('Class ID is required.'),
    body('divisionId').optional().isUUID(),
    body('batchId').optional().isUUID(),
    body('academicYearId').isUUID().withMessage('Academic year ID is required.'),
    body('semesterId').isUUID().withMessage('Semester ID is required.'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, classId, divisionId, batchId, academicYearId, semesterId } = req.body as {
        studentId: string;
        classId: string;
        divisionId?: string;
        batchId?: string;
        academicYearId: string;
        semesterId: string;
      };

      // Verify student exists
      const student = await prisma.student.findUnique({ where: { id: studentId } });
      if (!student) return next(createError('Student not found.', 404));

      const enrollment = await prisma.$transaction(async (tx) => {
        const e = await tx.enrollment.create({
          data: {
            studentId,
            classId,
            divisionId: divisionId || null,
            batchId: batchId || null,
            academicYearId,
            semesterId,
            status: 'ACTIVE',
          },
          include: {
            student: { select: { firstName: true, lastName: true, prn: true } },
            class: { include: { academicLevel: { include: { branch: true } } } },
            division: true,
            batch: true,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: req.user!.userId,
            action: AuditAction.ENROLLMENT_CHANGE,
            entityType: 'enrollment',
            entityId: e.id,
            afterData: { studentId, classId, divisionId, batchId, action: 'enrolled' },
          },
        });

        return e;
      });

      res.status(201).json({ enrollment });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/admin/enrollments/bulk ────────────────────────────────
// Enroll multiple students into the same class/division/batch at once
router.post(
  '/bulk',
  [
    body('studentIds').isArray({ min: 1 }).withMessage('At least one student ID is required.'),
    body('studentIds.*').isUUID(),
    body('classId').isUUID().withMessage('Class ID is required.'),
    body('divisionId').optional().isUUID(),
    body('batchId').optional().isUUID(),
    body('academicYearId').isUUID().withMessage('Academic year ID is required.'),
    body('semesterId').isUUID().withMessage('Semester ID is required.'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentIds, classId, divisionId, batchId, academicYearId, semesterId } = req.body as {
        studentIds: string[];
        classId: string;
        divisionId?: string;
        batchId?: string;
        academicYearId: string;
        semesterId: string;
      };

      const results = {
        enrolled: [] as string[],
        alreadyEnrolled: [] as string[],
        notFound: [] as string[],
      };

      for (const studentId of studentIds) {
        try {
          const student = await prisma.student.findUnique({ where: { id: studentId } });
          if (!student) {
            results.notFound.push(studentId);
            continue;
          }

          // Check existing active enrollment in same class+semester
          const existing = await prisma.enrollment.findFirst({
            where: {
              studentId,
              classId,
              semesterId,
              status: 'ACTIVE',
            },
          });

          if (existing) {
            results.alreadyEnrolled.push(studentId);
            continue;
          }

          await prisma.enrollment.create({
            data: {
              studentId,
              classId,
              divisionId: divisionId || null,
              batchId: batchId || null,
              academicYearId,
              semesterId,
              status: 'ACTIVE',
            },
          });

          results.enrolled.push(studentId);
        } catch {
          results.alreadyEnrolled.push(studentId);
        }
      }

      res.json({
        message: `${results.enrolled.length} enrolled, ${results.alreadyEnrolled.length} already enrolled, ${results.notFound.length} not found.`,
        ...results,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DELETE /api/admin/enrollments/:id ───────────────────────────────
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Invalid enrollment ID.')],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      const enrollment = await prisma.enrollment.findUnique({ where: { id } });
      if (!enrollment) return next(createError('Enrollment not found.', 404));

      await prisma.$transaction([
        prisma.enrollment.update({
          where: { id },
          data: { status: 'INACTIVE' },
        }),
        prisma.auditLog.create({
          data: {
            userId: req.user!.userId,
            action: AuditAction.ENROLLMENT_CHANGE,
            entityType: 'enrollment',
            entityId: id,
            afterData: { action: 'deactivated' },
          },
        }),
      ]);

      res.json({ message: 'Enrollment deactivated successfully.' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
