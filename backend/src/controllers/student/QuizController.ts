import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { EngagementService, XP_TABLE } from '../../services/EngagementService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Verify that the student has a valid START attendance checkpoint for the given session.
 * Critical eligibility check from plan.md §34 / §43.
 */
async function verifyQuizEligibility(sessionId: string, studentId: string): Promise<boolean> {
  const startCheckpoint = await prisma.attendanceCheckpoint.findFirst({
    where: { sessionId, checkpointType: 'START' },
    include: {
      submissions: { where: { studentId, validity: 'VALID' } },
    },
  });
  return (startCheckpoint?.submissions.length ?? 0) > 0;
}

// ─── Active Quiz ──────────────────────────────────────────────────────────────

/**
 * GET /api/student/quiz/active
 * Returns the active quiz for the student's current session.
 * Enforces eligibility: only START-checked-in students can access.
 */
export const getActiveQuiz = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          select: { classId: true },
        },
      },
    });

    if (!student || student.enrollments.length === 0) {
      return res.json({ quiz: null });
    }

    const classIds = student.enrollments.map(e => e.classId);

    const session = await prisma.classSession.findFirst({
      where: { classId: { in: classIds }, status: 'ACTIVE' },
    });

    if (!session) return res.json({ quiz: null, sessionId: null });

    // Eligibility check
    const eligible = await verifyQuizEligibility(session.id, studentId);
    if (!eligible) {
      return res.json({
        quiz: null,
        sessionId: session.id,
        ineligible: true,
        message: 'You must complete the start attendance check before participating in the quiz.',
      });
    }

    const quiz = await prisma.quiz.findFirst({
      where: { sessionId: session.id, status: 'ACTIVE' },
      include: {
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
      },
    });

    if (!quiz) return res.json({ quiz: null, sessionId: session.id, eligible: true });

    // Get the current question (WITHOUT correct answers)
    let currentQuestion = null;
    if (quiz.currentQuestionId) {
      const q = await prisma.quizQuestion.findUnique({
        where: { id: quiz.currentQuestionId },
        include: {
          options: {
            orderBy: { order: 'asc' },
            select: { id: true, text: true, order: true },
          },
        },
      });

      if (q && q.endsAt && new Date(q.endsAt) > new Date()) {
        const attempt = await prisma.quizAttempt.findFirst({
          where: { quizId: quiz.id, studentId },
        });

        const alreadyAnswered = attempt
          ? await prisma.quizAnswer.findFirst({ where: { attemptId: attempt.id, questionId: q.id } })
          : null;

        currentQuestion = {
          id: q.id,
          text: q.text,
          type: q.type,
          durationSeconds: q.durationSeconds,
          endsAt: q.endsAt.toISOString(),
          options: q.options,
          alreadyAnswered: !!alreadyAnswered,
        };
      }
    }

    return res.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        status: quiz.status,
        mode: quiz.mode,
        sessionId: session.id,
        subject: quiz.subject,
        class: quiz.class,
      },
      currentQuestion,
      sessionId: session.id,
      eligible: true,
    });
  } catch (error) {
    console.error('Error getting active quiz:', error);
    return res.status(500).json({ error: 'Failed to fetch active quiz' });
  }
};

// ─── Submit Answer ────────────────────────────────────────────────────────────

const submitAnswerSchema = z.object({
  quizId: z.string().uuid(),
  questionId: z.string().uuid(),
  optionId: z.string().uuid().optional(),
  answerText: z.string().max(2000).optional(),
  timeTakenSec: z.number().int().min(0).optional(),
});

/**
 * POST /api/student/quiz/submit
 */
