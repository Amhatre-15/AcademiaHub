import {
  deriveCheckpointSecret,
  generateDynamicQrToken,
  verifyDynamicQrToken,
  parseDynamicQrPayload,
} from '../../utils/attendance';

describe('Dynamic Rotating QR Token Engine', () => {
  const mockCheckpoint = {
    id: 'chk-12345-uuid',
    code: 'K9P2',
    createdAt: new Date('2026-10-18T10:00:00Z'),
  };

  it('should derive a deterministic checkpoint secret', () => {
    const secret1 = deriveCheckpointSecret(mockCheckpoint);
    const secret2 = deriveCheckpointSecret(mockCheckpoint);

    expect(secret1).toBeDefined();
    expect(secret1).toHaveLength(64); // SHA-256 hex output
    expect(secret1).toEqual(secret2);
  });

  it('should generate a 16-character hexadecimal rotating token', () => {
    const secret = deriveCheckpointSecret(mockCheckpoint);
    const token = generateDynamicQrToken(secret, mockCheckpoint.id, 1729245600);

    expect(token).toBeDefined();
    expect(token).toHaveLength(16);
    expect(token).toMatch(/^[0-9a-f]{16}$/i);
  });

  it('should produce different tokens for consecutive seconds', () => {
    const secret = deriveCheckpointSecret(mockCheckpoint);
    const tokenAtSec1 = generateDynamicQrToken(secret, mockCheckpoint.id, 1000);
    const tokenAtSec2 = generateDynamicQrToken(secret, mockCheckpoint.id, 1001);

    expect(tokenAtSec1).not.toEqual(tokenAtSec2);
  });

  describe('verifyDynamicQrToken() validation checks', () => {
    const secret = deriveCheckpointSecret(mockCheckpoint);

    it('should validate a fresh token within tolerance window', () => {
      const currentSecond = Math.floor(Date.now() / 1000);
      const token = generateDynamicQrToken(secret, mockCheckpoint.id, currentSecond);

      const result = verifyDynamicQrToken(secret, mockCheckpoint.id, currentSecond, token, 6);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject a token that has expired beyond tolerance window', () => {
      const currentSecond = Math.floor(Date.now() / 1000);
      const expiredSecond = currentSecond - 10; // 10 seconds old
      const token = generateDynamicQrToken(secret, mockCheckpoint.id, expiredSecond);

      const result = verifyDynamicQrToken(secret, mockCheckpoint.id, expiredSecond, token, 6);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('expired');
    });

    it('should reject a token with a timestamp from the far future (clock fraud)', () => {
      const currentSecond = Math.floor(Date.now() / 1000);
      const futureSecond = currentSecond + 30; // 30s in future
      const token = generateDynamicQrToken(secret, mockCheckpoint.id, futureSecond);

      const result = verifyDynamicQrToken(secret, mockCheckpoint.id, futureSecond, token, 6);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('future');
    });

    it('should reject a tampered token payload', () => {
      const currentSecond = Math.floor(Date.now() / 1000);
      const invalidToken = '0123456789abcdef';

      const result = verifyDynamicQrToken(secret, mockCheckpoint.id, currentSecond, invalidToken, 6);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid QR token');
    });
  });

  describe('parseDynamicQrPayload()', () => {
    it('should parse valid JSON QR payloads', () => {
      const payload = JSON.stringify({
        sid: 'session-101',
        cid: 'checkpoint-202',
        t: 1729245600,
        hash: 'abcd1234efgh5678',
        type: 'START',
      });

      const parsed = parseDynamicQrPayload(payload);
      expect(parsed).toEqual({
        sid: 'session-101',
        cid: 'checkpoint-202',
        t: 1729245600,
        hash: 'abcd1234efgh5678',
        type: 'START',
      });
    });

    it('should parse colon-delimited fallback strings', () => {
      const raw = 'AH_ATTEND:chk-1:sess-2:1729245600:hash1234567890';
      const parsed = parseDynamicQrPayload(raw);

      expect(parsed).toEqual({
        cid: 'chk-1',
        sid: 'sess-2',
        t: 1729245600,
        hash: 'hash1234567890',
      });
    });

    it('should return null for invalid or corrupted strings', () => {
      expect(parseDynamicQrPayload('random junk string')).toBeNull();
      expect(parseDynamicQrPayload('{}')).toBeNull();
    });
  });
});
