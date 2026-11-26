import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { supabase, storagePathBuilder, ASSIGNMENTS_BUCKET } from '../../config/supabase';
import { randomUUID } from 'crypto';
import { AssignmentStatus, SubmissionStatus } from '@prisma/client';
import { NotificationService } from '../../services/NotificationService';

export const createAssignment = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Not faculty' });

    const { title, description, subjectId, classId, divisionId, batchId, deadline, maxMarks } = req.body;

    if (!title || !subjectId || !classId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify assignment to class
    const isAssigned = await prisma.facultyAssignment.findFirst({
      where: { facultyId, subjectId, classId, status: 'ACTIVE' },
    });
    if (!isAssigned) {
      return res.status(403).json({ error: 'Not assigned to this class/subject' });
    }

    const assignment = await prisma.assignment.create({
      data: {
        title,
        description: description || null,
        facultyId,
        subjectId,
        classId,
        divisionId: divisionId || null,
        batchId: batchId || null,
        deadline: deadline ? new Date(deadline) : null,
        maxMarks: maxMarks ? parseInt(maxMarks) : null,
        status: 'PUBLISHED',
      },
    });

    const file = req.file;
    if (file) {
      const ext = file.originalname.split('.').pop() || 'bin';
      const uniqueFileName = `${randomUUID()}.${ext}`;
      const storagePath = storagePathBuilder.assignment(classId, assignment.id, uniqueFileName);

      const { error: uploadError } = await supabase.storage
        .from(ASSIGNMENTS_BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (!uploadError) {
        await prisma.assignmentFile.create({
          data: {
            assignmentId: assignment.id,
            storagePath,
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
          },
        });
      } else {
        console.error('Assignment file upload error:', uploadError);
      }
    }

    // Notify students in the class
    await NotificationService.notifyClass(
      classId,
      `New Assignment: ${title}`,
      `A new assignment has been posted for your class.`,
      'ASSIGNMENT',
      'assignment',
      assignment.id
    );

    return res.status(201).json({ assignment });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const listAssignments = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Not faculty' });

    const assignments = await prisma.assignment.findMany({
      where: { facultyId },
      include: {
        subject: { select: { name: true, code: true } },
        class: { select: { name: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ assignments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAssignment = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    const id = req.params.id as string;

    const assignment = await prisma.assignment.findFirst({
      where: { id, facultyId },
      include: {
        subject: { select: { name: true, code: true } },
        class: { select: { name: true } },
        files: true,
        submissions: {
          include: {
            student: { select: { firstName: true, lastName: true, prn: true, user: { select: { id: true } } } },
          },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
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

    // Get signed URLs for submissions
    const submissionsWithUrls = await Promise.all(
      assignment.submissions.map(async (sub: any) => {
        if (!sub.storagePath) return sub;
        const { data } = await supabase.storage
          .from(ASSIGNMENTS_BUCKET)
          .createSignedUrl(sub.storagePath, 3600);
        return { ...sub, downloadUrl: data?.signedUrl };
      })
    );

    return res.json({
      assignment: {
        ...assignment,
        files: filesWithUrls,
        submissions: submissionsWithUrls,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const gradeSubmission = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    const assignmentId = req.params.id as string;
    const submissionId = req.params.submissionId as string;
    const { grade, feedback } = req.body;

    const assignment = await prisma.assignment.findFirst({
      where: { id: assignmentId, facultyId },
    });

    if (!assignment) {
      return res.status(403).json({ error: 'Assignment not found or unauthorized' });
    }

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: { student: { select: { user: { select: { id: true } } } } },
    });

    if (!submission || submission.assignmentId !== assignmentId) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const updated = await prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        grade: grade !== undefined ? parseFloat(grade) : null,
        feedback: feedback || null,
        status: 'GRADED',
        gradedAt: new Date(),
        gradedBy: facultyId,
      },
    });

    // Notify student
    if (submission.student?.user?.id) {
      await NotificationService.notifyUser(
        submission.student.user.id,
        `Assignment Graded`,
        `Your submission for "${assignment.title}" has been graded.`,
        'ASSIGNMENT_GRADED',
        'assignment',
        assignmentId
      );
    }

    return res.json({ submission: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
