/**
 * session.test.ts
 * Unit tests for the ClassSession lifecycle state machine and utility logic.
 *
 * Covers:
 *  - Session status transitions (PREPARED → ACTIVE → CLOSED)
 *  - generateAttendanceCode guard logic (duplicate checkpoint prevention)
 *  - Attendance code expiry and validation logic integrated with session state
 *  - determineAttendanceStatus integration with session lifecycle
 *  - deriveCheckpointSecret determinism for QR code generation
 */

process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
process.env["DIRECT_URL"] = "postgresql://test:test@localhost:5432/test";
process.env["SUPABASE_URL"] = "https://test.supabase.co";
process.env["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-role-key";
process.env["JWT_SECRET"] = "super-secret-test-key-for-session-tests";

import {
  determineAttendanceStatus,
  deriveCheckpointSecret,
  generateDynamicQrToken,
  verifyDynamicQrToken,
  generateAttendanceCode,
  generateExpiry,
  isCodeValid,
  getRemainingSeconds,
} from "../../utils/attendance";

// ─── Session status enum mirrors Prisma enum ─────────────────────────────────
type SessionStatus = "PREPARED" | "ACTIVE" | "CLOSED";

/**
 * Lightweight in-memory simulation of the session state machine.
 * Mirrors the real transition logic in SessionController.ts without DB I/O.
 */
class SessionStateMachine {
  private status: SessionStatus;
  private checkpoints: Map<string, { type: string; openedAt: Date; closedAt?: Date }> = new Map();

  constructor(initialStatus: SessionStatus = "PREPARED") {
    this.status = initialStatus;
  }

  getStatus(): SessionStatus { return this.status; }

  start(): void {
    if (this.status !== "PREPARED") throw new Error("Only PREPARED sessions can be started.");
    this.status = "ACTIVE";
  }

  close(): void {
    if (this.status !== "ACTIVE") throw new Error("Only ACTIVE sessions can be closed.");
    this.status = "CLOSED";
  }

  openCheckpoint(type: "START" | "END"): void {
    if (this.status !== "ACTIVE") throw new Error("Checkpoints can only be opened for ACTIVE sessions.");
    if (this.checkpoints.has(type)) throw new Error(`${type} checkpoint already exists for this session.`);
    this.checkpoints.set(type, { type, openedAt: new Date() });
  }

  hasCheckpoint(type: "START" | "END"): boolean {
    return this.checkpoints.has(type);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: Session Status Transitions
// ─────────────────────────────────────────────────────────────────────────────
describe("Session Lifecycle — Status State Machine", () => {
  it("should initialize with PREPARED status by default", () => {
    const machine = new SessionStateMachine();
    expect(machine.getStatus()).toBe("PREPARED");
  });

  it("should transition from PREPARED to ACTIVE on start()", () => {
    const machine = new SessionStateMachine("PREPARED");
    machine.start();
    expect(machine.getStatus()).toBe("ACTIVE");
  });

  it("should transition from ACTIVE to CLOSED on close()", () => {
    const machine = new SessionStateMachine("ACTIVE");
    machine.close();
    expect(machine.getStatus()).toBe("CLOSED");
  });

  it("should NOT allow starting an already ACTIVE session", () => {
    const machine = new SessionStateMachine("ACTIVE");
    expect(() => machine.start()).toThrow("Only PREPARED sessions can be started.");
  });

  it("should NOT allow closing a PREPARED session", () => {
    const machine = new SessionStateMachine("PREPARED");
    expect(() => machine.close()).toThrow("Only ACTIVE sessions can be closed.");
  });

  it("should NOT allow closing an already CLOSED session", () => {
    const machine = new SessionStateMachine("CLOSED");
    expect(() => machine.close()).toThrow("Only ACTIVE sessions can be closed.");
  });

  it("should execute the full PREPARED → ACTIVE → CLOSED lifecycle without error", () => {
    const machine = new SessionStateMachine("PREPARED");
    expect(() => {
      machine.start();
      machine.close();
    }).not.toThrow();
    expect(machine.getStatus()).toBe("CLOSED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: Attendance Checkpoint Guards
// ─────────────────────────────────────────────────────────────────────────────
describe("Session Lifecycle — Checkpoint Management Guards", () => {
  it("should allow opening a START checkpoint on an ACTIVE session", () => {
    const machine = new SessionStateMachine("ACTIVE");
    expect(() => machine.openCheckpoint("START")).not.toThrow();
    expect(machine.hasCheckpoint("START")).toBe(true);
  });

  it("should allow opening an END checkpoint after START on an ACTIVE session", () => {
    const machine = new SessionStateMachine("ACTIVE");
    machine.openCheckpoint("START");
    expect(() => machine.openCheckpoint("END")).not.toThrow();
    expect(machine.hasCheckpoint("END")).toBe(true);
  });

  it("should reject a duplicate START checkpoint on the same session", () => {
    const machine = new SessionStateMachine("ACTIVE");
    machine.openCheckpoint("START");
    expect(() => machine.openCheckpoint("START")).toThrow("START checkpoint already exists");
  });

  it("should reject a duplicate END checkpoint on the same session", () => {
    const machine = new SessionStateMachine("ACTIVE");
    machine.openCheckpoint("START");
    machine.openCheckpoint("END");
    expect(() => machine.openCheckpoint("END")).toThrow("END checkpoint already exists");
  });

  it("should reject opening a checkpoint for a non-ACTIVE session", () => {
    const prepared = new SessionStateMachine("PREPARED");
    expect(() => prepared.openCheckpoint("START")).toThrow("ACTIVE sessions");

    const closed = new SessionStateMachine("CLOSED");
    expect(() => closed.openCheckpoint("END")).toThrow("ACTIVE sessions");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: End-to-End attendance status after session closes
// ─────────────────────────────────────────────────────────────────────────────
describe("Session Lifecycle — Final Attendance Calculation on Session Close", () => {
  interface StudentAttendanceSim {
    name: string;
    submittedStart: boolean;
    submittedEnd: boolean;
    expectedStatus: string;
  }

  const attendanceScenarios: StudentAttendanceSim[] = [
    { name: "Alice (attended whole session)", submittedStart: true, submittedEnd: true, expectedStatus: "PRESENT" },
    { name: "Bob (left early — START only)", submittedStart: true, submittedEnd: false, expectedStatus: "PARTIAL" },
    { name: "Carol (arrived late — END only)", submittedStart: false, submittedEnd: true, expectedStatus: "LATE" },
    { name: "Dave (skipped session entirely)", submittedStart: false, submittedEnd: false, expectedStatus: "ABSENT" },
  ];

  it.each(attendanceScenarios)(
    "should compute $expectedStatus for $name",
    ({ submittedStart, submittedEnd, expectedStatus }) => {
      const status = determineAttendanceStatus(submittedStart, submittedEnd);
      expect(status).toBe(expectedStatus);
    }
  );

  it("should correctly compute attendance for a full classroom scenario (30 students)", () => {
    const students = [
      ...Array(15).fill({ start: true, end: true }),   // 15 PRESENT
      ...Array(5).fill({ start: true, end: false }),    // 5 PARTIAL
      ...Array(5).fill({ start: false, end: true }),    // 5 LATE
      ...Array(5).fill({ start: false, end: false }),   // 5 ABSENT
    ];

    const counts = { PRESENT: 0, PARTIAL: 0, LATE: 0, ABSENT: 0 };
    students.forEach(({ start, end }) => {
      const status = determineAttendanceStatus(start, end);
      counts[status as keyof typeof counts]++;
    });

    expect(counts.PRESENT).toBe(15);
    expect(counts.PARTIAL).toBe(5);
    expect(counts.LATE).toBe(5);
    expect(counts.ABSENT).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: Checkpoint Secret Determinism and QR token issuance for sessions
// ─────────────────────────────────────────────────────────────────────────────
describe("Session Lifecycle — Checkpoint Secret and QR Token Binding", () => {
  const mockCheckpointStart = {
    id: "sess-abc:chk-start-001",
    code: "ABCD",
    createdAt: new Date("2026-10-20T10:00:00Z"),
  };

  const mockCheckpointEnd = {
    id: "sess-abc:chk-end-002",
    code: "WXYZ",
    createdAt: new Date("2026-10-20T10:50:00Z"),
  };

  it("should derive different secrets for START and END checkpoints in the same session", () => {
    const startSecret = deriveCheckpointSecret(mockCheckpointStart);
    const endSecret = deriveCheckpointSecret(mockCheckpointEnd);
    expect(startSecret).not.toEqual(endSecret);
  });

  it("should derive consistent secrets (idempotent) for the same checkpoint", () => {
    const s1 = deriveCheckpointSecret(mockCheckpointStart);
    const s2 = deriveCheckpointSecret(mockCheckpointStart);
    expect(s1).toEqual(s2);
  });

  it("should issue tokens that validate successfully within tolerance window", () => {
    const secret = deriveCheckpointSecret(mockCheckpointStart);
    const now = Math.floor(Date.now() / 1000);
    const token = generateDynamicQrToken(secret, mockCheckpointStart.id, now);

    const result = verifyDynamicQrToken(secret, mockCheckpointStart.id, now, token, 6);
    expect(result.valid).toBe(true);
  });

  it("should reject a START checkpoint token when validated against the END checkpoint secret", () => {
    const startSecret = deriveCheckpointSecret(mockCheckpointStart);
    const endSecret = deriveCheckpointSecret(mockCheckpointEnd);
    const now = Math.floor(Date.now() / 1000);
    const startToken = generateDynamicQrToken(startSecret, mockCheckpointStart.id, now);

    // Try verifying start token against end checkpoint — should fail
    const result = verifyDynamicQrToken(endSecret, mockCheckpointEnd.id, now, startToken, 6);
    expect(result.valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 5: Attendance code lifecycle within a session
// ─────────────────────────────────────────────────────────────────────────────
describe("Session Lifecycle — Attendance Code Validity Windows", () => {
  it("should generate a unique code for each invocation", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateAttendanceCode(4)));
    // With 32^4 = 1,048,576 possible 4-char codes, no collision in 50 samples is expected
    expect(codes.size).toBeGreaterThanOrEqual(45);
  });

  it("should mark a code as valid immediately after generation", () => {
    const expiry = generateExpiry(60);
    expect(isCodeValid(expiry)).toBe(true);
    expect(getRemainingSeconds(expiry)).toBeGreaterThan(55);
  });

  it("should mark a code as expired when expiry is in the past", () => {
    const expired = new Date(Date.now() - 1000);
    expect(isCodeValid(expired)).toBe(false);
    expect(getRemainingSeconds(expired)).toBe(0);
  });

  it("should calculate remaining seconds decreasing over time (simulation)", () => {
    const now = Date.now();
    const futureExpiry = new Date(now + 30000);
    const remaining = getRemainingSeconds(futureExpiry);
    expect(remaining).toBeGreaterThanOrEqual(28);
    expect(remaining).toBeLessThanOrEqual(30);
  });
});
