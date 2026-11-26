import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { supabase, STORAGE_BUCKET } from '../../config/supabase';

export const getMaterials = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    if (!studentId) return res.status(403).json({ error: 'Not student' });

    // Get student enrollments
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId, status: 'ACTIVE' },
      select: { classId: true }
    });
    const classIds = enrollments.map(e => e.classId);

    // Fetch materials for these classes where visibility is not PRIVATE
    const materials = await prisma.material.findMany({
      where: {
        classId: { in: classIds },
        isDeleted: false,
        visibility: { not: 'PRIVATE' },
      },
      include: {
        subject: { select: { name: true, code: true } },
        faculty: { select: { firstName: true, lastName: true, user: { select: { username: true } } } },
        session: { select: { date: true, topic: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ materials });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMaterialDownloadUrl = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    if (!studentId) return res.status(403).json({ error: 'Not student' });

    const id = req.params.id as string;

    // Fetch the material
    const material = await prisma.material.findFirst({
      where: { id, isDeleted: false, visibility: { not: 'PRIVATE' } }
    });

    if (!material) return res.status(404).json({ error: 'Material not found' });

    // Verify enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, classId: material.classId, status: 'ACTIVE' }
    });

    if (!enrollment) return res.status(403).json({ error: 'Not enrolled in this class' });

    // Generate signed URL (expires in 15 minutes)
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(material.storagePath, 60 * 15, {
        download: material.fileName // Force download behavior in browser
      });

    if (error || !data) {
      console.error('Supabase signed URL error:', error);
      return res.status(500).json({ error: 'Failed to generate download link' });
    }

    return res.json({ url: data.signedUrl });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
