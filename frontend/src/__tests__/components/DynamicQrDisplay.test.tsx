/**
 * DynamicQrDisplay.test.tsx
 * Verifies the projector QR rotates on the 1-second cadence and keeps the
 * countdown/backup-code affordances working.
 */

import { render, screen, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import DynamicQrDisplay from "../../components/attendance/DynamicQrDisplay";
import type { AttendanceCheckpoint } from "../../api/faculty";

const toCanvas = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("qrcode", () => ({
  default: { toCanvas },
}));

vi.mock("../../utils/qrAttendance", () => ({
  generateDynamicQrToken: vi.fn(async (_secret: string, _id: string, sec: number) => `token-${sec}`),
  formatQrPayload: vi.fn((payload: { t: number }) => `payload-${payload.t}`),
}));

function checkpoint(overrides: Partial<AttendanceCheckpoint> = {}): AttendanceCheckpoint {
  return {
    id: "checkpoint-1",
    checkpointType: "START",
    code: "AB12",
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
    isActive: true,
    qrSecret: "a".repeat(64),
    ...overrides,
  } as AttendanceCheckpoint;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
  toCanvas.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DynamicQrDisplay", () => {
  it("renders the initial QR and rotates it every second", async () => {
    render(
      <DynamicQrDisplay
        checkpoint={checkpoint()}
        sessionId="session-1"
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(toCanvas).toHaveBeenCalledTimes(1);
    const firstPayload = toCanvas.mock.calls[0][1];

    await act(async () => {
      vi.advanceTimersByTime(1_100);
      await Promise.resolve();
    });

    expect(toCanvas).toHaveBeenCalledTimes(2);
    expect(toCanvas.mock.calls[1][1]).not.toBe(firstPayload);
    expect(screen.getByText(/Dynamic QR.*1s Rotation/i)).toBeInTheDocument();
  });

  it("shows the backup code only after the reveal toggle is clicked", async () => {
    render(<DynamicQrDisplay checkpoint={checkpoint()} sessionId="session-1" />);

    expect(screen.queryByText("AB12")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /backup code/i }));

    expect(screen.getByText("AB12")).toBeInTheDocument();
  });

  it("opens projector mode with a larger canvas", async () => {
    render(<DynamicQrDisplay checkpoint={checkpoint()} sessionId="session-1" />);

    fireEvent.click(screen.getByRole("button", { name: /projector mode/i }));

    expect(screen.getByText(/Scan with your AcademiaHub app/i)).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
    expect(toCanvas.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
