/**
 * AcademiaHub — Deterministic E2E Dataset Seeder
 * ────────────────────────────────────────────────────────────────────────────
 * Creates an isolated, self-contained test fixture under the `E2E-*` namespace:
 *
 *   • Admin / Faculty / two Students (password: E2e@Test123)
 *   • A dedicated branch → level → year → semester → class → division → batch
 *   • One subject + faculty assignment
 *   • One timetable entry scheduled for *today* (so "Start Class" is clickable)
 *
 * The script is idempotent: re-running it repairs the fixture and resets any
 * orphaned ACTIVE sessions / quizzes left behind by a previously failed run.
 *
 * Usage (from repo root):
 *   npm run e2e:seed --prefix backend
 */

import { PrismaClient, Role, UserStatus, EnrollmentStatus, FacultyAssignmentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

// ── Shared fixture constants (mirrored in e2e/fixtures.ts) ───────────────────
const PASSWORD = 'E2e@Test123';

const BRANCH = { code: 'E2E', name: 'E2E Institute' };
const YEAR = 'E2E-2026';
const LEVEL = 'E2E-SY';
const SEMESTER_NUMBER = 3;
const CLASS_NAME = 'E2E Class';
const DIVISION_NAME = 'A';
const BATCH_NAME = 'B1';
const SUBJECT = { code: 'E2E-SUB', name: 'E2E Software Engineering' };
const ROOM = 'E2E-ROOM';

/**
 * DWARF: build a slot that contains "now" so the schedule watchdog never treats
 * a test session as stale (it closes sessions 30 minutes after slot end).
 */
function currentSlot(): { startTime: string; endTime: string } {
  const pad = (value: number) => String(value).padStart(2, '0');
  const now = new Date();
  const start = new Date(now.getTime() - 15 * 60 * 1000);
  const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  return {
    startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    endTime: end.getDate() === now.getDate() ? `${pad(end.getHours())}:${pad(end.getMinutes())}` : '23:59',
  };
}

const ADMIN_USERNAME = 'e2e_admin';
const FACULTY_USERNAME = 'e2e_faculty';
const STUDENT_A_USERNAME = 'e2e_student_a';
const STUDENT_B_USERNAME = 'e2e_student_b';

async function main() {
  console.log('🌱 Seeding E2E fixture dataset…');

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // ── 1. Academic hierarchy ────────────────────────────────────────────────
  const branch = await prisma.branch.upsert({
    where: { code: BRANCH.code },
    update: { name: BRANCH.name, isActive: true },
    create: { ...BRANCH, description: 'Automated E2E test branch', isActive: true },
  });

  const academicYear = await prisma.academicYear.upsert({
    where: { name: YEAR },
    update: {},
    create: {
      name: YEAR,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-05-31'),
      isActive: true,
    },
  });

  const level = await prisma.academicLevel.upsert({
    where: { branchId_name: { branchId: branch.id, name: LEVEL } },
    update: { order: 2 },
    create: { branchId: branch.id, name: LEVEL, order: 2 },
  });

  const semester = await prisma.semester.upsert({
    where: {
      academicLevelId_academicYearId_number: {
        academicLevelId: level.id,
        academicYearId: academicYear.id,
        number: SEMESTER_NUMBER,
      },
    },
    update: {},
    create: {
      academicLevelId: level.id,
      academicYearId: academicYear.id,
      number: SEMESTER_NUMBER,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-12-31'),
      isActive: true,
    },
  });

  const klass = await prisma.class.upsert({
    where: {
      academicLevelId_academicYearId_semesterId_name: {
        academicLevelId: level.id,
        academicYearId: academicYear.id,
        semesterId: semester.id,
        name: CLASS_NAME,
      },
    },
    update: { isActive: true },
    create: {
      academicLevelId: level.id,
      academicYearId: academicYear.id,
      semesterId: semester.id,
      name: CLASS_NAME,
      isActive: true,
    },
  });

  const division = await prisma.division.upsert({
    where: { classId_name: { classId: klass.id, name: DIVISION_NAME } },
    update: { isActive: true },
    create: { classId: klass.id, name: DIVISION_NAME, isActive: true },
  });

  const batch = await prisma.batch.upsert({
    where: { divisionId_name: { divisionId: division.id, name: BATCH_NAME } },
    update: { isActive: true },
    create: { divisionId: division.id, name: BATCH_NAME, isActive: true },
  });

  const subject = await prisma.subject.upsert({
    where: { code: SUBJECT.code },
    update: { name: SUBJECT.name, isActive: true },
    create: { ...SUBJECT, branchId: branch.id, isActive: true },
  });

  // Lecture type is created by the base seed; create it defensively anyway.
  const lectureType = await prisma.lectureType.upsert({
    where: { code: 'L' },
    update: {},
    create: { code: 'L', name: 'Lecture' },
  });

  const slot = currentSlot();
  const timeSlot = await prisma.timeSlot.upsert({
    where: { startTime_endTime: slot },
    update: {},
    create: { ...slot, order: 1 },
  });

  // ── 2. Users & profiles ──────────────────────────────────────────────────
  async function ensureUser(username: string, role: Role) {
    return prisma.user.upsert({
      where: { username },
      update: { passwordHash, role, status: UserStatus.ACTIVE, firstLogin: false },
      create: {
        username,
        passwordHash,
        role,
        status: UserStatus.ACTIVE,
        firstLogin: false,
      },
    });
  }

  await ensureUser(ADMIN_USERNAME, Role.IT_ADMIN);

  const facultyUser = await ensureUser(FACULTY_USERNAME, Role.FACULTY);
  const faculty = await prisma.faculty.upsert({
    where: { userId: facultyUser.id },
    update: { firstName: 'E2E', lastName: 'Faculty', employeeId: 'E2E-FAC-1', status: UserStatus.ACTIVE },
    create: {
      userId: facultyUser.id,
      firstName: 'E2E',
      lastName: 'Faculty',
      employeeId: 'E2E-FAC-1',
      status: UserStatus.ACTIVE,
    },
  });

  const studentAUser = await ensureUser(STUDENT_A_USERNAME, Role.STUDENT);
  const studentA = await prisma.student.upsert({
    where: { userId: studentAUser.id },
    update: { firstName: 'E2E', lastName: 'StudentA', prn: 'E2E0001', status: UserStatus.ACTIVE },
    create: {
      userId: studentAUser.id,
      firstName: 'E2E',
      lastName: 'StudentA',
      prn: 'E2E0001',
      status: UserStatus.ACTIVE,
    },
  });

  const studentBUser = await ensureUser(STUDENT_B_USERNAME, Role.STUDENT);
  const studentB = await prisma.student.upsert({
    where: { userId: studentBUser.id },
    update: { firstName: 'E2E', lastName: 'StudentB', prn: 'E2E0002', status: UserStatus.ACTIVE },
    create: {
      userId: studentBUser.id,
      firstName: 'E2E',
      lastName: 'StudentB',
      prn: 'E2E0002',
      status: UserStatus.ACTIVE,
    },
  });

  // ── 3. Faculty assignment ────────────────────────────────────────────────
  const existingAssignment = await prisma.facultyAssignment.findFirst({
    where: {
      facultyId: faculty.id,
      subjectId: subject.id,
      classId: klass.id,
      divisionId: division.id,
      batchId: batch.id,
      semesterId: semester.id,
    },
  });

  if (existingAssignment) {
    await prisma.facultyAssignment.update({
      where: { id: existingAssignment.id },
      data: { status: FacultyAssignmentStatus.ACTIVE },
    });
  } else {
    await prisma.facultyAssignment.create({
      data: {
        facultyId: faculty.id,
        subjectId: subject.id,
        classId: klass.id,
        divisionId: division.id,
        batchId: batch.id,
        academicYearId: academicYear.id,
        semesterId: semester.id,
        status: FacultyAssignmentStatus.ACTIVE,
      },
    });
  }

  // ── 4. Enrollments ───────────────────────────────────────────────────────
  for (const student of [studentA, studentB]) {
    const existing = await prisma.enrollment.findFirst({
      where: {
        studentId: student.id,
        classId: klass.id,
        divisionId: division.id,
        batchId: batch.id,
        semesterId: semester.id,
      },
    });

    if (existing) {
      await prisma.enrollment.update({
        where: { id: existing.id },
        data: { status: EnrollmentStatus.ACTIVE, academicYearId: academicYear.id },
      });
    } else {
      await prisma.enrollment.create({
        data: {
          studentId: student.id,
          classId: klass.id,
          divisionId: division.id,
          batchId: batch.id,
          academicYearId: academicYear.id,
          semesterId: semester.id,
          status: EnrollmentStatus.ACTIVE,
        },
      });
    }
  }

  // ── 5. Timetable entry for today ─────────────────────────────────────────
  // UI timetables render Monday(1) … Saturday(6); fall back to Monday on Sunday.
  const today = new Date().getDay();
  const dayOfWeek = today === 0 ? 1 : today;

  // Reuse the same class/day entry across runs so the faculty timetable never
  // accumulates duplicate "Start Class" buttons; only its time slot moves.
  let entry = await prisma.timetableEntry.findFirst({
    where: {
      facultyId: faculty.id,
      classId: klass.id,
      divisionId: division.id,
      batchId: batch.id,
      dayOfWeek,
      semesterId: semester.id,
    },
  });

  if (entry) {
    entry = await prisma.timetableEntry.update({
      where: { id: entry.id },
      data: {
        isActive: true,
        room: ROOM,
        lectureTypeId: lectureType.id,
        timeSlotId: timeSlot.id,
      },
    });
  } else {
    entry = await prisma.timetableEntry.create({
      data: {
        facultyId: faculty.id,
        classId: klass.id,
        divisionId: division.id,
        batchId: batch.id,
        subjectId: subject.id,
        lectureTypeId: lectureType.id,
        dayOfWeek,
        timeSlotId: timeSlot.id,
        room: ROOM,
        academicYearId: academicYear.id,
        semesterId: semester.id,
        isActive: true,
      },
    });
  }

  // Only the current entry may be active; hide leftovers from earlier runs
  // (other weekdays / older dynamic slots).
  await prisma.timetableEntry.updateMany({
    where: { classId: klass.id, id: { not: entry.id } },
    data: { isActive: false },
  });

  // ── 6. Reset leftovers from failed runs ──────────────────────────────────
  const now = new Date();

  await prisma.attendanceCheckpoint.updateMany({
    where: { session: { facultyId: faculty.id }, isActive: true },
    data: { isActive: false, closedAt: now },
  });

  const closed = await prisma.classSession.updateMany({
    where: { facultyId: faculty.id, status: 'ACTIVE' },
    data: { status: 'CLOSED', actualEnd: now },
  });

  await prisma.quiz.updateMany({
    where: { facultyId: faculty.id, status: 'ACTIVE' },
    data: { status: 'CLOSED', endedAt: now },
  });

  // Deterministic XP for the journey assertions (attendance + quiz events).
  await prisma.engagementEvent.deleteMany({
    where: { studentId: { in: [studentA.id, studentB.id] } },
  });
  await prisma.studentEngagement.updateMany({
    where: { studentId: { in: [studentA.id, studentB.id] } },
    data: { totalXp: 0, level: 1, streak: 0, lastActive: null },
  });

  console.log('────────────────────────────────────────────────────────────');
  console.log('✅ E2E fixture ready');
  console.log(`   Admin:    ${ADMIN_USERNAME} / ${PASSWORD}`);
  console.log(`   Faculty:  ${FACULTY_USERNAME} / ${PASSWORD}`);
  console.log(`   Student:  ${STUDENT_A_USERNAME} / ${PASSWORD}`);
  console.log(`   Student:  ${STUDENT_B_USERNAME} / ${PASSWORD}`);
  console.log(`   Class:    ${CLASS_NAME} (${division.name} / ${batch.name})`);
  console.log(`   Timetable entry: ${entry.id} (day ${dayOfWeek}, ${slot.startTime}-${slot.endTime})`);
  if (closed.count > 0) console.log(`   Auto-closed ${closed.count} orphaned session(s)`);
  console.log('────────────────────────────────────────────────────────────');
}

main()
  .catch((error) => {
    console.error('❌ E2E fixture seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
