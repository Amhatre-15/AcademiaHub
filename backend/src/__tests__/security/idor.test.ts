/**
 * Object-level authorization (IDOR) checks.
 *
 * A student may only read/update/delete their own private notes. The controller
 * must scope every query by the JWT's studentId rather than trusting the URL.
 */

process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
process.env["DIRECT_URL"] = "postgresql://test:test@localhost:5432/test";

jest.mock("../../config/prisma", () => ({
  prisma: {
    studentNote: {
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { Request, Response } from "express";
import {
  getNote,
  updateNote,
  deleteNote,
} from "../../controllers/student/NotesController";
import { prisma } from "../../config/prisma";

const mockFindFirst = prisma.studentNote.findFirst as jest.Mock;
const mockUpdate = prisma.studentNote.update as jest.Mock;
const mockDelete = prisma.studentNote.delete as jest.Mock;

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { userId: "user-a", studentId: "student-a", role: "STUDENT" },
    params: { id: "note-owned-by-b" },
    body: { title: "Hijacked", content: "should not persist" },
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
});

describe("Student notes — object-level authorization", () => {
  it("scopes getNote by both note id and the authenticated student id", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const res = makeRes();

    await getNote(makeReq(), res);

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "note-owned-by-b", studentId: "student-a" },
      })
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Note not found" });
  });

  it("returns another student's note as 404 instead of leaking its contents", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const res = makeRes();

    await getNote(makeReq({ params: { id: "note-b" } }), res);

    expect(res.json).toHaveBeenCalledWith({ error: "Note not found" });
    expect(mockFindFirst.mock.calls[0][0].where.studentId).toBe("student-a");
  });

  it("prevents updating a note owned by another student", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const res = makeRes();

    await updateNote(makeReq(), res);

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: "note-owned-by-b", studentId: "student-a" },
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("prevents deleting a note owned by another student", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const res = makeRes();

    await deleteNote(makeReq(), res);

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: "note-owned-by-b", studentId: "student-a" },
    });
    expect(mockDelete).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
