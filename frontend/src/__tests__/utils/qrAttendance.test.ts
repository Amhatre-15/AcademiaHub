/**
 * qrAttendance.test.ts
 * Unit tests for the frontend QR attendance utility functions.
 *
 * Covers:
 *  - formatQrPayload: serializes payload to compact JSON
 *  - parseScannedQr: parses valid JSON QR payloads
 *  - parseScannedQr: parses AH_ATTEND: colon-delimited fallback
 *  - parseScannedQr: returns null for invalid/corrupted strings
 *  - generateDynamicQrToken: produces 16-char hex tokens via Web Crypto
 */

import { describe, it, expect } from "vitest";
import {
  formatQrPayload,
  parseScannedQr,
  generateDynamicQrToken,
  type DynamicQrPayload,
} from "../../utils/qrAttendance";

describe("formatQrPayload()", () => {
  it("should serialize a full payload to a JSON string", () => {
    const payload: DynamicQrPayload = {
      sid: "session-001",
      cid: "checkpoint-002",
      t: 1729245600,
      hash: "abcd1234efgh5678",
      type: "START",
    };
    const result = formatQrPayload(payload);
    const parsed = JSON.parse(result);
    expect(parsed.sid).toBe("session-001");
    expect(parsed.cid).toBe("checkpoint-002");
    expect(parsed.t).toBe(1729245600);
    expect(parsed.hash).toBe("abcd1234efgh5678");
    expect(parsed.type).toBe("START");
  });

  it("should produce a compact JSON string (no extra whitespace)", () => {
    const payload: DynamicQrPayload = { sid: "s", cid: "c", t: 1, hash: "h" };
    const result = formatQrPayload(payload);
    expect(result).not.toContain("\n");
    expect(result).not.toMatch(/\s{2,}/);
  });
});

describe("parseScannedQr()", () => {
  it("should parse a valid JSON QR payload", () => {
    const raw = JSON.stringify({
      sid: "sess-100",
      cid: "chk-200",
      t: 1729245600,
      hash: "abc123def456ghij",
      type: "END",
    });
    const result = parseScannedQr(raw);
    expect(result).not.toBeNull();
    expect(result!.sid).toBe("sess-100");
    expect(result!.cid).toBe("chk-200");
    expect(result!.t).toBe(1729245600);
    expect(result!.hash).toBe("abc123def456ghij");
    expect(result!.type).toBe("END");
  });

  it("should parse the AH_ATTEND: colon-delimited fallback format", () => {
    const raw = "AH_ATTEND:chk-abc:sess-xyz:1729245600:hash1234567890ab";
    const result = parseScannedQr(raw);
    expect(result).not.toBeNull();
    expect(result!.cid).toBe("chk-abc");
    expect(result!.sid).toBe("sess-xyz");
    expect(result!.t).toBe(1729245600);
    expect(result!.hash).toBe("hash1234567890ab");
  });

  it("should return null for an empty string", () => {
    expect(parseScannedQr("")).toBeNull();
  });

  it("should return null for random non-QR strings", () => {
    expect(parseScannedQr("hello world")).toBeNull();
    expect(parseScannedQr("https://example.com")).toBeNull();
  });

  it("should return null for invalid JSON objects missing required fields", () => {
    expect(parseScannedQr("{}")).toBeNull();
    expect(parseScannedQr('{"cid":"only"}')).toBeNull();
  });

  it("should return null for AH_ATTEND: with too few segments", () => {
    expect(parseScannedQr("AH_ATTEND:only:two")).toBeNull();
  });

  it("should coerce t to a number even if sent as a string in JSON", () => {
    const raw = JSON.stringify({ sid: "s", cid: "c", t: "1729245600", hash: "h" });
    const result = parseScannedQr(raw);
    expect(result).not.toBeNull();
    expect(typeof result!.t).toBe("number");
    expect(result!.t).toBe(1729245600);
  });
});

describe("generateDynamicQrToken()", () => {
  it("should generate a 16-character hex token", async () => {
    const token = await generateDynamicQrToken("test-secret", "chk-001", 1729245600);
    expect(token).toHaveLength(16);
    expect(token).toMatch(/^[0-9a-f]{16}$/i);
  });

  it("should generate different tokens for different timestamps (1-second rotation)", async () => {
    const secret = "test-secret-key";
    const cid = "chk-rotation-test";
    const t1 = await generateDynamicQrToken(secret, cid, 1000);
    const t2 = await generateDynamicQrToken(secret, cid, 1001);
    expect(t1).not.toBe(t2);
  });

  it("should generate identical tokens for the same inputs (deterministic)", async () => {
    const token1 = await generateDynamicQrToken("secret", "chk-99", 9999);
    const token2 = await generateDynamicQrToken("secret", "chk-99", 9999);
    expect(token1).toBe(token2);
  });

  it("should return empty string when secret is empty", async () => {
    const token = await generateDynamicQrToken("", "chk-001", 1000);
    expect(token).toBe("");
  });

  it("should return empty string when checkpointId is empty", async () => {
    const token = await generateDynamicQrToken("secret", "", 1000);
    expect(token).toBe("");
  });
});
