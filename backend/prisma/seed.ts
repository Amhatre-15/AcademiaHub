import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ─── Institution Settings ────────────────────────────────────────
  await prisma.institutionSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      name: process.env['INSTITUTION_NAME'] ?? 'AcademiaHub College',
      timezone: process.env['INSTITUTION_TIMEZONE'] ?? 'Asia/Kolkata',
      attendanceCodeLength: 4,
      attendanceCodeExpirySeconds: 60,
      maxFileSizeMb: 50,
    },
  });
  console.log('✅ Institution settings seeded');

  // ─── IT Admin ────────────────────────────────────────────────────
  const adminUsername = process.env['INITIAL_ADMIN_USERNAME'] ?? 'admin';
  const adminPassword = process.env['INITIAL_ADMIN_PASSWORD'] ?? 'Admin@sspu2024';
  const adminHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      passwordHash: adminHash,
      role: 'IT_ADMIN',
      firstLogin: false, // Admin doesn't need to change password on first boot
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Admin user seeded: ${adminUsername}`);

  // ─── Lecture Types ────────────────────────────────────────────────
  const lectureTypes = [
    { code: 'L', name: 'Lecture', description: 'Traditional classroom lecture' },
    { code: 'P', name: 'Practical', description: 'Lab or hands-on practical session' },
    { code: 'S', name: 'Seminar', description: 'Student-presented seminar' },
    { code: 'D', name: 'Discussion', description: 'Group discussion session' },
    { code: 'T', name: 'Tutorial', description: 'Tutorial / problem-solving session' },
  ];

  for (const lt of lectureTypes) {
    await prisma.lectureType.upsert({
      where: { code: lt.code },
      update: { name: lt.name, description: lt.description },
      create: lt,
    });
  }
  console.log('✅ Lecture types seeded');

  // ─── Time Slots ───────────────────────────────────────────────────
  // Based on plan.md section 18
  const timeSlots = [
    { startTime: '09:30', endTime: '10:30', isBreak: false, order: 1 },
    { startTime: '10:30', endTime: '11:30', isBreak: false, order: 2 },
    { startTime: '11:30', endTime: '11:45', isBreak: true, breakName: 'Short Break', order: 3 },
    { startTime: '11:45', endTime: '12:45', isBreak: false, order: 4 },
    { startTime: '12:45', endTime: '13:45', isBreak: false, order: 5 },
    { startTime: '13:45', endTime: '14:30', isBreak: true, breakName: 'Lunch Break', order: 6 },
    { startTime: '14:30', endTime: '15:30', isBreak: false, order: 7 },
    { startTime: '15:30', endTime: '16:30', isBreak: false, order: 8 },
  ];

  for (const slot of timeSlots) {
    await prisma.timeSlot.upsert({
      where: { startTime_endTime: { startTime: slot.startTime, endTime: slot.endTime } },
      update: {},
      create: slot,
    });
  }
  console.log('✅ Time slots seeded');

  // ─── Academic Structure (B.Sc Data Science SY) ───────────────────
  // From plan.md section 19 — real timetable data
  const branch = await prisma.branch.upsert({
    where: { code: 'BSCD' },
    update: {},
    create: {
      name: 'B.Sc Data Science',
      code: 'BSCD',
      description: 'Bachelor of Science in Data Science',
    },
  });
  console.log(`✅ Branch seeded: ${branch.name}`);

  const academicYear = await prisma.academicYear.upsert({
    where: { name: '2024-25' },
    update: { isActive: true },
    create: {
      name: '2024-25',
      startDate: new Date('2024-06-01'),
      endDate: new Date('2025-05-31'),
      isActive: true,
    },
  });
  console.log(`✅ Academic year seeded: ${academicYear.name}`);

  const syLevel = await prisma.academicLevel.upsert({
    where: { branchId_name: { branchId: branch.id, name: 'SY' } },
    update: {},
    create: {
      branchId: branch.id,
      name: 'SY',
      description: 'Second Year',
      order: 2,
    },
  });
  console.log(`✅ Academic level seeded: SY`);

  const semester3 = await prisma.semester.upsert({
    where: {
      academicLevelId_academicYearId_number: {
        academicLevelId: syLevel.id,
        academicYearId: academicYear.id,
        number: 3,
      },
    },
    update: { isActive: true },
    create: {
      academicLevelId: syLevel.id,
      academicYearId: academicYear.id,
      number: 3,
      startDate: new Date('2024-06-15'),
      endDate: new Date('2024-11-30'),
      isActive: true,
    },
  });
  console.log(`✅ Semester seeded: Semester III`);

  const syClass = await prisma.class.upsert({
    where: {
      academicLevelId_academicYearId_semesterId_name: {
        academicLevelId: syLevel.id,
        academicYearId: academicYear.id,
        semesterId: semester3.id,
        name: 'SY B.Sc DS Sem III',
      },
    },
    update: {},
    create: {
      academicLevelId: syLevel.id,
      academicYearId: academicYear.id,
      semesterId: semester3.id,
      name: 'SY B.Sc DS Sem III',
    },
  });
  console.log(`✅ Class seeded: ${syClass.name}`);

  // Division (single division for B.Sc DS SY — the plan mentions B1/B2 are batches)
  const divisionA = await prisma.division.upsert({
    where: { classId_name: { classId: syClass.id, name: 'A' } },
    update: {},
    create: {
      classId: syClass.id,
      name: 'A',
    },
  });

  const b1 = await prisma.batch.upsert({
    where: { divisionId_name: { divisionId: divisionA.id, name: 'B1' } },
    update: {},
    create: { divisionId: divisionA.id, name: 'B1' },
  });
  const b2 = await prisma.batch.upsert({
    where: { divisionId_name: { divisionId: divisionA.id, name: 'B2' } },
    update: {},
    create: { divisionId: divisionA.id, name: 'B2' },
  });
  console.log(`✅ Division & Batches seeded: A / B1, B2`);

  // ─── Subjects ─────────────────────────────────────────────────────
  const subjectData = [
    { name: 'Apache Spark & Big Data', code: 'APACHE' },
    { name: 'Cloud Computing', code: 'CLOUD' },
    { name: 'Data Visualization', code: 'DV' },
    { name: 'Data Science Capstone', code: 'DSC' },
    { name: 'Introduction to Deep Learning', code: 'INTRO_DL' },
    { name: 'Constitution of India', code: 'COI' },
    { name: 'Interview Preparation', code: 'INTPREP' },
    { name: 'HackerRank Practice', code: 'HACKRANK' },
    { name: 'VAC', code: 'VAC' },
    { name: 'Mentor Mentee', code: 'MENTOR' },
    { name: 'Club Activity', code: 'CLUB' },
  ];

  const subjects: Record<string, string> = {};
  for (const s of subjectData) {
    const subject = await prisma.subject.upsert({
      where: { code: s.code },
      update: {},
      create: { ...s, branchId: branch.id },
    });
    subjects[s.code] = subject.id;
  }
  console.log(`✅ Subjects seeded: ${subjectData.length}`);

  // ─── Faculty ──────────────────────────────────────────────────────
  const facultyData = [
    { firstName: 'Mandar', lastName: 'P', username: 'Mandar' },
    { firstName: 'Parag', lastName: 'Joshi', username: 'Parag' },
    { firstName: 'Pragati', lastName: 'D', username: 'Pragati' },
    { firstName: 'Abhijeet', lastName: 'T', username: 'Abhijeet' },
  ];

  const facultyIds: Record<string, string> = {};
  const defaultFacultyPassword = await bcrypt.hash('sspu@123', 12);

  for (const f of facultyData) {
    const existingUser = await prisma.user.findUnique({ where: { username: f.username } });

    if (!existingUser) {
      const user = await prisma.user.create({
        data: {
          username: f.username,
          passwordHash: defaultFacultyPassword,
          role: 'FACULTY',
          firstLogin: true,
          status: 'ACTIVE',
          faculty: {
            create: {
              firstName: f.firstName,
              lastName: f.lastName,
            },
          },
        },
        include: { faculty: true },
      });
      facultyIds[f.username] = user.faculty!.id;
      console.log(`  Created faculty: ${f.username}`);
    } else {
      const faculty = await prisma.faculty.findUnique({ where: { userId: existingUser.id } });
      if (faculty) {
        facultyIds[f.username] = faculty.id;
      }
    }
  }
  console.log(`✅ Faculty seeded`);

  // ─── Faculty Assignments ──────────────────────────────────────────
  const assignments = [
    // Mandar P → Apache, Cloud
    { facultyUsername: 'Mandar', subjectCode: 'APACHE' },
    { facultyUsername: 'Mandar', subjectCode: 'CLOUD' },
    // Parag Joshi → DV, DSC
    { facultyUsername: 'Parag', subjectCode: 'DV' },
    { facultyUsername: 'Parag', subjectCode: 'DSC' },
    // Pragati D → Intro DL
    { facultyUsername: 'Pragati', subjectCode: 'INTRO_DL' },
    // Abhijeet T → HackerRank, Interview Prep
    { facultyUsername: 'Abhijeet', subjectCode: 'HACKRANK' },
    { facultyUsername: 'Abhijeet', subjectCode: 'INTPREP' },
  ];

  for (const a of assignments) {
    const facultyId = facultyIds[a.facultyUsername];
    const subjectId = subjects[a.subjectCode];
    if (!facultyId || !subjectId) continue;

    try {
      await prisma.facultyAssignment.create({
        data: {
          facultyId,
          subjectId,
          classId: syClass.id,
          divisionId: divisionA.id,
          academicYearId: academicYear.id,
          semesterId: semester3.id,
          status: 'ACTIVE',
        },
      });
    } catch {
      // Skip if already exists
    }
  }
  console.log(`✅ Faculty assignments seeded`);

  // ─── Badges ───────────────────────────────────────────────────────
  const badges = [
    { name: 'Perfect Attendee', description: '100% attendance for a month', icon: '🎯', criteriaType: 'ATTENDANCE_STREAK', criteriaValue: 20 },
    { name: 'Quiz Master', description: 'Score 100% on 5 quizzes', icon: '🧠', criteriaType: 'QUIZ_PERFECT', criteriaValue: 5 },
    { name: 'Early Bird', description: 'Submit START code first 10 times', icon: '🌅', criteriaType: 'EARLY_ATTENDANCE', criteriaValue: 10 },
    { name: 'Streak Keeper', description: 'Maintain a 7-day attendance streak', icon: '🔥', criteriaType: 'STREAK', criteriaValue: 7 },
    { name: 'Engaged Learner', description: 'Earn 500 XP', icon: '⭐', criteriaType: 'XP', criteriaValue: 500 },
  ];

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { name: badge.name },
      update: {},
      create: badge,
    });
  }
  console.log(`✅ Badges seeded`);

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Initial Credentials:');
  console.log(`   Admin: ${process.env['INITIAL_ADMIN_USERNAME'] ?? 'admin'} / ${process.env['INITIAL_ADMIN_PASSWORD'] ?? 'Admin@sspu2024'}`);
  console.log(`   Faculty default password: sspu@123 (must change on first login)`);
  console.log(`   Student password: PRN (must change on first login)`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
