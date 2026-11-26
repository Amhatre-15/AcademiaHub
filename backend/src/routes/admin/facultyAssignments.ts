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

// ─── GET /api/admin/faculty-assignments ──────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { facultyId, classId, semesterId, academicYearId } = req.query as {
      facultyId?: string;
      classId?: string;
      semesterId?: string;
      academicYearId?: string;
    };

    const assignments = await prisma.facultyAssignment.findMany({
      where: {
        ...(facultyId && { facultyId }),
        ...(classId && { classId }),
        ...(semesterId && { semesterId }),
        ...(academicYearId && { academicYearId }),
        status: 'ACTIVE',
      },
      include: {
        faculty: { select: { id: true, firstName: true, lastName: true } },
        subject: true,
        class: {
          include: { academicLevel: { include: { branch: true } } },
        },
        division: true,
        batch: true,
        semester: true,
        academicYear: true,
      },
      orderBy: [{ faculty: { firstName: 'asc' } }, { subject: { name: 'asc' } }],
    });

    res.json({ assignments });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/admin/faculty-assignments ──────────────────────────────
router.post(
  '/',
  [
    body('facultyId').isUUID().withMessage('Faculty ID is required.'),
    body('subjectId').isUUID().withMessage('Subject ID is required.'),
    body('classId').isUUID().withMessage('Class ID is required.'),
    body('divisionId').optional().isUUID(),
    body('batchId').optional().isUUID(),
    body('academicYearId').isUUID().withMessage('Academic year ID is required.'),
    body('semesterId').isUUID().withMessage('Semester ID is required.'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        facultyId,
        subjectId,
        classId,
        divisionId,
        batchId,
        academicYearId,
        semesterId,
      } = req.body as {
        facultyId: string;
        subjectId: string;
        classId: string;
        divisionId?: string;
        batchId?: string;
        academicYearId: string;
        semesterId: string;
      };

      // Verify all entities exist
      const [faculty, subject, cls] = await Promise.all([
        prisma.faculty.findUnique({ where: { id: facultyId } }),
        prisma.subject.findUnique({ where: { id: subjectId } }),
        prisma.class.findUnique({ where: { id: classId } }),
      ]);

      if (!faculty) return next(createError('Faculty member not found.', 404));
      if (!subject) return next(createError('Subject not found.', 404));
      if (!cls) return next(createError('Class not found.', 404));

      const assignment = await prisma.facultyAssignment.create({
        data: {
          facultyId,
          subjectId,
          classId,
          divisionId: divisionId || null,
          batchId: batchId || null,
          academicYearId,
          semesterId,
          status: 'ACTIVE',
        },
        include: {
          faculty: { select: { id: true, firstName: true, lastName: true } },
          subject: true,
          class: { include: { academicLevel: { include: { branch: true } } } },
          division: true,
          batch: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: AuditAction.FACULTY_ASSIGNMENT_CHANGE,
          entityType: 'faculty_assignment',
          entityId: assignment.id,
          afterData: { facultyId, subjectId, classId, divisionId, batchId },
        },
      });

      res.status(201).json({ assignment });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DELETE /api/admin/faculty-assignments/:id ────────────────────────
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Invalid assignment ID.')],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      const assignment = await prisma.facultyAssignment.findUnique({ where: { id } });
      if (!assignment) return next(createError('Assignment not found.', 404));

      await prisma.$transaction([
        prisma.facultyAssignment.update({
          where: { id },
          data: { status: 'INACTIVE' },
        }),
        prisma.auditLog.create({
          data: {
            userId: req.user!.userId,
            action: AuditAction.FACULTY_ASSIGNMENT_CHANGE,
            entityType: 'faculty_assignment',
            entityId: id,
            beforeData: { status: 'ACTIVE' },
            afterData: { status: 'INACTIVE', action: 'deactivated' },
          },
        }),
      ]);

      res.json({ message: 'Faculty assignment deactivated successfully.' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
