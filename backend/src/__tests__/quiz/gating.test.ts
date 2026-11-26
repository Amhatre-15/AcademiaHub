/**
 * Quiz gating: only students with a VALID START attendance submission may
 * fetch or answer a live quiz. This is the server-side enforcement of the
 * classroom rule, independent of the UI.
 */

process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
process.env["DIRECT_URL"] = "postgresql://test:test@localhost:5432/test";

jest.mock("../../config/prisma", () => ({
  prisma: {
    student: { findUnique: jest.fn() },
    classSession: { findFirst: jest.fn() },
    attendanceCheckpoint: { findFirst: jest.fn() },
    quiz: { findFirst: jest.fn(), findUnique: jest.fn() },
    quizQuestion: { findUnique: jest.fn() },
    quizAttempt: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    quizAnswer: { findFirst: jest.fn(), create: jest.fn() },
    enrollment: { findFirst: jest.fn() },
    engagementEvent: { findFirst: jest.fn() },
  },
}));

jest.mock("../../services/EngagementService", () => ({
  XP_TABLE: { QUIZ_ATTEMPT: 20, QUIZ_CORRECT: 30 },
  EngagementService: { addEngagementEvent: jest.fn() },
}));

import { Request, Response } from "express";
import { getActiveQuiz, submitAnswer } from "../../controllers/student/QuizController";
import { prisma } from "../../config/prisma";
import { EngagementService } from "../../services/EngagementService";

const mockStudent = prisma.student.findUnique as jest.Mock;
const mockSession = prisma.classSession.findFirst as jest.Mock;
const mockCheckpoint = prisma.attendanceCheckpoint.findFirst as jest.Mock;
const mockQuizFindFirst = prisma.quiz.findFirst as jest.Mock;
const mockQuizFindUnique = prisma.quiz.findUnique as jest.Mock;
const mockQuestion = prisma.quizQuestion.findUnique as jest.Mock;
const mockAttemptFindFirst = prisma.quizAttempt.findFirst as jest.Mock;
const mockAttemptCreate = prisma.quizAttempt.create as jest.Mock;
const mockAttemptUpdate = prisma.quizAttempt.update as jest.Mock;
const mockAnswerFindFirst = prisma.quizAnswer.findFirst as jest.Mock;
const mockAnswerCreate = prisma.quizAnswer.create as jest.Mock;
const mockEnrollment = prisma.enrollment.findFirst as jest.Mock;
const mockAddEngagement = EngagementService.addEngagementEvent as jest.Mock;

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { userId: "user-1", studentId: "student-1", role: "STUDENT" },
    body: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

const activeQuiz = {
  id: "quiz-1",
  title: "Live Quiz",
  status: "ACTIVE",
  mode: "LIVE",
  sessionId: "session-1",
  classId: "class-1",
  subject: { id: "subject-1", name: "Data Structures" },
  class: { id: "class-1", name: "SY B.Sc DS" },
};

beforeEach(() => {
  jest.clearAllMocks();

  mockStudent.mockResolvedValue({
    id: "student-1",
    enrollments: [{ classId: "class-1" }],
  });
  mockSession.mockResolvedValue({ id: "session-1", status: "ACTIVE" });
  mockEnrollment.mockResolvedValue({ id: "enrollment-1" });
  mockQuizFindFirst.mockResolvedValue(activeQuiz);
  mockQuizFindUnique.mockResolvedValue({
    ...activeQuiz,
    questions: [
      {
        id: "question-1",
        text: "What is a stack?",
        type: "MCQ",
        launchedAt: new Date(),
        endsAt: new Date(Date.now() + 60_000),
        correctAnswer: null,
        options: [
          { id: "option-correct", isCorrect: true },
          { id: "option-wrong", isCorrect: false },
        ],
      },
    ],
  });
  mockQuestion.mockResolvedValue({
    id: "question-1",
    text: "What is a stack?",
    type: "MCQ",
    durationSeconds: 60,
    endsAt: new Date(Date.now() + 60_000),
    options: [{ id: "option-correct", text: "LIFO", order: 1 }],
  });
  mockAttemptFindFirst.mockResolvedValue(null);
  mockAttemptCreate.mockResolvedValue({ id: "attempt-1", score: 0 });
  mockAttemptUpdate.mockResolvedValue({ id: "attempt-1", score: 1 });
  mockAnswerFindFirst.mockResolvedValue(null);
  mockAnswerCreate.mockResolvedValue({ id: "answer-1" });
  mockAddEngagement.mockResolvedValue({ id: "engagement-1" });
});

