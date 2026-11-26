import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { supabase, storagePathBuilder, STORAGE_BUCKET } from '../../config/supabase';
import { MaterialVisibility } from '@prisma/client';
import { randomUUID } from 'crypto';

export const uploadMaterial = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Not faculty' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const { title, description, subjectId, classId, divisionId, batchId, sessionId, visibility } = req.body;

    if (!title || !subjectId || !classId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify assignment
    const assignment = await prisma.facultyAssignment.findFirst({
      where: {
        facultyId,
        subjectId,
        classId,
        status: 'ACTIVE'
      }
    });

    if (!assignment) {
      return res.status(403).json({ error: 'Not assigned to this class/subject' });
    }

    const ext = file.originalname.split('.').pop() || 'bin';
    const uniqueFileName = `${randomUUID()}.${ext}`;
    const storagePath = storagePathBuilder.material(classId, subjectId, sessionId || null, uniqueFileName);

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload file to storage' });
    }

    const material = await prisma.material.create({
      data: {
        title,
        description: description || null,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        storagePath,
        subjectId,
        classId,
        divisionId: divisionId || null,
        batchId: batchId || null,
        facultyId,
        sessionId: sessionId || null,
        visibility: (visibility as MaterialVisibility) || 'PRIVATE',
      }
    });

    return res.status(201).json({ material });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMaterials = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Not faculty' });

    const materials = await prisma.material.findMany({
      where: { facultyId, isDeleted: false },
      include: {
        subject: { select: { name: true, code: true } },
        class: { select: { name: true } },
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

export const updateMaterial = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Not faculty' });

    const id = req.params.id as string;
    const { title, description, visibility } = req.body;

    const existing = await prisma.material.findFirst({
      where: { id, facultyId, isDeleted: false }
    });

    if (!existing) return res.status(404).json({ error: 'Material not found' });

    const updated = await prisma.material.update({
      where: { id },
      data: {
        title: title !== undefined ? title : undefined,
        description: description !== undefined ? description : undefined,
        visibility: visibility !== undefined ? (visibility as MaterialVisibility) : undefined,
      }
    });

    return res.json({ material: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteMaterial = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Not faculty' });

    const id = req.params.id as string;

    const existing = await prisma.material.findFirst({
      where: { id, facultyId, isDeleted: false }
    });

    if (!existing) return res.status(404).json({ error: 'Material not found' });

    await prisma.material.update({
      where: { id },
      data: { isDeleted: true }
    });

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
