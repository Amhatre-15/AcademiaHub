import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { NoticeAudienceType } from '@prisma/client';

export const createNotice = async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.user!;
    if (role !== 'IT_ADMIN' && role !== 'FACULTY') {
      return res.status(403).json({ error: 'Unauthorized to create notices' });
    }

    const { title, body, audienceType, audienceRefId, isPinned, expiresAt } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const notice = await prisma.notice.create({
      data: {
        title,
        body,
        createdById: userId,
        audienceType: audienceType as NoticeAudienceType,
        audienceRefId: audienceRefId || null,
        isPinned: isPinned || false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        createdBy: { select: { username: true } },
      },
    });

    return res.status(201).json({ notice });
  } catch (error) {
    console.error('Error creating notice:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const listNotices = async (req: Request, res: Response) => {
  try {
    const { userId, role, studentId, facultyId } = req.user!;
    const now = new Date();

    // Determine relevant audience conditions based on role
    const audienceConditions: any[] = [{ audienceType: 'ALL' }];

    if (role === 'STUDENT' && studentId) {
      // Get student's enrollments to determine their classes, divisions, batches, branch
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
          enrollments: {
            where: { status: 'ACTIVE' },
            include: { class: { include: { academicLevel: true } } },
          },
        },
      });

      if (student) {
        const branchIds = student.enrollments.map(e => e.class?.academicLevel?.branchId).filter(Boolean);
        if (branchIds.length > 0) {
          audienceConditions.push({
            audienceType: 'BRANCH',
            audienceRefId: { in: branchIds },
          });
        }

        const classIds = student.enrollments.map(e => e.classId);
        const divisionIds = student.enrollments.map(e => e.divisionId).filter(Boolean);
        const batchIds = student.enrollments.map(e => e.batchId).filter(Boolean);

        if (classIds.length > 0) {
          audienceConditions.push({ audienceType: 'CLASS', audienceRefId: { in: classIds } });
        }
        if (divisionIds.length > 0) {
          audienceConditions.push({ audienceType: 'DIVISION', audienceRefId: { in: divisionIds } });
        }
        if (batchIds.length > 0) {
          audienceConditions.push({ audienceType: 'BATCH', audienceRefId: { in: batchIds } });
        }
      }
    } else if (role === 'FACULTY' && facultyId) {
      const faculty = await prisma.faculty.findUnique({
        where: { id: facultyId },
      });
      // For simplicity, faculty see ALL, and maybe we can map department to branch if needed.
      // We will just let them see ALL and notices they created.
    } else if (role === 'IT_ADMIN') {
      // Admins see everything
    }

    const whereClause: any = {
      OR: audienceConditions,
      AND: [
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
      ],
    };

    if (role === 'IT_ADMIN') {
      delete whereClause.OR; // admin sees all
    } else if (role === 'FACULTY') {
      whereClause.OR.push({ createdById: userId }); // Faculty sees what they created too
    }

    const notices = await prisma.notice.findMany({
      where: whereClause,
      include: {
        createdBy: { select: { username: true } },
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return res.json({ notices });
  } catch (error) {
    console.error('Error listing notices:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