describe("getActiveQuiz() — START attendance gating", () => {
  it("returns ineligible when the student has no VALID START submission", async () => {
    mockCheckpoint.mockResolvedValueOnce({ id: "checkpoint-1", submissions: [] });
    const res = makeRes();

    await getActiveQuiz(makeReq(), res);

    expect(mockCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: "session-1", checkpointType: "START" },
        include: expect.objectContaining({
          submissions: { where: { studentId: "student-1", validity: "VALID" } },
        }),
      })
    );
    expect(mockQuizFindFirst).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        quiz: null,
        sessionId: "session-1",
        ineligible: true,
        message: expect.stringMatching(/start attendance/i),
      })
    );
  });

  it("treats the START checkpoint as absent when the student has no enrollment", async () => {
    mockStudent.mockResolvedValueOnce({ id: "student-1", enrollments: [] });
    const res = makeRes();

    await getActiveQuiz(makeReq(), res);

    expect(mockSession).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ quiz: null });
  });

  it("returns the active quiz and current question after a valid START", async () => {
    mockCheckpoint.mockResolvedValueOnce({ id: "checkpoint-1", submissions: [{ id: "sub-1" }] });
    mockQuizFindFirst.mockResolvedValueOnce({ ...activeQuiz, currentQuestionId: "question-1" });
    mockQuestion.mockResolvedValueOnce({
      id: "question-1",
      text: "What is a stack?",
      type: "MCQ",
      durationSeconds: 60,
      endsAt: new Date(Date.now() + 60_000),
      options: [{ id: "option-correct", text: "LIFO", order: 1 }],
    });

    const res = makeRes();
    await getActiveQuiz(makeReq(), res);

    const payload = (res.json as jest.Mock).mock.calls[0][0];
    expect(payload.eligible).toBe(true);
    expect(payload.quiz).toEqual(
      expect.objectContaining({ id: "quiz-1", title: "Live Quiz", sessionId: "session-1" })
    );
    expect(payload.currentQuestion).toEqual(
      expect.objectContaining({
        id: "question-1",
        text: "What is a stack?",
        alreadyAnswered: false,
      })
    );
    // Correct-answer flags must never cross the student boundary.
    expect(JSON.stringify(payload.currentQuestion)).not.toContain("isCorrect");
  });

  it("returns eligible=true with a null quiz when attendance is valid but no quiz is active", async () => {
    mockCheckpoint.mockResolvedValueOnce({ id: "checkpoint-1", submissions: [{ id: "sub-1" }] });
    mockQuizFindFirst.mockResolvedValueOnce(null);
    const res = makeRes();

    await getActiveQuiz(makeReq(), res);

    expect(res.json).toHaveBeenCalledWith({
      quiz: null,
      sessionId: "session-1",
      eligible: true,
    });
  });
});

