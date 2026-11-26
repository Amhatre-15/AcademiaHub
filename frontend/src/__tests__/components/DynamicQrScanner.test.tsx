/**
 * DynamicQrScanner.test.tsx
 * Camera lifecycle, permission failure, session binding, and successful scan
 * callback. The real html5-qrcode camera is replaced with a deterministic mock.
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DynamicQrScanner from "../../components/attendance/DynamicQrScanner";

const qr = vi.hoisted(() => ({
  getCameras: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("html5-qrcode", () => ({
  Html5Qrcode: class {
    static getCameras = qr.getCameras;
    start = qr.start;
    stop = qr.stop;
    isScanning = true;
  },
}));

const parseScannedQr = vi.hoisted(() => vi.fn());
const playScanSuccessSound = vi.hoisted(() => vi.fn());

vi.mock("../../utils/qrAttendance", () => ({
  parseScannedQr,
  playScanSuccessSound,
}));

beforeEach(() => {
  vi.clearAllMocks();
  qr.getCameras.mockResolvedValue([
    { id: "back-camera", label: "Back Camera" },
    { id: "front-camera", label: "Front Camera" },
  ]);
  qr.start.mockImplementation(async (_camera, _config, onSuccess: (text: string) => void) => {
    onSuccess("scanned-payload");
  });
  qr.stop.mockResolvedValue(undefined);
  parseScannedQr.mockReturnValue({ sid: "session-1", cid: "checkpoint-1", t: 1, hash: "abc" });
});

describe("DynamicQrScanner", () => {
  it("enumerates cameras, prefers the rear camera, and starts scanning", async () => {
    render(<DynamicQrScanner sessionId="session-1" onScanSuccess={vi.fn()} />);

    await waitFor(() => expect(qr.getCameras).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(qr.start).toHaveBeenCalled());
    expect(qr.start.mock.calls[0][0]).toBe("back-camera");
  });

  it("calls onScanSuccess for a valid QR belonging to this session", async () => {
    const onScanSuccess = vi.fn();
    render(<DynamicQrScanner sessionId="session-1" onScanSuccess={onScanSuccess} />);

    await waitFor(() => expect(onScanSuccess).toHaveBeenCalledWith("scanned-payload"));
    expect(parseScannedQr).toHaveBeenCalledWith("scanned-payload");
    expect(playScanSuccessSound).toHaveBeenCalled();
    expect(await screen.findByText(/QR Captured/i)).toBeInTheDocument();
  });

  it("rejects a QR captured from a different session", async () => {
    parseScannedQr.mockReturnValue({ sid: "other-session", cid: "checkpoint-1", t: 1, hash: "abc" });
    const onScanSuccess = vi.fn();
    render(<DynamicQrScanner sessionId="session-1" onScanSuccess={onScanSuccess} />);

    expect(await screen.findByText(/different session/i)).toBeInTheDocument();
    expect(onScanSuccess).not.toHaveBeenCalled();
  });

  it("shows a camera notice and allows retry when permission is denied", async () => {
    qr.getCameras.mockRejectedValueOnce(new Error("Permission denied"));
    qr.start.mockRejectedValueOnce(new Error("Permission denied"));

    render(<DynamicQrScanner sessionId="session-1" onScanSuccess={vi.fn()} />);

    expect(await screen.findByText(/Camera Notice/i)).toBeInTheDocument();
    expect(screen.getByText(/Permission denied/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry camera/i }));
    await waitFor(() => expect(qr.start).toHaveBeenCalledTimes(2));
  });

  it("falls back to the environment-facing camera when enumeration is unavailable", async () => {
    qr.getCameras.mockRejectedValueOnce(new Error("not supported"));

    render(<DynamicQrScanner sessionId="session-1" onScanSuccess={vi.fn()} />);

    await waitFor(() => expect(qr.start).toHaveBeenCalled());
    expect(qr.start.mock.calls[0][0]).toEqual({ facingMode: "environment" });
  });
});
