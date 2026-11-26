import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';

/**
 * GET /api/student/attendance
 * Returns overall and per-subject attendance summary for the authenticated student.
 */
export const getAttendanceSummary = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;

    if (!studentId) {
      return res.status(403).json({ error: 'Student profile not found' });
    }

    // Get all active enrollments to know which classes this student is in
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId, status: 'ACTIVE' },
      include: {
        class: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
        batch: { select: { id: true, name: true } },
      },
    });

    if (enrollments.length === 0) {
      return res.json({ overall: null, bySubject: [], sessions: [] });
    }

    // Get all attendance records for this student
    const records = await prisma.attendanceRecord.findMany({
      where: { studentId },
      include: {
        session: {
          select: {
            id: true,
            date: true,
            scheduledStart: true,
            scheduledEnd: true,
            status: true,
            subject: { select: { id: true, name: true } },
            class: { select: { id: true, name: true } },
            division: { select: { id: true, name: true } },
            batch: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { session: { date: 'desc' } },
    });

    // Overall summary
    const total = records.length;
    const present = records.filter(r => r.finalStatus === 'PRESENT').length;
    const partial = records.filter(r => r.finalStatus === 'PARTIAL').length;
    const late = records.filter(r => r.finalStatus === 'LATE').length;
    const absent = records.filter(r => r.finalStatus === 'ABSENT').length;
    const excused = records.filter(r => r.finalStatus === 'EXCUSED').length;

    // Attendance percentage: present + partial*0.5 + late*0.5 counts toward attended
    const attendedClasses = present + (partial + late) * 0.5;
    const attendancePercentage = total > 0 ? Math.round((attendedClasses / total) * 100) : 0;

    // Per-subject breakdown
    const subjectMap = new Map<string, {
      subjectId: string;
      subjectName: string;
      total: number;
      present: number;
      partial: number;
      late: number;
      absent: number;
      excused: number;
    }>();

    for (const record of records) {
      const subjectId = record.session.subject.id;
      const subjectName = record.session.subject.name;

      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          subjectId,
          subjectName,
          total: 0,
          present: 0,
          partial: 0,
          late: 0,
          absent: 0,
          excused: 0,
        });
      }

      const entry = subjectMap.get(subjectId)!;
      entry.total++;
      switch (record.finalStatus) {
        case 'PRESENT':  entry.present++;  break;
        case 'PARTIAL':  entry.partial++;  break;
        case 'LATE':     entry.late++;     break;
        case 'ABSENT':   entry.absent++;   break;
        case 'EXCUSED':  entry.excused++;  break;
      }
    }

    const bySubject = Array.from(subjectMap.values()).map(s => ({
      ...s,
      attendancePercentage: s.total > 0
        ? Math.round(((s.present + (s.partial + s.late) * 0.5) / s.total) * 100)
        : 0,
    }));

    // Recent sessions (last 20)
    const recentSessions = records.slice(0, 20).map(r => ({
      sessionId: r.sessionId,
      date: r.session.date,
      scheduledStart: r.session.scheduledStart,
      subject: r.session.subject,
      class: r.session.class,
      division: r.session.division,
      batch: r.session.batch,
      status: r.finalStatus,
      automatedStatus: r.automatedStatus,
      wasOverridden: r.finalStatus !== r.automatedStatus,
      startSubmittedAt: r.startSubmittedAt,
      endSubmittedAt: r.endSubmittedAt,
    }));

    return res.json({
      overall: {
        total,
        present,
        partial,
        late,
        absent,
        excused,
        attendancePercentage,
      },
      bySubject,
      recentSessions,
    });
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};
