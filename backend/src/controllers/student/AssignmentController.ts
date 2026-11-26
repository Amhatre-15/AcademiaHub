import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { supabase, storagePathBuilder, ASSIGNMENTS_BUCKET } from '../../config/supabase';
import { randomUUID } from 'crypto';

export const listAssignments = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    if (!studentId) return res.status(403).json({ error: 'Not student' });

    // Get all classes the student is enrolled in
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId, status: 'ACTIVE' },
      select: { classId: true },
    });
    const classIds = enrollments.map(e => e.classId);

    const assignments = await prisma.assignment.findMany({
      where: {
        classId: { in: classIds },
        status: 'PUBLISHED',
      },
      include: {
        subject: { select: { name: true, code: true } },
        class: { select: { name: true } },
        faculty: { select: { firstName: true, lastName: true } },
        submissions: {
          where: { studentId },
          take: 1,
        },
      },
      orderBy: { deadline: 'asc' },
    });

    return res.json({ assignments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAssignment = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    const id = req.params.id as string;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        subject: { select: { name: true, code: true } },
        class: { select: { name: true } },
        faculty: { select: { firstName: true, lastName: true } },
        files: true,
        submissions: {
          where: { studentId },
          take: 1,
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Verify enrollment
    const isEnrolled = await prisma.enrollment.findFirst({
      where: { studentId, classId: assignment.classId, status: 'ACTIVE' },
    });

    if (!isEnrolled) {
      return res.status(403).json({ error: 'Not enrolled in this class' });
    }

    // Get signed URLs for files
    const filesWithUrls = await Promise.all(
      assignment.files.map(async (file: any) => {
        const { data } = await supabase.storage
          .from(ASSIGNMENTS_BUCKET)
          .createSignedUrl(file.storagePath, 3600);
        return { ...file, downloadUrl: data?.signedUrl };
      })
    );

    // Get signed URLs for submission if exists
    const submission = assignment.submissions[0];
    let submissionWithUrl = null;
    if (submission && submission.storagePath) {
      const { data } = await supabase.storage
        .from(ASSIGNMENTS_BUCKET)
        .createSignedUrl(submission.storagePath, 3600);
      submissionWithUrl = { ...submission, downloadUrl: data?.signedUrl };
    }

    return res.json({
      assignment: {
        ...assignment,
        files: filesWithUrls,
        submission: submissionWithUrl || null,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const submitAssignment = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    const assignmentId = req.params.id as string;

    if (!studentId) return res.status(403).json({ error: 'Not student' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment || assignment.status !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Assignment not found or inactive' });
    }

    // Check enrollment
    const isEnrolled = await prisma.enrollment.findFirst({
      where: { studentId, classId: assignment.classId, status: 'ACTIVE' },
    });
    if (!isEnrolled) {
      return res.status(403).json({ error: 'Not enrolled in this class' });
    }

    // Process file upload
    const ext = file.originalname.split('.').pop() || 'bin';
    const uniqueFileName = `${randomUUID()}.${ext}`;
    const storagePath = storagePathBuilder.submission(assignmentId, studentId, uniqueFileName);

    const { error: uploadError } = await supabase.storage
      .from(ASSIGNMENTS_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error('Submission upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload submission to storage' });
    }

    // Upsert submission
    const submission = await prisma.assignmentSubmission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId,
        },
      },
      update: {
        storagePath,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        submittedAt: new Date(),
        status: 'SUBMITTED',
      },
      create: {
        assignmentId,
        studentId,
        storagePath,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        submittedAt: new Date(),
        status: 'SUBMITTED',
      },
    });

    return res.status(201).json({ submission });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
