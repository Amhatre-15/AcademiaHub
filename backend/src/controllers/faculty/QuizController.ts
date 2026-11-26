import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { sessionManager } from '../../websocket/SessionManager';

// ─── Schemas ────────────────────────────────────────────────────────────────

const createQuizSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  subjectId: z.string().uuid(),
  classId: z.string().uuid(),
  divisionId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  mode: z.enum(['MANUAL', 'AUTOMATIC']).default('MANUAL'),
  questionIntervalSec: z.number().int().min(5).max(300).optional(),
});

const questionSchema = z.object({
  text: z.string().min(1).max(2000),
  type: z.enum(['MCQ', 'SHORT_ANSWER', 'NUMERICAL', 'ONE_LINER']).default('MCQ'),
  order: z.number().int().min(0).optional(),
  durationSeconds: z.number().int().min(5).max(300).default(30),
  correctAnswer: z.string().optional(),
  explanation: z.string().optional(),
  options: z.array(z.object({
    text: z.string().min(1).max(500),
    isCorrect: z.boolean().default(false),
    order: z.number().int().min(0).optional(),
  })).optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function verifyFacultyQuizAccess(quizId: string, facultyId: string) {
  return prisma.quiz.findFirst({
    where: { id: quizId, facultyId },
    include: {
      questions: {
        include: { options: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  });
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

/**
 * GET /api/faculty/quiz
 * List all quizzes belonging to this faculty
 */
export const listQuizzes = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Faculty profile not found' });

    const { page = '1', limit = '20', search } = req.query as {
      page?: string;
      limit?: string;
      search?: string;
    };

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10)), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { facultyId };
    if (search) {
      where['OR'] = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { subject: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [quizzes, total] = await Promise.all([
      prisma.quiz.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          subject: { select: { id: true, name: true, code: true } },
          class: { select: { id: true, name: true } },
          division: { select: { id: true, name: true } },
          batch: { select: { id: true, name: true } },
          session: { select: { id: true, date: true, topic: true } },
          _count: { select: { questions: true, attempts: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.quiz.count({ where }),
    ]);

    return res.json({
      quizzes,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Error listing quizzes:', error);
    return res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
};

/**
 * GET /api/faculty/quiz/:id
 * Get a specific quiz with all questions and options
 */
export const getQuiz = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Faculty profile not found' });

    const quizId = req.params.id as string;
    const quiz = await verifyFacultyQuizAccess(quizId, facultyId);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    return res.json({ quiz });
  } catch (error) {
    console.error('Error getting quiz:', error);
    return res.status(500).json({ error: 'Failed to fetch quiz' });
  }
};

/**
 * POST /api/faculty/quiz
 * Create a new quiz (DRAFT status)
 */
export const createQuiz = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Faculty profile not found' });

    const parsed = createQuizSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });

    const data = parsed.data;

    // Verify faculty is assigned to this subject/class
    const assignment = await prisma.facultyAssignment.findFirst({
      where: {
        facultyId,
        subjectId: data.subjectId,
        classId: data.classId,
        status: 'ACTIVE',
      },
    });

    if (!assignment) {
      return res.status(403).json({ error: 'You are not assigned to teach this subject in this class' });
    }

    const quiz = await prisma.quiz.create({
      data: {
        title: data.title,
        description: data.description,
        subjectId: data.subjectId,
        classId: data.classId,
        divisionId: data.divisionId,
        batchId: data.batchId,
        facultyId,
        sessionId: data.sessionId,
        mode: data.mode,
        questionIntervalSec: data.questionIntervalSec,
        status: 'DRAFT',
      },
      include: {
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    });

    return res.status(201).json({ quiz });
  } catch (error) {
    console.error('Error creating quiz:', error);
    return res.status(500).json({ error: 'Failed to create quiz' });
  }
};

/**
 * PATCH /api/faculty/quiz/:id
 * Update quiz metadata (only allowed in non-ACTIVE status)
 */
export const updateQuiz = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Faculty profile not found' });

    const quizId = req.params.id as string;
    const quiz = await prisma.quiz.findFirst({ where: { id: quizId, facultyId } });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    if (quiz.status === 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot edit an active quiz' });
    }

    const parsed = createQuizSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });

    const updated = await prisma.quiz.update({
      where: { id: quiz.id },
      data: parsed.data,
      include: {
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    });

    return res.json({ quiz: updated });
  } catch (error) {
    console.error('Error updating quiz:', error);
    return res.status(500).json({ error: 'Failed to update quiz' });
  }
};

/**
 * DELETE /api/faculty/quiz/:id
 */
export const deleteQuiz = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Faculty profile not found' });

    const quizId = req.params.id as string;
    const quiz = await prisma.quiz.findFirst({ where: { id: quizId, facultyId } });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    if (quiz.status === 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot delete an active quiz' });
    }

    await prisma.quiz.delete({ where: { id: quiz.id } });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    return res.status(500).json({ error: 'Failed to delete quiz' });
  }
};

