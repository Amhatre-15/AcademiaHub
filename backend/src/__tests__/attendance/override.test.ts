/**
 * Manual attendance override + immutable audit trail.
 *
 * The state machine handles automatic START/END inference; this suite covers
 * the faculty escape hatch that must always record who changed what and why.
 */

process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
process.env["DIRECT_URL"] = "postgresql://test:test@localhost:5432/test";

jest.mock("../../config/prisma", () => ({
  prisma: {
    classSession: { findFirst: jest.fn() },
    enrollment: { findFirst: jest.fn() },
    attendanceRecord: { findUnique: jest.fn(), upsert: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}));

import { Request, Response } from "express";
import { overrideAttendance } from "../../controllers/faculty/AttendanceController";
import { prisma } from "../../config/prisma";

const mockSession = prisma.classSession.findFirst as jest.Mock;
const mockEnrollment = prisma.enrollment.findFirst as jest.Mock;
const mockFindRecord = prisma.attendanceRecord.findUnique as jest.Mock;
const mockUpsert = prisma.attendanceRecord.upsert as jest.Mock;
const mockAudit = prisma.auditLog.create as jest.Mock;

const baseSession = {
  id: "session-1",
  classId: "class-1",
  divisionId: "division-1",
  batchId: "batch-1",
};

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { userId: "user-1", facultyId: "faculty-1", role: "FACULTY" },
    params: { sessionId: "session-1", studentId: "student-1" },
    body: { finalStatus: "PRESENT", reason: "Medical leave verified by office" },
    ip: "127.0.0.1",
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
  mockSession.mockResolvedValue(baseSession);
  mockEnrollment.mockResolvedValue({ id: "enrollment-1" });
  mockFindRecord.mockResolvedValue(null);
  mockUpsert.mockImplementation(async (args: any) => ({
    id: "record-1",
    automatedStatus: args.create.automatedStatus ?? "ABSENT",
    finalStatus: args.create.finalStatus,
    overrideReason: args.create.overrideReason,
    overriddenAt: args.create.overriddenAt,
  }));
  mockAudit.mockResolvedValue({ id: "audit-1" });
});

describe("Attendance override — authorization", () => {
  it("rejects a session that is not owned by the calling faculty member", async () => {
    mockSession.mockResolvedValueOnce(null);
    const req = makeReq();
    const res = makeRes();

    await overrideAttendance(req, res);

    expect(mockSession).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session-1", facultyId: "faculty-1" },
      })
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("rejects a student who is not enrolled in the session's class", async () => {
    mockEnrollment.mockResolvedValueOnce(null);
    const req = makeReq();
    const res = makeRes();

    await overrideAttendance(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects an override without a reason", async () => {
    const req = makeReq({ body: { finalStatus: "PRESENT", reason: "" } });
    const res = makeRes();

    await overrideAttendance(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockSession).not.toHaveBeenCalled();
  });

  it("rejects an unknown attendance status", async () => {
    const req = makeReq({ body: { finalStatus: "HOLIDAY", reason: "N/A" } });
    const res = makeRes();

    await overrideAttendance(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe("Attendance override — persistence and audit logging", () => {
  it("upserts the record and writes an audit entry with before/after data", async () => {
    mockFindRecord.mockResolvedValueOnce({ id: "record-1", finalStatus: "LATE" });
    const req = makeReq();
    const res = makeRes();

    await overrideAttendance(req, res);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId_studentId: { sessionId: "session-1", studentId: "student-1" } },
        update: expect.objectContaining({
          finalStatus: "PRESENT",
          overrideReason: "Medical leave verified by office",
          overriddenBy: "user-1",
        }),
      })
    );

    expect(mockAudit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        action: "ATTENDANCE_OVERRIDE",
        entityType: "attendance_record",
        entityId: "record-1",
        beforeData: { finalStatus: "LATE" },
        afterData: { finalStatus: "PRESENT" },
        reason: "Medical leave verified by office",
        ipAddress: "127.0.0.1",
      }),
    });

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        record: expect.objectContaining({ finalStatus: "PRESENT" }),
      })
    );
  });

  it("records beforeData as null/undefined when creating the first attendance record", async () => {
    const req = makeReq({ body: { finalStatus: "ABSENT", reason: "No show" } });
    const res = makeRes();

    await overrideAttendance(req, res);

    const auditPayload = mockAudit.mock.calls[0][0].data;
    expect(auditPayload.beforeData).toBeUndefined();
    expect(auditPayload.afterData).toEqual({ finalStatus: "ABSENT" });
  });
});
