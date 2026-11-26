/**
 * rbac.test.ts
 * Unit tests for Role-Based Access Control (RBAC) — requireRole() middleware.
 *
 * Verifies that:
 *  - Students cannot access IT_ADMIN or FACULTY routes
 *  - Faculty cannot access IT_ADMIN routes
 *  - IT_ADMIN has access to all admin routes
 *  - Multi-role acceptance works correctly
 *  - Missing req.user is handled
 */

process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
process.env["DIRECT_URL"] = "postgresql://test:test@localhost:5432/test";
process.env["SUPABASE_URL"] = "https://test.supabase.co";
process.env["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-role-key";
process.env["JWT_SECRET"] = "super-secret-test-key-for-rbac-tests";

import { requireRole } from "../../middleware/auth";
import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";

function makeReq(role?: Role): Request {
  if (role) {
    return {
      user: { userId: "user-id", role, username: "testuser" },
    } as unknown as Request;
  }
  return { user: undefined } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe("requireRole() RBAC middleware", () => {
  describe("Missing authentication", () => {
    it("should return 401 when req.user is not attached (unauthenticated request)", () => {
      const middleware = requireRole("IT_ADMIN");
      const req = makeReq();
      const res = makeRes();
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Authentication required." }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("STUDENT role restrictions", () => {
    it("should block STUDENT from accessing IT_ADMIN-only routes", () => {
      const middleware = requireRole("IT_ADMIN");
      const req = makeReq("STUDENT");
      const res = makeRes();
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("permission") }));
      expect(next).not.toHaveBeenCalled();
    });

    it("should block STUDENT from accessing FACULTY-only routes", () => {
      const middleware = requireRole("FACULTY");
      const req = makeReq("STUDENT");
      const res = makeRes();
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("should allow STUDENT to access STUDENT-only routes", () => {
      const middleware = requireRole("STUDENT");
      const req = makeReq("STUDENT");
      const res = makeRes();
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("FACULTY role restrictions", () => {
    it("should block FACULTY from accessing IT_ADMIN-only routes", () => {
      const middleware = requireRole("IT_ADMIN");
      const req = makeReq("FACULTY");
      const res = makeRes();
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("should block FACULTY from accessing STUDENT-only routes", () => {
      const middleware = requireRole("STUDENT");
      const req = makeReq("FACULTY");
      const res = makeRes();
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("should allow FACULTY to access FACULTY-only routes", () => {
      const middleware = requireRole("FACULTY");
      const req = makeReq("FACULTY");
      const res = makeRes();
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("IT_ADMIN role access", () => {
    it("should allow IT_ADMIN to access IT_ADMIN-only routes", () => {
      const middleware = requireRole("IT_ADMIN");
      const req = makeReq("IT_ADMIN");
      const res = makeRes();
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should block IT_ADMIN from accessing STUDENT-only routes", () => {
      const middleware = requireRole("STUDENT");
      const req = makeReq("IT_ADMIN");
      const res = makeRes();
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("should block IT_ADMIN from accessing FACULTY-only routes", () => {
      const middleware = requireRole("FACULTY");
      const req = makeReq("IT_ADMIN");
      const res = makeRes();
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Multi-role acceptance (requireRole with multiple allowed roles)", () => {
    it("should allow IT_ADMIN when both IT_ADMIN and FACULTY are accepted", () => {
      const middleware = requireRole(["IT_ADMIN", "FACULTY"]);
      const req = makeReq("IT_ADMIN");
      const res = makeRes();
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should allow FACULTY when both IT_ADMIN and FACULTY are accepted", () => {
      const middleware = requireRole(["IT_ADMIN", "FACULTY"]);
      const req = makeReq("FACULTY");
      const res = makeRes();
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should block STUDENT when only IT_ADMIN and FACULTY are accepted", () => {
      const middleware = requireRole(["IT_ADMIN", "FACULTY"]);
      const req = makeReq("STUDENT");
      const res = makeRes();
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("should allow all three roles when all are specified", () => {
      const middleware = requireRole(["IT_ADMIN", "FACULTY", "STUDENT"]);
      const roles: Role[] = ["IT_ADMIN", "FACULTY", "STUDENT"];

      roles.forEach((role) => {
        const req = makeReq(role);
        const res = makeRes();
        const next = jest.fn() as NextFunction;
        middleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    it("should support spread syntax: requireRole('FACULTY', 'STUDENT')", () => {
      const middleware = requireRole("FACULTY", "STUDENT");
      const next1 = jest.fn() as NextFunction;
      middleware(makeReq("FACULTY"), makeRes(), next1);
      expect(next1).toHaveBeenCalledTimes(1);

      const next2 = jest.fn() as NextFunction;
      middleware(makeReq("STUDENT"), makeRes(), next2);
      expect(next2).toHaveBeenCalledTimes(1);

      const next3 = jest.fn() as NextFunction;
      const res3 = makeRes();
      middleware(makeReq("IT_ADMIN"), res3, next3);
      expect(res3.status).toHaveBeenCalledWith(403);
      expect(next3).not.toHaveBeenCalled();
    });
  });
});
