import { prisma } from '../config/prisma';

export class NotificationService {
  /**
   * Creates a notification for a specific user.
   */
  static async notifyUser(
    userId: string,
    title: string,
    body: string,
    type: string,
    refEntityType?: string,
    refEntityId?: string
  ) {
    try {
      await prisma.notification.create({
        data: {
          userId,
          title,
          body,
          type,
          refEntityType,
          refEntityId,
        },
      });
    } catch (error) {
      console.error('Failed to create notification for user', userId, error);
    }
  }

  /**
   * Creates notifications for all students in a specific class.
   */
  static async notifyClass(
    classId: string,
    title: string,
    body: string,
    type: string,
    refEntityType?: string,
    refEntityId?: string
  ) {
    try {
      const enrollments = await prisma.enrollment.findMany({
        where: { classId, status: 'ACTIVE' },
        select: { student: { select: { user: { select: { id: true } } } } },
      });

      const userIds = enrollments
        .map((e) => e.student.user?.id)
        .filter((id) => id) as string[];

      if (userIds.length > 0) {
        await prisma.notification.createMany({
          data: userIds.map((userId) => ({
            userId,
            title,
            body,
            type,
            refEntityType,
            refEntityId,
          })),
        });
      }
    } catch (error) {
      console.error('Failed to notify class', classId, error);
    }
  }
}
