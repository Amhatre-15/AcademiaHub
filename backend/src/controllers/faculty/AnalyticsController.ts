import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';

export const getFacultyAnalytics = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;

    // Get classes assigned to this faculty
    const assignments = await prisma.facultyAssignment.findMany({
      where: { facultyId, status: 'ACTIVE' },
      include: {
        class: true,
        subject: true,
      }
    });

    const classIds = assignments.map(a => a.classId);

    // Total active students in those classes
    const totalStudents = await prisma.enrollment.count({
      where: {
        classId: { in: classIds },
        status: 'ACTIVE'
      }
    });

    // Attendance metrics
    const sessions = await prisma.classSession.findMany({
      where: {
        facultyId,
        status: 'CLOSED'
      },
      include: {
        attendanceCheckpoints: {
          include: { _count: { select: { submissions: true } } }
        }
      }
    });

    let totalCheckpoints = 0;
    let totalSubmissions = 0;

    sessions.forEach(session => {
      session.attendanceCheckpoints.forEach((cp: any) => {
        totalCheckpoints += totalStudents; // Potential submissions
        totalSubmissions += cp._count.submissions;
      });
    });

    const averageAttendance = totalCheckpoints > 0
      ? Math.round((totalSubmissions / totalCheckpoints) * 100)
      : 0;

    // Quiz Performance
    const quizzes = await prisma.quiz.findMany({
      where: { facultyId, status: 'CLOSED' },
      include: {
        attempts: true
      }
    });

    let quizScores = 0;
    let maxQuizScores = 0;
    quizzes.forEach(quiz => {
      quiz.attempts.forEach(attempt => {
        quizScores += attempt.score;
        maxQuizScores += attempt.maxScore;
      });
    });

    const averageQuizScore = maxQuizScores > 0
      ? Math.round((quizScores / maxQuizScores) * 100)
      : 0;

    // Recent Activity (Classes)
    const recentSessions = await prisma.classSession.findMany({
      where: { facultyId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { class: { select: { name: true } }, subject: { select: { name: true } } }
    });

    return res.json({
      metrics: {
        totalStudents,
        averageAttendance,
        averageQuizScore,
        totalClassesConducted: sessions.length
      },
      recentSessions: recentSessions.map(rs => ({
        id: rs.id,
        className: rs.class.name,
        subjectName: rs.subject.name,
        date: rs.createdAt,
        status: rs.status
      }))
    });
  } catch (error) {
    console.error('Error fetching faculty analytics:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
