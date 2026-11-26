/**
 * Anti-cheat telemetry: browser blur/tab/copy signals must be persisted against
 * the student's quiz attempt, not just shown as a toast.
 */

process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
process.env["DIRECT_URL"] = "postgresql://test:test@localhost:5432/test";

jest.mock("../../config/prisma", () => ({
  prisma: {
    quiz: { findFirst: jest.fn() },
    attendanceCheckpoint: { findFirst: jest.fn() },
    enrollment: { findFirst: jest.fn() },
    quizAttempt: { upsert: jest.fn() },
  },
}));

import { Request, Response } from "express";
import { reportViolation } from "../../controllers/student/QuizController";
import { prisma } from "../../config/prisma";

const mockQuiz = prisma.quiz.findFirst as jest.Mock;
const mockCheckpoint = prisma.attendanceCheckpoint.findFirst as jest.Mock;
const mockEnrollment = prisma.enrollment.findFirst as jest.Mock;
const mockUpsert = prisma.quizAttempt.upsert as jest.Mock;

const quizId = "11111111-1111-4111-8111-111111111111";

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { userId: "user-1", studentId: "student-1", role: "STUDENT" },
    body: { quizId, type: "WINDOW_BLUR" },
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQuiz.mockResolvedValue({
    id: quizId,
    status: "ACTIVE",
    sessionId: "session-1",
    classId: "class-1",
  });
  mockCheckpoint.mockResolvedValue({ id: "checkpoint-1", submissions: [{ id: "sub-1" }] });
  mockEnrollment.mockResolvedValue({ id: "enrollment-1" });
  mockUpsert.mockResolvedValue({ id: "attempt-1", violationCount: 1 });
});

describe("reportViolation()", () => {
  it("increments the attempt's violation count and stores the latest type", async () => {
    const res = makeRes();

    await reportViolation(makeReq(), res);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { quizId_studentId: { quizId, studentId: "student-1" } },
        update: expect.objectContaining({
          violationCount: { increment: 1 },
          lastViolationType: "WINDOW_BLUR",
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, violationCount: 1 });
  });

  it("creates an attempt on the first blur before any answer is submitted", async () => {
    const res = makeRes();

    await reportViolation(makeReq({ body: { quizId, type: "TAB_HIDDEN" } }), res);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          quizId,
          studentId: "student-1",
          sessionId: "session-1",
          violationCount: 1,
          lastViolationType: "TAB_HIDDEN",
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("returns the accumulated count for repeated violations", async () => {
    mockUpsert.mockResolvedValueOnce({ id: "attempt-1", violationCount: 4 });
    const res = makeRes();

    await reportViolation(makeReq({ body: { quizId, type: "PASTE" } }), res);

    expect(res.json).toHaveBeenCalledWith({ success: true, violationCount: 4 });
  });

  it("rejects a student without a VALID START submission", async () => {
    mockCheckpoint.mockResolvedValueOnce({ id: "checkpoint-1", submissions: [] });
    const res = makeRes();

    await reportViolation(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects a student who is not enrolled in the quiz class", async () => {
    mockEnrollment.mockResolvedValueOnce(null);
    const res = makeRes();

    await reportViolation(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects an inactive quiz", async () => {
    mockQuiz.mockResolvedValueOnce(null);
    const res = makeRes();

    await reportViolation(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects an unknown violation type", async () => {
    const res = makeRes();

    await reportViolation(makeReq({ body: { quizId, type: "SCREENSHOT" } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockQuiz).not.toHaveBeenCalled();
  });
});