export const submitAnswer = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

    const parsed = submitAnswerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });

    const { quizId, questionId, optionId, answerText, timeTakenSec } = parsed.data;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          where: { id: questionId },
          include: { options: { select: { id: true, isCorrect: true } } },
        },
      },
    });

    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    if (quiz.status !== 'ACTIVE') return res.status(400).json({ error: 'Quiz is not active' });
    if (quiz.questions.length === 0) return res.status(404).json({ error: 'Question not found' });

    const question = quiz.questions[0];

    if (!question.launchedAt) {
      return res.status(400).json({ error: 'This question has not been launched yet' });
    }
    if (question.endsAt && new Date(question.endsAt) < new Date()) {
      return res.status(400).json({ error: 'Time is up for this question' });
    }

    if (!quiz.sessionId) {
      return res.status(400).json({ error: 'Quiz is not linked to an active session' });
    }

    // Enforce eligibility server-side
    const eligible = await verifyQuizEligibility(quiz.sessionId, studentId);
    if (!eligible) {
      return res.status(403).json({
        error: 'You are not eligible for this quiz because the starting attendance checkpoint was not completed.',
      });
    }

    // Verify enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, classId: quiz.classId, status: 'ACTIVE' },
    });

    if (!enrollment) {
      return res.status(403).json({ error: 'You are not enrolled in this class' });
    }

    // Get or create attempt
    let attempt = await prisma.quizAttempt.findFirst({ where: { quizId, studentId } });

    let shouldAwardAttemptXp = false;

    if (!attempt) {
      attempt = await prisma.quizAttempt.create({
        data: { quizId, studentId, sessionId: quiz.sessionId, maxScore: 0 },
      });
      shouldAwardAttemptXp = true;
    } else {
      // Anti-cheat telemetry may have created the attempt before the first
      // answer. Only award QUIZ_ATTEMPT once per live session.
      const existingAttemptXp = await prisma.engagementEvent.findFirst({
        where: { studentId, sessionId: quiz.sessionId, eventType: 'QUIZ_ATTEMPT' },
      });
      shouldAwardAttemptXp = !existingAttemptXp;
    }

    if (shouldAwardAttemptXp) {
      await EngagementService.addEngagementEvent(
        studentId,
        quiz.sessionId,
        'QUIZ_ATTEMPT',
        XP_TABLE.QUIZ_ATTEMPT
      );
    }

    // Check for duplicate answer
    const existingAnswer = await prisma.quizAnswer.findFirst({
      where: { attemptId: attempt.id, questionId },
    });

    if (existingAnswer) {
      return res.status(400).json({ error: 'You have already answered this question' });
    }

    // Determine correctness
    let isCorrect = false;
    if (question.type === 'MCQ' && optionId) {
      const selectedOption = question.options.find((o: { id: string; isCorrect: boolean }) => o.id === optionId);
      isCorrect = selectedOption?.isCorrect ?? false;
    } else if (['NUMERICAL', 'ONE_LINER', 'SHORT_ANSWER'].includes(question.type) && answerText) {
      isCorrect =
        question.correctAnswer != null &&
        answerText.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
    }

    let answer;
    try {
      answer = await prisma.quizAnswer.create({
        data: {
          attemptId: attempt.id,
          questionId,
          optionId: optionId ?? null,
          answerText: answerText ?? null,
          isCorrect,
          timeTakenSec: timeTakenSec ?? null,
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(400).json({ error: 'You have already answered this question' });
      }
      throw err;
    }

    if (isCorrect) {
      await prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: { score: { increment: 1 } },
      });

      // Add engagement event for correct answer
      await EngagementService.addEngagementEvent(
        studentId,
        quiz.sessionId,
        'QUIZ_CORRECT',
        XP_TABLE.QUIZ_CORRECT
      );
    }

    return res.status(201).json({ success: true, isCorrect, answerId: answer.id });
  } catch (error) {
    console.error('Error submitting answer:', error);
    return res.status(500).json({ error: 'Failed to submit answer' });
  }
};

// ─── Anti-cheat Violation Reporting ──────────────────────────────────────────

const violationSchema = z.object({
  quizId: z.string().uuid(),
  type: z.enum(['WINDOW_BLUR', 'TAB_HIDDEN', 'CONTEXT_MENU', 'COPY', 'PASTE']),
  questionId: z.string().uuid().optional(),
});

/**
 * POST /api/student/quiz/violation
 * Persists an anti-cheat signal against the student's quiz attempt. The count
 * is surfaced to faculty in the quiz results and is intentionally additive:
 * repeated blur/tab events are all recorded.
 */
export const reportViolation = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

    const parsed = violationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    }

    const { quizId, type } = parsed.data;

    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, status: 'ACTIVE' },
      select: { id: true, sessionId: true, classId: true },
    });

    if (!quiz) return res.status(404).json({ error: 'Active quiz not found' });
    if (!quiz.sessionId) return res.status(400).json({ error: 'Quiz is not linked to a live session' });

    const eligible = await verifyQuizEligibility(quiz.sessionId, studentId);
    if (!eligible) {
      return res.status(403).json({
        error: 'You are not eligible for this quiz because the starting attendance checkpoint was not completed.',
      });
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, classId: quiz.classId, status: 'ACTIVE' },
    });
    if (!enrollment) return res.status(403).json({ error: 'You are not enrolled in this class' });

    const now = new Date();
    const attempt = await prisma.quizAttempt.upsert({
      where: { quizId_studentId: { quizId, studentId } },
      create: {
        quizId,
        studentId,
        sessionId: quiz.sessionId,
        maxScore: 0,
        violationCount: 1,
        lastViolationAt: now,
        lastViolationType: type,
      },
      update: {
        violationCount: { increment: 1 },
        lastViolationAt: now,
        lastViolationType: type,
      },
    });

    return res.status(201).json({ success: true, violationCount: attempt.violationCount });
  } catch (error) {
    console.error('Error reporting quiz violation:', error);
    return res.status(500).json({ error: 'Failed to record violation' });
  }
};

