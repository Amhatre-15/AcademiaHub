/**
 * AcademiaHub — Load-Test Student Pool Generator
 * ────────────────────────────────────────────────────────────────────────────
 * Creates N synthetic students inside the E2E class, all with the same
 * password, and writes signed JWTs to `load-tests/tokens.json` so k6 can
 * simulate thousands of concurrent students without paying bcrypt login cost
 * inside the load generator.
 *
 * Usage (from repo root):
 *   npm run e2e:load-users --prefix backend                 # 1200 students
 *   LOAD_STUDENT_COUNT=2500 npm run e2e:load-users --prefix backend
 *
 * The generated files are git-ignored. They are test credentials only.
 */

import { PrismaClient, Role, UserStatus, EnrollmentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

const prisma = new PrismaClient();

const COUNT = Math.max(1, parseInt(process.env.LOAD_STUDENT_COUNT ?? '1200', 10));
const PASSWORD = process.env.LOAD_STUDENT_PASSWORD ?? 'Load@Test123';
const PREFIX = process.env.LOAD_STUDENT_PREFIX ?? 'load_student_';
const OUT_DIR = path.resolve(__dirname, '../../load-tests');

const BRANCH_CODE = 'E2E';
const YEAR = 'E2E-2026';
const LEVEL = 'E2E-SY';
const SEMESTER_NUMBER = 3;
const CLASS_NAME = 'E2E Class';
const DIVISION_NAME = 'A';
const BATCH_NAME = 'B1';

async function main() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET is missing from backend/.env');

  console.log(`🏗  Preparing ${COUNT} load-test students…`);

  const branch = await prisma.branch.findUnique({ where: { code: BRANCH_CODE } });
  const academicYear = await prisma.academicYear.findUnique({ where: { name: YEAR } });
  if (!branch || !academicYear) {
    throw new Error('E2E hierarchy missing. Run `npm run e2e:seed --prefix backend` first.');
  }

  const level = await prisma.academicLevel.findUnique({
    where: { branchId_name: { branchId: branch.id, name: LEVEL } },
  });
  if (!level) throw new Error('E2E academic level missing. Run the E2E seed first.');

  const semester = await prisma.semester.findUnique({
    where: {
      academicLevelId_academicYearId_number: {
        academicLevelId: level.id,
        academicYearId: academicYear.id,
        number: SEMESTER_NUMBER,
      },
    },
  });
  if (!semester) throw new Error('E2E semester missing. Run the E2E seed first.');

  const klass = await prisma.class.findUnique({
    where: {
      academicLevelId_academicYearId_semesterId_name: {
        academicLevelId: level.id,
        academicYearId: academicYear.id,
        semesterId: semester.id,
        name: CLASS_NAME,
      },
    },
  });
  if (!klass) throw new Error('E2E class missing. Run the E2E seed first.');

  const division = await prisma.division.findUnique({
    where: { classId_name: { classId: klass.id, name: DIVISION_NAME } },
  });
  const batch = division
    ? await prisma.batch.findUnique({
        where: { divisionId_name: { divisionId: division.id, name: BATCH_NAME } },
      })
    : null;

  if (!division || !batch) throw new Error('E2E division/batch missing. Run the E2E seed first.');

  // Capture non-null ids for use inside the provisioning closure (TypeScript
  // does not carry outer narrowing into nested functions).
  const classId = klass.id;
  const divisionId = division.id;
  const batchId = batch.id;
  const semesterId = semester.id;
  const academicYearId = academicYear.id;
  const signingSecret = jwtSecret;

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const usernames = Array.from({ length: COUNT }, (_, i) => `${PREFIX}${String(i + 1).padStart(4, '0')}`);

  const existing = new Set(
    (
      await prisma.user.findMany({
        where: { username: { in: usernames } },
        select: { username: true },
      })
    ).map((user) => user.username)
  );

  const tokens: Array<{ username: string; userId: string; token: string }> = [];
  let created = 0;

  async function provision(index: number, username: string) {
    const user = existing.has(username)
      ? await prisma.user.findUnique({ where: { username }, include: { student: true } })
      : await prisma.user.create({
          data: {
            username,
            passwordHash,
            role: Role.STUDENT,
            status: UserStatus.ACTIVE,
            firstLogin: false,
            student: {
              create: {
                firstName: 'Load',
                lastName: `Student${index + 1}`,
                prn: `LOAD${String(index + 1).padStart(4, '0')}`,
                status: UserStatus.ACTIVE,
              },
            },
          },
          include: { student: true },
        });

    if (!existing.has(username)) created++;
    if (!user?.student) return null;

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: user.student.id,
        classId,
        divisionId,
        batchId,
        semesterId,
      },
    });

    if (!enrollment) {
      await prisma.enrollment.create({
        data: {
          studentId: user.student.id,
          classId,
          divisionId,
          batchId,
          academicYearId,
          semesterId,
          status: EnrollmentStatus.ACTIVE,
        },
      });
    } else if (enrollment.status !== 'ACTIVE') {
      await prisma.enrollment.update({ where: { id: enrollment.id }, data: { status: 'ACTIVE' } });
    }

    return {
      username,
      userId: user.id,
      token: jwt.sign({ userId: user.id, role: 'STUDENT' }, signingSecret, { expiresIn: '7d' }),
    };
  }

  // Sequential creation against a remote pooler can take tens of minutes for
  // 1,200 students. Keep a bounded batch in flight (matching the Prisma
  // connection limit) to make the generator practical.
  const CONCURRENCY = 20;
  for (let start = 0; start < usernames.length; start += CONCURRENCY) {
    const batch = usernames.slice(start, start + CONCURRENCY);
    const provisioned = await Promise.all(
      batch.map((username, offset) => provision(start + offset, username))
    );

    for (const entry of provisioned) {
      if (entry) tokens.push(entry);
    }

    const done = Math.min(start + CONCURRENCY, usernames.length);
    if (done % 100 === 0 || done === usernames.length) {
      console.log(`   … ${done}/${usernames.length}`);
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outputFile = path.join(OUT_DIR, 'tokens.json');
  fs.writeFileSync(outputFile, JSON.stringify(tokens, null, 0), 'utf8');

  console.log('────────────────────────────────────────────────────────────');
  console.log(`✅ ${tokens.length} load-test students ready (${created} newly created)`);
  console.log(`   Password: ${PASSWORD}`);
  console.log(`   Tokens:   ${outputFile}`);
  console.log('   Run:      k6 run load-tests/attendance-rush.js');
  console.log('────────────────────────────────────────────────────────────');
}

main()
  .catch((error) => {
    console.error('❌ Load-student generation failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
