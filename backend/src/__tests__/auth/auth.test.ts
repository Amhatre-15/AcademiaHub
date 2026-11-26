/**
 * auth.test.ts
 * Unit tests for AcademiaHub authentication utilities and middleware.
 *
 * Covers:
 *  - hashPassword / verifyPassword (bcrypt helpers)
 *  - signJwt / decodeJwt (JWT signing and decode)
 *  - requireAuth middleware (token extraction, DB re-verification, inactive guard)
 *  - requireFirstLoginComplete middleware (firstLogin flag enforcement)
 */

// ─── Stub environment BEFORE any module that calls requireEnv() is imported ─────
process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
process.env["DIRECT_URL"] = "postgresql://test:test@localhost:5432/test";
process.env["SUPABASE_URL"] = "https://test.supabase.co";
process.env["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-role-key";
process.env["JWT_SECRET"] = "super-secret-test-key-for-jest-auth-tests";
process.env["JWT_EXPIRES_IN"] = "7d";

// ─── Mock Prisma client so no real DB is needed ───────────────────────────────
jest.mock("../../config/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import { hashPassword, verifyPassword, signJwt, decodeJwt } from "../../utils/auth";
import { requireAuth, requireFirstLoginComplete } from "../../middleware/auth";
import { prisma } from "../../config/prisma";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const mockFindUnique = prisma.user.findUnique as jest.Mock;

function makeReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, user: undefined, ...overrides } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe("Auth Utils — hashPassword and verifyPassword", () => {
  it("should hash a password to a bcrypt string", async () => {
    const hash = await hashPassword("TestPass@1");
    expect(hash).toBeDefined();
    expect(hash.length).toBeGreaterThanOrEqual(60);
    expect(hash).toMatch(/^\$2[aby]\$\d+\$/);
  });

  it("should verify the correct password against its hash", async () => {
    const hash = await hashPassword("Correct$1");
    expect(await verifyPassword("Correct$1", hash)).toBe(true);
  });

  it("should reject an incorrect password against a valid hash", async () => {
    const hash = await hashPassword("RealPassword@9");
    expect(await verifyPassword("WrongPassword@9", hash)).toBe(false);
  });

  it("should produce different hashes for the same password (salting)", async () => {
    const hash1 = await hashPassword("SameInput!1");
    const hash2 = await hashPassword("SameInput!1");
    expect(hash1).not.toEqual(hash2);
  });
});

describe("Auth Utils — signJwt and decodeJwt", () => {
  const userId = "user-uuid-abc123";
  const role = "STUDENT" as const;

  it("should sign a valid JWT with userId and role claims", () => {
    const token = signJwt(userId, role);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);
  });

  it("should decode the signed JWT and recover the original payload", () => {
    const token = signJwt(userId, role);
    const decoded = decodeJwt(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe(userId);
    expect(decoded!.role).toBe(role);
  });

  it("should include iat and exp in the JWT payload", () => {
    const token = signJwt(userId, role);
    const decoded = decodeJwt(token);
    expect(decoded!.iat).toBeDefined();
    expect(decoded!.exp).toBeDefined();
    expect(decoded!.exp!).toBeGreaterThan(decoded!.iat!);
  });

  it("should not throw when decoding a malformed token", () => {
    expect(() => decodeJwt("not.a.validtoken")).not.toThrow();
  });

  it("should sign JWTs for all three roles", () => {
    const roles = ["IT_ADMIN", "FACULTY", "STUDENT"] as const;
    roles.forEach((r) => {
      const token = signJwt("some-user-id", r);
      const decoded = decodeJwt(token);
      expect(decoded!.role).toBe(r);
    });
  });
});

describe("requireAuth middleware", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("should return 401 when Authorization header is missing", async () => {
    const req = makeReq({ headers: {} });
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 when header does not start with Bearer", async () => {
    const req = makeReq({ headers: { authorization: "Basic abc123" } });
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 for a malformed token", async () => {
    const req = makeReq({ headers: { authorization: "Bearer this.is.garbage" } });
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Invalid or expired token." }));
  });

  it("should return 401 when token is signed with wrong secret", async () => {
    const badToken = jwt.sign({ userId: "x", role: "STUDENT" }, "wrong-secret");
    const req = makeReq({ headers: { authorization: `Bearer ${badToken}` } });
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Invalid or expired token." }));
  });

  it("should return 401 when user is not found in database", async () => {
    const token = signJwt("nonexistent-user", "STUDENT");
    mockFindUnique.mockResolvedValueOnce(null);
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "User not found." }));
  });

  it("should return 403 when user account is INACTIVE", async () => {
    const token = signJwt("inactive-user-id", "FACULTY");
    mockFindUnique.mockResolvedValueOnce({
      id: "inactive-user-id", role: "FACULTY", username: "prof.inactive",
      status: "INACTIVE", student: null, faculty: { id: "fac-001" },
    });
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("deactivated") }));
  });

  it("should attach req.user and call next() for a valid STUDENT token", async () => {
    const userId = "student-uuid-001";
    const token = signJwt(userId, "STUDENT");
    mockFindUnique.mockResolvedValueOnce({
      id: userId, role: "STUDENT", username: "john.doe", status: "ACTIVE",
      student: { id: "stud-profile-001" }, faculty: null,
    });
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ userId, role: "STUDENT", username: "john.doe", studentId: "stud-profile-001" });
  });

  it("should attach req.user and call next() for a valid FACULTY token", async () => {
    const userId = "faculty-uuid-002";
    const token = signJwt(userId, "FACULTY");
    mockFindUnique.mockResolvedValueOnce({
      id: userId, role: "FACULTY", username: "prof.smith", status: "ACTIVE",
      student: null, faculty: { id: "fac-profile-002" },
    });
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ userId, role: "FACULTY", facultyId: "fac-profile-002" });
  });

  it("should attach req.user and call next() for a valid IT_ADMIN token", async () => {
    const userId = "admin-uuid-003";
    const token = signJwt(userId, "IT_ADMIN");
    mockFindUnique.mockResolvedValueOnce({
      id: userId, role: "IT_ADMIN", username: "admin", status: "ACTIVE",
      student: null, faculty: null,
    });
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user?.role).toBe("IT_ADMIN");
  });
});

describe("requireFirstLoginComplete middleware", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("should return 401 when req.user is not set", async () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    await requireFirstLoginComplete(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("should return 403 with FIRST_LOGIN_REQUIRED when firstLogin is true", async () => {
    mockFindUnique.mockResolvedValueOnce({ firstLogin: true });
    const req = makeReq({ user: { userId: "user-1", role: "FACULTY", username: "new.fac" } });
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    await requireFirstLoginComplete(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "FIRST_LOGIN_REQUIRED" }));
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next() when firstLogin is false", async () => {
    mockFindUnique.mockResolvedValueOnce({ firstLogin: false });
    const req = makeReq({ user: { userId: "user-2", role: "STUDENT", username: "old.student" } });
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    await requireFirstLoginComplete(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
