process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
process.env["DIRECT_URL"] = "postgresql://test:test@localhost:5432/test";

jest.mock("../../config/prisma", () => ({
  prisma: {
    classSession: { findUnique: jest.fn(), update: jest.fn() },
    enrollment: { findFirst: jest.fn() },
    classroomDoubt: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    doubtUpvote: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), count: jest.fn() },
  },
}));

jest.mock("../../websocket/SessionManager", () => ({
  sessionManager: {
    broadcastToSession: jest.fn(),
  },
}));

import { Request, Response } from "express";
import {
  listSessionDoubts,
  createDoubt,
  toggleUpvote,
  updateDoubtStatus,
} from "../../controllers/shared/DoubtController";
import { prisma } from "../../config/prisma";
import { sessionManager } from "../../websocket/SessionManager";

const mockSession = prisma.classSession.findUnique as jest.Mock;
const mockEnrollment = prisma.enrollment.findFirst as jest.Mock;
const mockFindManyDoubts = prisma.classroomDoubt.findMany as jest.Mock;
const mockFindFirstDoubt = prisma.classroomDoubt.findFirst as jest.Mock;
const mockCreateDoubt = prisma.classroomDoubt.create as jest.Mock;
const mockUpdateDoubt = prisma.classroomDoubt.update as jest.Mock;
const mockFindUpvote = prisma.doubtUpvote.findUnique as jest.Mock;
const mockCreateUpvote = prisma.doubtUpvote.create as jest.Mock;
const mockDeleteUpvote = prisma.doubtUpvote.delete as jest.Mock;
const mockCountUpvotes = prisma.doubtUpvote.count as jest.Mock;
const mockBroadcast = sessionManager.broadcastToSession as jest.Mock;

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.mockResolvedValue({ id: "session-1", classId: "class-1", facultyId: "faculty-1", status: "ACTIVE" });
  mockEnrollment.mockResolvedValue({ id: "enrollment-1", studentId: "student-1", classId: "class-1" });
});

