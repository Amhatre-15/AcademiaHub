import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createNoteSchema = z.object({
  title: z.string().min(1).max(300).default('Untitled Note'),
  content: z.string().default(''),
  classId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
});

const updateNoteSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().optional(),
  classId: z.string().uuid().nullable().optional(),
  subjectId: z.string().uuid().nullable().optional(),
  sessionId: z.string().uuid().nullable().optional(),
});

const searchSchema = z.object({
  q: z.string().optional(),
  classId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildNoteResponse(note: any) {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    classId: note.classId,
    subjectId: note.subjectId,
    sessionId: note.sessionId,
    isPrivate: note.isPrivate,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    subject: note.subject
      ? { id: note.subject.id, name: note.subject.name }
      : null,
    session: note.session
      ? { id: note.session.id, date: note.session.date, topic: note.session.topic }
      : null,
  };
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /api/student/notes
 * List all notes for the authenticated student, with optional filters.
 */
export const listNotes = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query params' });

    const { q, classId, subjectId, sessionId } = parsed.data;

    const notes = await prisma.studentNote.findMany({
      where: {
        studentId,
        ...(classId && { classId }),
        ...(subjectId && { subjectId }),
        ...(sessionId && { sessionId }),
        ...(q && {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        subject: { select: { id: true, name: true } },
        session: { select: { id: true, date: true, topic: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json({ notes: notes.map(buildNoteResponse) });
  } catch (error) {
    console.error('Error listing notes:', error);
    return res.status(500).json({ error: 'Failed to fetch notes' });
  }
};

/**
 * GET /api/student/notes/:id
 * Get a specific note (must belong to the student).
 */
export const getNote = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

    const note = await prisma.studentNote.findFirst({
      where: { id: req.params.id as string, studentId },
      include: {
        subject: { select: { id: true, name: true } },
        session: { select: { id: true, date: true, topic: true } },
      },
    });

    if (!note) return res.status(404).json({ error: 'Note not found' });

    return res.json({ note: buildNoteResponse(note) });
  } catch (error) {
    console.error('Error getting note:', error);
    return res.status(500).json({ error: 'Failed to fetch note' });
  }
};

/**
 * POST /api/student/notes
 * Create a new note.
 */
export const createNote = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

    const parsed = createNoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });

    const data = parsed.data;

    // If sessionId is given, verify it belongs to an enrolled class
    if (data.sessionId) {
      const session = await prisma.classSession.findUnique({
        where: { id: data.sessionId },
      });
      if (!session) return res.status(404).json({ error: 'Session not found' });
      // Verify enrollment
      const enrollment = await prisma.enrollment.findFirst({
        where: { studentId, classId: session.classId, status: 'ACTIVE' },
      });
      if (!enrollment) return res.status(403).json({ error: 'Not enrolled in this session\'s class' });
    }

    const note = await prisma.studentNote.create({
      data: {
        studentId,
        title: data.title,
        content: data.content,
        classId: data.classId ?? null,
        subjectId: data.subjectId ?? null,
        sessionId: data.sessionId ?? null,
        isPrivate: true,
      },
      include: {
        subject: { select: { id: true, name: true } },
        session: { select: { id: true, date: true, topic: true } },
      },
    });

    return res.status(201).json({ note: buildNoteResponse(note) });
  } catch (error) {
    console.error('Error creating note:', error);
    return res.status(500).json({ error: 'Failed to create note' });
  }
};

/**
 * PATCH /api/student/notes/:id
 * Update a note (title, content, context). Used for autosave.
 */
export const updateNote = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

    const noteId = req.params.id as string;
    const existing = await prisma.studentNote.findFirst({ where: { id: noteId, studentId } });
    if (!existing) return res.status(404).json({ error: 'Note not found' });

    const parsed = updateNoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });

    const data = parsed.data;

    const updated = await prisma.studentNote.update({
      where: { id: existing.id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.classId !== undefined && { classId: data.classId }),
        ...(data.subjectId !== undefined && { subjectId: data.subjectId }),
        ...(data.sessionId !== undefined && { sessionId: data.sessionId }),
      },
      include: {
        subject: { select: { id: true, name: true } },
        session: { select: { id: true, date: true, topic: true } },
      },
    });

    return res.json({ note: buildNoteResponse(updated) });
  } catch (error) {
    console.error('Error updating note:', error);
    return res.status(500).json({ error: 'Failed to update note' });
  }
};

/**
 * DELETE /api/student/notes/:id
 */
export const deleteNote = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

    const noteId = req.params.id as string;
    const existing = await prisma.studentNote.findFirst({ where: { id: noteId, studentId } });
    if (!existing) return res.status(404).json({ error: 'Note not found' });

    await prisma.studentNote.delete({ where: { id: existing.id } });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    return res.status(500).json({ error: 'Failed to delete note' });
  }
};

/**
 * GET /api/student/notes/context
 * Get the search context (distinct classes and subjects that have notes).
 * Useful for building the sidebar filter in the notebook.
 */
export const getNotesContext = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

    // Get all unique classId and subjectId combinations from this student's notes
    const notes = await prisma.studentNote.findMany({
      where: { studentId },
      select: {
        classId: true,
        subjectId: true,
        subject: { select: { id: true, name: true } },
      },
      distinct: ['classId', 'subjectId'],
    });

    // Get unique classIds and their names via enrollment
    const classIds = [...new Set(notes.map(n => n.classId).filter(Boolean) as string[])];

    const classes = classIds.length > 0
      ? await prisma.class.findMany({
          where: { id: { in: classIds } },
          select: { id: true, name: true },
        })
      : [];

    const subjects = notes
      .filter(n => n.subject)
      .reduce((acc, n) => {
        if (n.subject && !acc.find((s: any) => s.id === n.subject!.id)) {
          acc.push(n.subject);
        }
        return acc;
      }, [] as Array<{ id: string; name: string }>);

    return res.json({ classes, subjects });
  } catch (error) {
    console.error('Error getting notes context:', error);
    return res.status(500).json({ error: 'Failed to fetch notes context' });
  }
};