// ─── Questions ───────────────────────────────────────────────────────────────

/**
 * POST /api/faculty/quiz/:id/questions
 */
export const addQuestion = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Faculty profile not found' });

    const quizId = req.params.id as string;
    const quiz = await prisma.quiz.findFirst({ where: { id: quizId, facultyId } });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    if (quiz.status === 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot add questions to an active quiz' });
    }

    const parsed = questionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });

    const data = parsed.data;

    const maxOrder = await prisma.quizQuestion.aggregate({
      where: { quizId: quiz.id },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        text: data.text,
        type: data.type,
        order: data.order ?? nextOrder,
        durationSeconds: data.durationSeconds,
        correctAnswer: data.correctAnswer,
        explanation: data.explanation,
        options: data.options && data.options.length > 0
          ? {
            create: data.options.map((opt, idx) => ({
              text: opt.text,
              isCorrect: opt.isCorrect,
              order: opt.order ?? idx,
            })),
          }
          : undefined,
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });

    return res.status(201).json({ question });
  } catch (error) {
    console.error('Error adding question:', error);
    return res.status(500).json({ error: 'Failed to add question' });
  }
};

/**
 * PATCH /api/faculty/quiz/:id/questions/:questionId
 */
export const updateQuestion = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Faculty profile not found' });

    const quizId = req.params.id as string;
    const questionId = req.params.questionId as string;

    const quiz = await prisma.quiz.findFirst({ where: { id: quizId, facultyId } });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    if (quiz.status === 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot edit questions of an active quiz' });
    }

    const question = await prisma.quizQuestion.findFirst({
      where: { id: questionId, quizId: quiz.id },
    });
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const parsed = questionSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });

    const data = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      if (data.options !== undefined) {
        await tx.quizOption.deleteMany({ where: { questionId: question.id } });
        if (data.options.length > 0) {
          await tx.quizOption.createMany({
            data: data.options.map((opt: { text: string; isCorrect: boolean; order?: number }, idx: number) => ({
              questionId: question.id,
              text: opt.text,
              isCorrect: opt.isCorrect,
              order: opt.order ?? idx,
            })),
          });
        }
      }

      return tx.quizQuestion.update({
        where: { id: question.id },
        data: {
          ...(data.text !== undefined && { text: data.text }),
          ...(data.type !== undefined && { type: data.type }),
          ...(data.order !== undefined && { order: data.order }),
          ...(data.durationSeconds !== undefined && { durationSeconds: data.durationSeconds }),
          ...(data.correctAnswer !== undefined && { correctAnswer: data.correctAnswer }),
          ...(data.explanation !== undefined && { explanation: data.explanation }),
        },
        include: { options: { orderBy: { order: 'asc' } } },
      });
    });

    return res.json({ question: updated });
  } catch (error) {
    console.error('Error updating question:', error);
    return res.status(500).json({ error: 'Failed to update question' });
  }
};

/**
 * DELETE /api/faculty/quiz/:id/questions/:questionId
 */
export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Faculty profile not found' });

    const quizId = req.params.id as string;
    const questionId = req.params.questionId as string;

    const quiz = await prisma.quiz.findFirst({ where: { id: quizId, facultyId } });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    if (quiz.status === 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot delete questions from an active quiz' });
    }

    await prisma.quizQuestion.deleteMany({
      where: { id: questionId, quizId: quiz.id },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting question:', error);
    return res.status(500).json({ error: 'Failed to delete question' });
  }
};

// ─── Live Quiz Control ────────────────────────────────────────────────────────

/**
 * POST /api/faculty/quiz/:id/start
 */
export const startQuiz = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Faculty profile not found' });

    const quizId = req.params.id as string;

    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, facultyId },
      include: {
        questions: { orderBy: { order: 'asc' }, take: 1 },
      },
    });

    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    if (quiz.status !== 'DRAFT') return res.status(400).json({ error: 'Quiz is already active or closed' });
    if (quiz.questions.length === 0) return res.status(400).json({ error: 'Quiz has no questions' });

    // Find active session
    const session = await prisma.classSession.findFirst({
      where: { facultyId, status: 'ACTIVE' },
    });

    if (!session) return res.status(400).json({ error: 'No active session. Start a class session first.' });

    if (quiz.classId !== session.classId) {
      return res.status(400).json({ error: 'Quiz does not belong to the same class as the active session' });
    }

    const updatedQuiz = await prisma.quiz.update({
      where: { id: quiz.id },
      data: {
        status: 'ACTIVE',
        sessionId: session.id,
        startedAt: new Date(),
      },
    });

    sessionManager.broadcastToSession(session.id, {
      type: 'QUIZ_STARTED',
      quizId: quiz.id,
      quizTitle: quiz.title,
      sessionId: session.id,
    });

    return res.json({ quiz: updatedQuiz, sessionId: session.id });
  } catch (error) {
    console.error('Error starting quiz:', error);
    return res.status(500).json({ error: 'Failed to start quiz' });
  }
};

