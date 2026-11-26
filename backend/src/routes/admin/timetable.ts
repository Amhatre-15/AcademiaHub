import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';

const router = Router();

// All routes require IT_ADMIN
router.use(requireAuth, requireRole('IT_ADMIN'));

// ─── GET /api/admin/timetable/slots ────────────────────────────────────
router.get('/slots', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slots = await prisma.timeSlot.findMany({
      orderBy: { order: 'asc' },
    });
    res.json({ slots });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/admin/timetable/lecture-types ────────────────────────────
router.get('/lecture-types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const types = await prisma.lectureType.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ types });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/admin/timetable ──────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId, semesterId } = req.query as { classId?: string; semesterId?: string };
    const entries = await prisma.timetableEntry.findMany({
      where: {
        ...(classId ? { classId: classId as string } : {}),
        ...(semesterId ? { semesterId: semesterId as string } : {}),
      },
      include: {
        subject: true,
        faculty: { include: { user: true } },
        lectureType: true,
        timeSlot: true,
        class: true,
        division: true,
        batch: true,
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { timeSlot: { order: 'asc' } }
      ]
    });
    res.json({ entries });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/admin/timetable ─────────────────────────────────────────
router.post(
  '/',
  [
    body('classId').isUUID().withMessage('classId must be a valid UUID'),
    body('divisionId').optional({ nullable: true }).isUUID(),
    body('batchId').optional({ nullable: true }).isUUID(),
    body('subjectId').isUUID(),
    body('facultyId').isUUID(),
    body('lectureTypeId').isUUID(),
    body('dayOfWeek').isInt({ min: 0, max: 6 }),
    body('timeSlotId').isUUID(),
    body('room').optional({ nullable: true }).isString(),
    body('academicYearId').isUUID(),
    body('semesterId').isUUID(),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;

      // Conflict Detection
      // 1. Same faculty at the same time
      const facultyConflict = await prisma.timetableEntry.findFirst({
        where: {
          facultyId: data.facultyId,
          dayOfWeek: data.dayOfWeek,
          timeSlotId: data.timeSlotId,
          academicYearId: data.academicYearId,
          isActive: true
        }
      });
      if (facultyConflict) {
        throw createError('Faculty is already assigned to a class during this time slot.', 400);
      }

      // 2. Same class/division/batch at the same time
      const classConflict = await prisma.timetableEntry.findFirst({
        where: {
          classId: data.classId,
          divisionId: data.divisionId || null,
          batchId: data.batchId || null,
          dayOfWeek: data.dayOfWeek,
          timeSlotId: data.timeSlotId,
          semesterId: data.semesterId,
          isActive: true
        }
      });
      if (classConflict) {
        throw createError('This class/division/batch already has a class scheduled at this time.', 400);
      }

      // 3. Same room at the same time
      if (data.room) {
        const roomConflict = await prisma.timetableEntry.findFirst({
          where: {
            room: data.room,
            dayOfWeek: data.dayOfWeek,
            timeSlotId: data.timeSlotId,
            academicYearId: data.academicYearId,
            isActive: true
          }
        });
        if (roomConflict) {
          throw createError(`Room ${data.room} is already booked during this time slot.`, 400);
        }
      }

      const entry = await prisma.timetableEntry.create({
        data,
        include: {
          subject: true,
          faculty: { include: { user: true } },
          lectureType: true,
          timeSlot: true,
        }
      });
      res.status(201).json({ message: 'Timetable entry created successfully', entry });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DELETE /api/admin/timetable/:id ───────────────────────────────────
router.delete(
  '/:id',
  [param('id').isUUID()],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.timetableEntry.delete({
        where: { id: req.params.id as string },
      });
      res.json({ message: 'Timetable entry deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/admin/timetable/bulk-parse ────────────────────────────
router.post(
  '/bulk-parse',
  [
    body('rawText').notEmpty().withMessage('Raw text is required.'),
    body('classId').isUUID().withMessage('classId is required'),
    body('semesterId').isUUID().withMessage('semesterId is required'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { rawText, classId, semesterId } = req.body;
      const parsed = parseTimetableBulkText(rawText);

      // Fetch DB mappings
      const subjectCodes = [...new Set(parsed.valid.map(r => r.subjectCode))];
      const subjects = await prisma.subject.findMany({ where: { code: { in: subjectCodes } } });
      const subjectMap = new Map(subjects.map(s => [s.code?.toLowerCase(), s.id]));

      const facultyUsernames = [...new Set(parsed.valid.map(r => r.facultyUsername))];
      const faculties = await prisma.faculty.findMany({
        where: { user: { username: { in: facultyUsernames } } },
        include: { user: true }
      });
      const facultyMap = new Map(faculties.map(f => [f.user.username.toLowerCase(), f.id]));

      const lectureTypeCodes = [...new Set(parsed.valid.map(r => r.lectureTypeCode))];
      const lectureTypes = await prisma.lectureType.findMany({ where: { code: { in: lectureTypeCodes } } });
      const lectureTypeMap = new Map(lectureTypes.map(lt => [lt.code.toLowerCase(), lt.id]));

      const timeSlots = await prisma.timeSlot.findMany();
      const timeSlotMap = new Map(timeSlots.map(ts => [`${ts.startTime}-${ts.endTime}`, ts.id]));

      const classRecord = await prisma.class.findUnique({
        where: { id: classId },
        include: { divisions: { include: { batches: true } } }
      });
      if (!classRecord) throw createError('Class not found', 404);

      const divisionMap = new Map(classRecord.divisions.map(d => [d.name.toLowerCase(), d.id]));
      const batchMap = new Map(classRecord.divisions.flatMap(d => d.batches).map(b => [b.name.toLowerCase(), b.id]));

      const resolvedValid = [];
      const newInvalid = [...parsed.invalid];

      for (const row of parsed.valid) {
        const subjectId = subjectMap.get(row.subjectCode.toLowerCase());
        const facultyId = facultyMap.get(row.facultyUsername.toLowerCase());
        const lectureTypeId = lectureTypeMap.get(row.lectureTypeCode.toLowerCase());
        
        let divisionId = null;
        if (row.division) {
          divisionId = divisionMap.get(row.division.toLowerCase());
          if (!divisionId) {
            newInvalid.push({ ...row, reason: `Division '${row.division}' not found in this class` });
            continue;
          }
        }
        
        let batchId = null;
        if (row.batch) {
          batchId = batchMap.get(row.batch.toLowerCase());
          if (!batchId) {
            newInvalid.push({ ...row, reason: `Batch '${row.batch}' not found in this class` });
            continue;
          }
        }

        if (!subjectId) {
          newInvalid.push({ ...row, reason: `Subject code '${row.subjectCode}' not found` });
          continue;
        }
        if (!facultyId) {
          newInvalid.push({ ...row, reason: `Faculty username '${row.facultyUsername}' not found` });
          continue;
        }
        if (!lectureTypeId) {
          newInvalid.push({ ...row, reason: `Lecture type code '${row.lectureTypeCode}' not found` });
          continue;
        }

        let timeSlotId = timeSlotMap.get(`${row.startTime}-${row.endTime}`);
        if (!timeSlotId) {
          newInvalid.push({ ...row, reason: `Time slot ${row.startTime}-${row.endTime} not found in database.` });
          continue;
        }

        resolvedValid.push({
          ...row,
          subjectId,
          facultyId,
          lectureTypeId,
          divisionId,
          batchId,
          timeSlotId,
          academicYearId: classRecord.academicYearId,
          semesterId: classRecord.semesterId
        });
      }

      res.json({
        valid: resolvedValid,
        invalid: newInvalid,
        summary: {
          totalRows: parsed.valid.length + parsed.invalid.length,
          validRows: resolvedValid.length,
          invalidRows: newInvalid.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/admin/timetable/bulk-import ─────────────────────────────
router.post(
  '/bulk-import',
  [
    body('entries').isArray({ min: 1 }).withMessage('Entries array must have at least one entry.'),
    body('classId').isUUID().withMessage('classId is required'),
    body('semesterId').isUUID().withMessage('semesterId is required'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entries, classId, semesterId } = req.body;

      const results = {
        success: 0,
        skipped: [] as any[],
        errors: [] as any[]
      };

      for (const entry of entries) {
        try {
          // Conflict Detection
          const facultyConflict = await prisma.timetableEntry.findFirst({
            where: {
              facultyId: entry.facultyId,
              dayOfWeek: entry.dayOfWeek,
              timeSlotId: entry.timeSlotId,
              academicYearId: entry.academicYearId,
              isActive: true
            }
          });
          if (facultyConflict) {
            results.skipped.push({ rowNumber: entry.rowNumber, reason: 'Faculty is already assigned to a class during this time slot.' });
            continue;
          }

          const classConflict = await prisma.timetableEntry.findFirst({
            where: {
              classId: classId,
              divisionId: entry.divisionId || null,
              batchId: entry.batchId || null,
              dayOfWeek: entry.dayOfWeek,
              timeSlotId: entry.timeSlotId,
              semesterId: semesterId,
              isActive: true
            }
          });
          if (classConflict) {
            results.skipped.push({ rowNumber: entry.rowNumber, reason: 'This class/division/batch already has a class scheduled at this time.' });
            continue;
          }

          if (entry.room) {
            const roomConflict = await prisma.timetableEntry.findFirst({
              where: {
                room: entry.room,
                dayOfWeek: entry.dayOfWeek,
                timeSlotId: entry.timeSlotId,
                academicYearId: entry.academicYearId,
                isActive: true
              }
            });
            if (roomConflict) {
              results.skipped.push({ rowNumber: entry.rowNumber, reason: `Room ${entry.room} is already booked during this time slot.` });
              continue;
            }
          }

          const duplicate = await prisma.timetableEntry.findFirst({
            where: {
              classId: classId,
              divisionId: entry.divisionId || null,
              batchId: entry.batchId || null,
              subjectId: entry.subjectId,
              facultyId: entry.facultyId,
              dayOfWeek: entry.dayOfWeek,
              timeSlotId: entry.timeSlotId,
              semesterId: semesterId
            }
          });

          if (duplicate) {
            results.skipped.push({ rowNumber: entry.rowNumber, reason: 'Identical entry already exists.' });
            continue;
          }

          await prisma.timetableEntry.create({
            data: {
              classId: classId,
              divisionId: entry.divisionId || null,
              batchId: entry.batchId || null,
              subjectId: entry.subjectId,
              facultyId: entry.facultyId,
              lectureTypeId: entry.lectureTypeId,
              dayOfWeek: entry.dayOfWeek,
              timeSlotId: entry.timeSlotId,
              room: entry.room || null,
              academicYearId: entry.academicYearId,
              semesterId: semesterId
            }
          });

          results.success++;
        } catch (err: any) {
          results.errors.push({ rowNumber: entry.rowNumber, reason: err.message || 'Unknown error' });
        }
      }

      res.status(200).json({
        message: `Import complete: ${results.success} created, ${results.skipped.length} skipped, ${results.errors.length} errors.`,
        ...results
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── HELPER: Parse CSV text ────────────────────────────────────────────
function parseTimetableBulkText(rawText: string): { valid: any[]; invalid: any[] } {
  const valid: any[] = [];
  const invalid: any[] = [];
  const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const separator = rawText.includes('\t') ? '\t' : ',';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rowNumber = i + 1;
    if (i === 0 && line.toLowerCase().includes('subject')) continue;

    const parts = line.split(separator).map(p => p.trim());
    if (parts.length < 8) {
      invalid.push({ rowNumber, rawLine: line, reason: `Expected at least 8 columns, found ${parts.length}` });
      continue;
    }

    const division = parts[0] || null;
    const batch = parts[1] || null;
    const subjectCode = parts[2];
    const facultyUsername = parts[3];
    const lectureTypeCode = parts[4];
    const dayStr = parts[5];
    const startTime = parts[6];
    const endTime = parts[7];
    const room = parts[8] || null;

    if (!subjectCode || !facultyUsername || !lectureTypeCode || !dayStr || !startTime || !endTime) {
      invalid.push({ rowNumber, rawLine: line, reason: 'Missing required fields' });
      continue;
    }

    const dayMap: Record<string, number> = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6,
      'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6,
      '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6
    };
    
    const dayOfWeek = dayMap[dayStr.toLowerCase()];
    if (dayOfWeek === undefined) {
      invalid.push({ rowNumber, rawLine: line, reason: `Invalid day format: ${dayStr}` });
      continue;
    }

    valid.push({ rowNumber, division, batch, subjectCode, facultyUsername, lectureTypeCode, dayOfWeek, startTime, endTime, room });
  }
  return { valid, invalid };
}

export default router;
