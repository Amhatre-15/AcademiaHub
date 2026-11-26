import crypto from 'crypto';
import { env } from '../config/env';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars (I,O,0,1)

/**
 * Generate a random attendance code of configurable length.
 * Uses characters that are visually unambiguous when displayed on a projector.
 */
export function generateAttendanceCode(length: number = env.ATTENDANCE_CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

/**
 * Generate expiry timestamp from now
 */
export function generateExpiry(seconds: number = env.ATTENDANCE_CODE_EXPIRY_SECONDS): Date {
  return new Date(Date.now() + seconds * 1000);
}

/**
 * Check if a code is still valid against server time
 * This is the authoritative check — not the browser clock
 */
export function isCodeValid(expiresAt: Date): boolean {
  return new Date() < expiresAt;
}

/**
 * Get remaining seconds for a code
 */
export function getRemainingSeconds(expiresAt: Date): number {
  const remaining = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  return Math.max(0, remaining);
}

/**
 * Derive a cryptographic secret seed for an attendance checkpoint.
 * Only known to the server and the authenticated faculty displaying the live session.
 */
export function deriveCheckpointSecret(checkpoint: { id: string; code: string; createdAt?: Date | string }): string {
  const time = checkpoint.createdAt ? new Date(checkpoint.createdAt).getTime() : 0;
  return crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`${checkpoint.id}:${checkpoint.code}:${time}`)
    .digest('hex');
}

/**
 * Generate 1-second time-based dynamic token for a checkpoint at second t.
 */
export function generateDynamicQrToken(secret: string, checkpointId: string, timestampSeconds: number): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${checkpointId}:${timestampSeconds}`)
    .digest('hex')
    .substring(0, 16);
}

export interface DecodedQrPayload {
  sid: string;
  cid: string;
  t: number;
  hash: string;
  type?: string;
}

/**
 * Parse QR code raw string payload
 */
export function parseDynamicQrPayload(raw: string): DecodedQrPayload | null {
  try {
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && data.cid && data.t && data.hash) {
      return {
        sid: data.sid || '',
        cid: String(data.cid),
        t: Number(data.t),
        hash: String(data.hash),
        type: data.type
      };
    }
  } catch {
    // Check if colon-delimited format: AH_ATTEND:<cid>:<sid>:<t>:<hash>
    if (raw.startsWith('AH_ATTEND:')) {
      const parts = raw.split(':');
      if (parts.length >= 5) {
        return {
          cid: parts[1],
          sid: parts[2],
          t: Number(parts[3]),
          hash: parts[4]
        };
      }
    }
  }
  return null;
}

/**
 * Validate a dynamic QR token submitted by a student.
 * Allows a configurable clock drift / network propagation tolerance window (default 6 seconds).
 */
export function verifyDynamicQrToken(
  secret: string,
  checkpointId: string,
  clientTimestamp: number,
  clientToken: string,
  toleranceSeconds: number = 6
): { valid: boolean; reason?: string } {
  const currentSecond = Math.floor(Date.now() / 1000);
  const age = currentSecond - clientTimestamp;

  // Check if timestamp is too far in future (more than 2 seconds ahead due to clock skew)
  if (age < -2) {
    return { valid: false, reason: 'QR timestamp is from the future. Please ensure your device clock is accurate.' };
  }

  // Check if timestamp has expired (older than tolerance window)
  if (age > toleranceSeconds) {
    return { valid: false, reason: `QR code expired (${age}s old). Codes rotate every 1s. Please scan the current code on screen.` };
  }

  const expectedToken = generateDynamicQrToken(secret, checkpointId, clientTimestamp);

  if (clientToken.toLowerCase() !== expectedToken.toLowerCase()) {
    return { valid: false, reason: 'Security signature mismatch. Invalid QR token.' };
  }

  return { valid: true };
}

export type AttendanceStatus = 'PRESENT' | 'PARTIAL' | 'LATE' | 'ABSENT';

/**
 * Determine final attendance status based on START and END checkpoint submissions.
 * Rule:
 *  - START + END = PRESENT
 *  - START only  = PARTIAL
 *  - END only    = LATE
 *  - Neither     = ABSENT
 */
export function determineAttendanceStatus(hasStart: boolean, hasEnd: boolean): AttendanceStatus {
  if (hasStart && hasEnd) return 'PRESENT';
  if (hasStart && !hasEnd) return 'PARTIAL';
  if (!hasStart && hasEnd) return 'LATE';
  return 'ABSENT';
}