/**
 * POST /api/faculty/quiz/:id/launch-question
 */
export const launchQuestion = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Faculty profile not found' });

    const quizId = req.params.id as string;
    const { questionId } = req.body;

    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, facultyId, status: 'ACTIVE' },
    });

    if (!quiz) return res.status(404).json({ error: 'Active quiz not found' });

    const question = await prisma.quizQuestion.findFirst({
      where: { id: questionId as string, quizId: quiz.id },
      include: {
        options: {
          orderBy: { order: 'asc' },
          select: { id: true, text: true, order: true }, // no isCorrect
        },
      },
    });

    if (!question) return res.status(404).json({ error: 'Question not found in this quiz' });

    const duration = question.durationSeconds;
    const now = new Date();
    const endsAt = new Date(now.getTime() + duration * 1000);

    await prisma.quizQuestion.update({
      where: { id: question.id },
      data: { launchedAt: now, endsAt },
    });

    await prisma.quiz.update({
      where: { id: quiz.id },
      data: { currentQuestionId: question.id },
    });

    const questionPayload = {
      type: 'QUIZ_QUESTION_LAUNCHED',
      quizId: quiz.id,
      question: {
        id: question.id,
        text: question.text,
        type: question.type,
        durationSeconds: question.durationSeconds,
        endsAt: endsAt.toISOString(),
        options: question.options,
      },
    };

    if (quiz.sessionId) {
      sessionManager.broadcastToSession(quiz.sessionId, questionPayload);

      const sessionIdCopy = quiz.sessionId;
      const questionIdCopy = question.id;
      setTimeout(async () => {
        try {
          sessionManager.broadcastToSession(sessionIdCopy, {
            type: 'QUIZ_QUESTION_ENDED',
            quizId: quiz.id,
            questionId: questionIdCopy,
          });
        } catch (e) {
          console.error('Error auto-closing question:', e);
        }
      }, duration * 1000);
    }

    return res.json({ success: true, question: { id: question.id, endsAt: endsAt.toISOString() } });
  } catch (error) {
    console.error('Error launching question:', error);
    return res.status(500).json({ error: 'Failed to launch question' });
  }
};

/**
 * POST /api/faculty/quiz/:id/end
 */
export const endQuiz = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Faculty profile not found' });

    const quizId = req.params.id as string;

    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, facultyId, status: 'ACTIVE' },
    });

    if (!quiz) return res.status(404).json({ error: 'Active quiz not found' });

    // Calculate max score = number of questions
    const questionCount = await prisma.quizQuestion.count({ where: { quizId: quiz.id } });

    // Update all attempts with maxScore
    await prisma.quizAttempt.updateMany({
      where: { quizId: quiz.id },
      data: { completedAt: new Date(), maxScore: questionCount },
    });

    const closedQuiz = await prisma.quiz.update({
      where: { id: quiz.id },
      data: { status: 'CLOSED', endedAt: new Date(), currentQuestionId: null },
    });

    // Compute leaderboard (top 10)
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId: quiz.id },
      include: {
        student: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ score: 'desc' }, { startedAt: 'asc' }],
      take: 10,
    });

    const leaderboard = attempts.map((a, idx) => ({
      rank: idx + 1,
      studentName: `${a.student.firstName} ${a.student.lastName[0]}.`,
      score: a.score,
      maxScore: questionCount,
    }));

    if (quiz.sessionId) {
      sessionManager.broadcastToSession(quiz.sessionId, {
        type: 'QUIZ_ENDED',
        quizId: quiz.id,
        leaderboard,
      });
    }

    return res.json({ quiz: closedQuiz, leaderboard });
  } catch (error) {
    console.error('Error ending quiz:', error);
    return res.status(500).json({ error: 'Failed to end quiz' });
  }
};

/**
 * GET /api/faculty/quiz/:id/results
 */
export const getQuizResults = async (req: Request, res: Response) => {
  try {
    const facultyId = req.user!.facultyId;
    if (!facultyId) return res.status(403).json({ error: 'Faculty profile not found' });

    const quizId = req.params.id as string;

    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, facultyId },
      include: {
        subject: { select: { name: true } },
        class: { select: { name: true } },
        questions: {
          include: {
            options: { orderBy: { order: 'asc' } },
            answers: {
              include: {
                attempt: {
                  include: {
                    student: { select: { firstName: true, lastName: true, prn: true } },
                  },
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
        attempts: {
          include: {
            student: { select: { firstName: true, lastName: true, prn: true } },
          },
          orderBy: [{ score: 'desc' }, { startedAt: 'asc' }],
        },
      },
    });

    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    return res.json({ quiz });
  } catch (error) {
    console.error('Error getting quiz results:', error);
    return res.status(500).json({ error: 'Failed to fetch quiz results' });
  }
};