describe("Classroom In-Session Doubt Queue (Phase 19)", () => {
  describe("listSessionDoubts", () => {
    it("sorts pending doubts by upvotes descending and masks anonymous author name for peers", async () => {
      const doubts = [
        {
          id: "d-1",
          sessionId: "session-1",
          studentId: "student-2",
          question: "Can you explain Dijkstra again?",
          isAnonymous: true,
          status: "PENDING",
          createdAt: new Date("2026-10-23T10:00:00Z"),
          student: { id: "student-2", firstName: "Alice", lastName: "Smith", prn: "PRN002" },
          _count: { upvotes: 5 },
          upvotes: [],
        },
        {
          id: "d-2",
          sessionId: "session-1",
          studentId: "student-3",
          question: "Is graph directed or undirected?",
          isAnonymous: false,
          status: "PENDING",
          createdAt: new Date("2026-10-23T10:05:00Z"),
          student: { id: "student-3", firstName: "Bob", lastName: "Jones", prn: "PRN003" },
          _count: { upvotes: 12 },
          upvotes: [{ studentId: "student-1" }],
        },
      ];

      mockFindManyDoubts.mockResolvedValue(doubts);

      const req = {
        params: { sessionId: "session-1" },
        user: { userId: "u-1", studentId: "student-1", role: "STUDENT" },
      } as unknown as Request;
      const res = makeRes();

      await listSessionDoubts(req, res);

      expect(res.json).toHaveBeenCalled();
      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData.doubts).toHaveLength(2);

      // Higher upvotes (12) must appear first
      expect(responseData.doubts[0].id).toBe("d-2");
      expect(responseData.doubts[0].upvotesCount).toBe(12);
      expect(responseData.doubts[0].hasUpvoted).toBe(true);

      // Anonymous scholar masked for peer
      expect(responseData.doubts[1].id).toBe("d-1");
      expect(responseData.doubts[1].authorName).toBe("Anonymous Scholar");
      expect(responseData.doubts[1].authorPrn).toBeUndefined();
    });

    it("reveals author details to faculty even if marked anonymous", async () => {
      mockFindManyDoubts.mockResolvedValue([
        {
          id: "d-1",
          sessionId: "session-1",
          studentId: "student-2",
          question: "Hidden question",
          isAnonymous: true,
          status: "PENDING",
          createdAt: new Date(),
          student: { id: "student-2", firstName: "Alice", lastName: "Smith", prn: "PRN002" },
          _count: { upvotes: 2 },
          upvotes: [],
        },
      ]);

      const req = {
        params: { sessionId: "session-1" },
        user: { userId: "u-fac", facultyId: "faculty-1", role: "FACULTY" },
      } as unknown as Request;
      const res = makeRes();

      await listSessionDoubts(req, res);

      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData.doubts[0].authorName).toBe("Alice Smith");
      expect(responseData.doubts[0].authorPrn).toBe("PRN002");
    });
  });

  describe("createDoubt", () => {
    it("creates doubt and broadcasts to session via WebSocket", async () => {
      const created = {
        id: "d-new",
        sessionId: "session-1",
        studentId: "student-1",
        question: "What is the time complexity of BFS?",
        isAnonymous: false,
        status: "PENDING",
        createdAt: new Date(),
        student: { id: "student-1", firstName: "John", lastName: "Doe", prn: "PRN001" },
      };

      mockCreateDoubt.mockResolvedValue(created);

      const req = {
        params: { sessionId: "session-1" },
        user: { userId: "u-1", studentId: "student-1", role: "STUDENT" },
        body: { question: "What is the time complexity of BFS?", isAnonymous: false },
      } as unknown as Request;
      const res = makeRes();

      await createDoubt(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockBroadcast).toHaveBeenCalledWith("session-1", expect.objectContaining({
        type: "DOUBT_CREATED",
        doubt: expect.objectContaining({ id: "d-new", question: "What is the time complexity of BFS?" }),
      }));
    });

    it("rejects posting doubts when session is closed", async () => {
      mockSession.mockResolvedValue({ id: "session-1", classId: "class-1", status: "CLOSED" });

      const req = {
        params: { sessionId: "session-1" },
        user: { userId: "u-1", studentId: "student-1", role: "STUDENT" },
        body: { question: "Too late question" },
      } as unknown as Request;
      const res = makeRes();

      await createDoubt(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("toggleUpvote", () => {
    it("adds upvote when student has not yet upvoted, and broadcasts new count", async () => {
      mockFindFirstDoubt.mockResolvedValue({ id: "d-1", sessionId: "session-1" });
      mockFindUpvote.mockResolvedValue(null);
      mockCountUpvotes.mockResolvedValue(6);

      const req = {
        params: { sessionId: "session-1", doubtId: "d-1" },
        user: { userId: "u-1", studentId: "student-1", role: "STUDENT" },
      } as unknown as Request;
      const res = makeRes();

      await toggleUpvote(req, res);

      expect(mockCreateUpvote).toHaveBeenCalledWith({ data: { doubtId: "d-1", studentId: "student-1" } });
      expect(mockBroadcast).toHaveBeenCalledWith("session-1", {
        type: "DOUBT_UPVOTED",
        doubtId: "d-1",
        upvotesCount: 6,
      });
      expect(res.json).toHaveBeenCalledWith({ hasUpvoted: true, upvotesCount: 6 });
    });

    it("removes upvote when student already upvoted (toggle off)", async () => {
      mockFindFirstDoubt.mockResolvedValue({ id: "d-1", sessionId: "session-1" });
      mockFindUpvote.mockResolvedValue({ id: "upvote-1" });
      mockCountUpvotes.mockResolvedValue(5);

      const req = {
        params: { sessionId: "session-1", doubtId: "d-1" },
        user: { userId: "u-1", studentId: "student-1", role: "STUDENT" },
      } as unknown as Request;
      const res = makeRes();

      await toggleUpvote(req, res);

      expect(mockDeleteUpvote).toHaveBeenCalledWith({ where: { id: "upvote-1" } });
      expect(res.json).toHaveBeenCalledWith({ hasUpvoted: false, upvotesCount: 5 });
    });
  });

  describe("updateDoubtStatus", () => {
    it("allows owning faculty to mark doubt as ANSWERED and broadcasts to classroom", async () => {
      mockSession.mockResolvedValue({ id: "session-1", facultyId: "faculty-1" });
      mockUpdateDoubt.mockResolvedValue({ id: "d-1", status: "ANSWERED" });

      const req = {
        params: { sessionId: "session-1", doubtId: "d-1" },
        user: { userId: "u-fac", facultyId: "faculty-1", role: "FACULTY" },
        body: { status: "ANSWERED" },
      } as unknown as Request;
      const res = makeRes();

      await updateDoubtStatus(req, res);

      expect(mockUpdateDoubt).toHaveBeenCalledWith({ where: { id: "d-1" }, data: { status: "ANSWERED" } });
      expect(mockBroadcast).toHaveBeenCalledWith("session-1", {
        type: "DOUBT_STATUS_UPDATED",
        doubtId: "d-1",
        status: "ANSWERED",
      });
      expect(res.json).toHaveBeenCalledWith({ doubt: { id: "d-1", status: "ANSWERED" } });
    });
  });
});