describe("submitAnswer() — server-side eligibility enforcement", () => {
  const validBody = {
    quizId: "11111111-1111-4111-8111-111111111111",
    questionId: "22222222-2222-4222-8222-222222222222",
    optionId: "33333333-3333-4333-8333-333333333333",
    timeTakenSec: 12,
  };

  it("rejects an unverified student with 403 before creating an attempt", async () => {
    mockQuizFindUnique.mockResolvedValueOnce({
      ...activeQuiz,
      id: validBody.quizId,
      questions: [
        {
          id: validBody.questionId,
          launchedAt: new Date(),
          endsAt: new Date(Date.now() + 60_000),
          type: "MCQ",
          options: [],
        },
      ],
    });
    mockCheckpoint.mockResolvedValueOnce({ id: "checkpoint-1", submissions: [] });

    const res = makeRes();
    await submitAnswer(makeReq({ body: validBody }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockAttemptCreate).not.toHaveBeenCalled();
    expect(mockAnswerCreate).not.toHaveBeenCalled();
  });

  it("rejects a question that has not been launched", async () => {
    mockQuizFindUnique.mockResolvedValueOnce({
      ...activeQuiz,
      id: validBody.quizId,
      questions: [
        {
          id: validBody.questionId,
          launchedAt: null,
          endsAt: null,
          type: "MCQ",
          options: [],
        },
      ],
    });

    const res = makeRes();
    await submitAnswer(makeReq({ body: validBody }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockCheckpoint).not.toHaveBeenCalled();
  });

  it("rejects a quiz that is no longer active", async () => {
    mockQuizFindUnique.mockResolvedValueOnce({
      ...activeQuiz,
      id: validBody.quizId,
      status: "CLOSED",
      questions: [],
    });

    const res = makeRes();
    await submitAnswer(makeReq({ body: validBody }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockCheckpoint).not.toHaveBeenCalled();
  });

  it("creates an attempt, grades a correct MCQ, and awards quiz XP", async () => {
    mockQuizFindUnique.mockResolvedValueOnce({
      ...activeQuiz,
      id: validBody.quizId,
      questions: [
        {
          id: validBody.questionId,
          launchedAt: new Date(),
          endsAt: new Date(Date.now() + 60_000),
          type: "MCQ",
          correctAnswer: null,
          options: [
            { id: validBody.optionId, isCorrect: true },
            { id: "option-wrong", isCorrect: false },
          ],
        },
      ],
    });
    mockCheckpoint.mockResolvedValueOnce({ id: "checkpoint-1", submissions: [{ id: "sub-1" }] });

    const res = makeRes();
    await submitAnswer(makeReq({ body: validBody }), res);

    expect(mockAttemptCreate).toHaveBeenCalledWith({
      data: {
        quizId: validBody.quizId,
        studentId: "student-1",
        sessionId: "session-1",
        maxScore: 0,
      },
    });
    expect(mockAnswerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attemptId: "attempt-1",
          questionId: validBody.questionId,
          optionId: validBody.optionId,
          isCorrect: true,
        }),
      })
    );
    expect(mockAttemptUpdate).toHaveBeenCalledWith({
      where: { id: "attempt-1" },
      data: { score: { increment: 1 } },
    });
    expect(mockAddEngagement).toHaveBeenCalledWith(
      "student-1",
      "session-1",
      "QUIZ_ATTEMPT",
      20
    );
    expect(mockAddEngagement).toHaveBeenCalledWith(
      "student-1",
      "session-1",
      "QUIZ_CORRECT",
      30
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, isCorrect: true, answerId: "answer-1" })
    );
  });

  it("rejects a duplicate answer for the same question", async () => {
    mockQuizFindUnique.mockResolvedValueOnce({
      ...activeQuiz,
      id: validBody.quizId,
      questions: [
        {
          id: validBody.questionId,
          launchedAt: new Date(),
          endsAt: new Date(Date.now() + 60_000),
          type: "MCQ",
          options: [{ id: validBody.optionId, isCorrect: true }],
        },
      ],
    });
    mockCheckpoint.mockResolvedValueOnce({ id: "checkpoint-1", submissions: [{ id: "sub-1" }] });
    mockAttemptFindFirst.mockResolvedValueOnce({ id: "attempt-1" });
    mockAnswerFindFirst.mockResolvedValueOnce({ id: "answer-existing" });

    const res = makeRes();
    await submitAnswer(makeReq({ body: validBody }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockAnswerCreate).not.toHaveBeenCalled();
  });
});