// ─── Quiz Result ──────────────────────────────────────────────────────────────

/**
 * GET /api/student/quiz/:quizId/result
 */
export const getQuizResult = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

    const quizId = req.params.quizId as string;

    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, status: 'CLOSED' },
      include: {
        subject: { select: { name: true } },
        class: { select: { name: true } },
      },
    });

    if (!quiz) return res.status(404).json({ error: 'Quiz not found or not yet closed' });

    // Verify enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, classId: quiz.classId, status: 'ACTIVE' },
    });

    if (!enrollment) return res.status(403).json({ error: 'Not enrolled in this class' });

    const attempt = await prisma.quizAttempt.findFirst({
      where: { quizId, studentId },
      include: {
        answers: {
          include: {
            question: {
              include: { options: { orderBy: { order: 'asc' } } },
            },
            option: true,
          },
        },
      },
    });

    const allAttempts = await prisma.quizAttempt.findMany({
      where: { quizId },
      orderBy: [{ score: 'desc' }, { startedAt: 'asc' }],
      select: { studentId: true, score: true },
    });

    const leaderboard = await prisma.quizAttempt.findMany({
      where: { quizId },
      include: { student: { select: { firstName: true, lastName: true } } },
      orderBy: [{ score: 'desc' }, { startedAt: 'asc' }],
      take: 10,
    });

    const myRank = allAttempts.findIndex(a => a.studentId === studentId) + 1;
    const totalParticipants = allAttempts.length;

    return res.json({
      quiz: { id: quiz.id, title: quiz.title, subject: quiz.subject, class: quiz.class },
      attempt: attempt
        ? {
            score: attempt.score,
            maxScore: attempt.maxScore,
            completedAt: attempt.completedAt,
            answers: attempt.answers.map(a => ({
              questionId: a.questionId,
              questionText: a.question.text,
              questionType: a.question.type,
              yourAnswer: a.answerText ?? a.option?.text ?? null,
              isCorrect: a.isCorrect,
              correctAnswer:
                a.question.correctAnswer ??
                a.question.options.find((o: { isCorrect: boolean; text: string }) => o.isCorrect)?.text ??
                null,
              explanation: a.question.explanation,
              options: a.question.options.map((o: { id: string; text: string; isCorrect: boolean }) => ({
                id: o.id,
                text: o.text,
                isCorrect: o.isCorrect,
              })),
            })),
          }
        : null,
      myRank: myRank > 0 ? myRank : null,
      totalParticipants,
      leaderboard: leaderboard.map((a, idx) => ({
        rank: idx + 1,
        studentName: `${a.student.firstName} ${a.student.lastName[0]}.`,
        score: a.score,
        maxScore: a.maxScore,
        isMe: a.studentId === studentId,
      })),
    });
  } catch (error) {
    console.error('Error getting quiz result:', error);
    return res.status(500).json({ error: 'Failed to fetch quiz result' });
  }
};

// ─── Quiz History ─────────────────────────────────────────────────────────────

/**
 * GET /api/student/quiz/history
 */
export const getQuizHistory = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

    const { page = '1', limit = '15' } = req.query as {
      page?: string;
      limit?: string;
    };

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10)), 50);
    const skip = (pageNum - 1) * limitNum;

    const [rawAttempts, total] = await Promise.all([
      prisma.quizAttempt.findMany({
        where: { studentId },
        skip,
        take: limitNum,
        include: {
          quiz: {
            include: {
              subject: { select: { name: true } },
              class: { select: { name: true } },
            },
          },
        },
        orderBy: { startedAt: 'desc' },
      }),
      prisma.quizAttempt.count({ where: { studentId } }),
    ]);

    return res.json({
      attempts: rawAttempts.map(a => ({
        attemptId: a.id,
        quizId: a.quizId,
        quizTitle: a.quiz.title,
        subject: a.quiz.subject,
        class: a.quiz.class,
        score: a.score,
        maxScore: a.maxScore,
        percentage: a.maxScore > 0 ? Math.round((a.score / a.maxScore) * 100) : null,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
        quizStatus: a.quiz.status,
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Error getting quiz history:', error);
    return res.status(500).json({ error: 'Failed to fetch quiz history' });
  }
};
