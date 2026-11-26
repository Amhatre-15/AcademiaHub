import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';

export const getStudentAnalytics = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;

    // Engagement & Gamification
    const engagement = await prisma.studentEngagement.findUnique({
      where: { studentId },
    });

    const studentBadges = await prisma.studentBadge.findMany({
      where: { studentId },
      include: { badge: true },
    });

    const recentEvents = await prisma.engagementEvent.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Attendance Analytics
    const totalCheckpoints = await prisma.attendanceCheckpoint.count({
      where: {
        session: { class: { enrollments: { some: { studentId, status: 'ACTIVE' } } } },
      },
    });

    const attendedCheckpoints = await prisma.attendanceCodeSubmission.count({
      where: { studentId, validity: 'VALID' },
    });

    const attendancePercentage = totalCheckpoints > 0 
      ? Math.round((attendedCheckpoints / totalCheckpoints) * 100) 
      : 0;

    // Quiz Analytics
    const quizAttempts = await prisma.quizAttempt.findMany({
      where: { studentId },
    });

    let totalScore = 0;
    let maxPossibleScore = 0;
    quizAttempts.forEach(qa => {
      totalScore += qa.score;
      maxPossibleScore += qa.maxScore;
    });
    
    const quizAverage = maxPossibleScore > 0 
      ? Math.round((totalScore / maxPossibleScore) * 100) 
      : 0;

    // Assignment Analytics
    const totalAssignments = await prisma.assignment.count({
      where: {
        class: { enrollments: { some: { studentId, status: 'ACTIVE' } } },
        status: { in: ['PUBLISHED', 'CLOSED'] },
      },
    });

    const submittedAssignments = await prisma.assignmentSubmission.count({
      where: { studentId },
    });

    const assignmentCompletion = totalAssignments > 0
      ? Math.round((submittedAssignments / totalAssignments) * 100)
      : 0;

    return res.json({
      engagement: engagement || { totalXp: 0, level: 1, streak: 0 },
      badges: studentBadges.map(sb => sb.badge),
      recentEvents,
      metrics: {
        attendancePercentage,
        quizAverage,
        assignmentCompletion,
        totalClassesAttended: attendedCheckpoints,
      }
    });
  } catch (error) {
    console.error('Error fetching student analytics:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;

    // Global Top 10 by XP
    const topStudents = await prisma.studentEngagement.findMany({
      orderBy: { totalXp: 'desc' },
      take: 10,
      include: {
        student: {
          select: { firstName: true, lastName: true, id: true }
        }
      }
    });

    const leaderboard = topStudents.map((se, index) => ({
      rank: index + 1,
      studentName: `${se.student.firstName} ${se.student.lastName[0]}.`,
      xp: se.totalXp,
      level: se.level,
      isMe: se.student.id === studentId,
    }));

    return res.json({ leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
