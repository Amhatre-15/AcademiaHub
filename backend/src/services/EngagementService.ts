import { prisma } from '../config/prisma';

export const XP_TABLE = {
  ATTENDANCE_PRESENT: 50,
  QUIZ_ATTEMPT: 20,
  QUIZ_CORRECT: 30, // Additional points per correct answer
  STREAK_BONUS: 10,
};

export const LEVELS = [
  { level: 1, xpRequired: 0 },
  { level: 2, xpRequired: 500 },
  { level: 3, xpRequired: 1500 },
  { level: 4, xpRequired: 3000 },
  { level: 5, xpRequired: 5000 },
  { level: 6, xpRequired: 8000 },
  { level: 7, xpRequired: 12000 },
  { level: 8, xpRequired: 18000 },
  { level: 9, xpRequired: 25000 },
  { level: 10, xpRequired: 35000 },
];

export class EngagementService {
  static async addEngagementEvent(
    studentId: string,
    sessionId: string | null,
    eventType: string,
    points: number,
    metadata?: any
  ) {
    // 1. Record event
    await prisma.engagementEvent.create({
      data: {
        studentId,
        sessionId,
        eventType,
        points,
        metadata: metadata || {},
      },
    });

    if (points > 0) {
      await this.addXp(studentId, points);
    }
  }

  static async addXp(studentId: string, xpToAdd: number) {
    // Ensure StudentEngagement exists
    let engagement = await prisma.studentEngagement.findUnique({
      where: { studentId },
    });

    if (!engagement) {
      engagement = await prisma.studentEngagement.create({
        data: {
          studentId,
          totalXp: 0,
          level: 1,
          streak: 0,
        },
      });
    }

    const newXp = engagement.totalXp + xpToAdd;
    
    // Calculate new level
    let newLevel = engagement.level;
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (newXp >= LEVELS[i].xpRequired) {
        newLevel = Math.max(engagement.level, LEVELS[i].level);
        break;
      }
    }

    await prisma.studentEngagement.update({
      where: { studentId },
      data: {
        totalXp: newXp,
        level: newLevel,
        lastActive: new Date(),
      },
    });

    // Check badges
    await this.evaluateBadges(studentId);
  }

  static async evaluateBadges(studentId: string) {
    const engagement = await prisma.studentEngagement.findUnique({
      where: { studentId },
    });
    if (!engagement) return;

    const badges = await prisma.badge.findMany({
      where: { isActive: true },
    });

    const studentBadges = await prisma.studentBadge.findMany({
      where: { studentId },
      select: { badgeId: true },
    });
    const earnedBadgeIds = new Set(studentBadges.map(sb => sb.badgeId));

    for (const badge of badges) {
      if (earnedBadgeIds.has(badge.id)) continue;

      let qualify = false;
      switch (badge.criteriaType) {
        case 'XP_TOTAL':
          if (engagement.totalXp >= badge.criteriaValue) qualify = true;
          break;
        case 'STREAK':
          if (engagement.streak >= badge.criteriaValue) qualify = true;
          break;
        // Additional criteria like QUIZ_SCORE can be handled here
      }

      if (qualify) {
        await prisma.studentBadge.create({
          data: {
            studentId,
            badgeId: badge.id,
          },
        });
      }
    }
  }
}
