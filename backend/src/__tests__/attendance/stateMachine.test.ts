import {
  determineAttendanceStatus,
  generateAttendanceCode,
  generateExpiry,
  isCodeValid,
  getRemainingSeconds,
} from '../../utils/attendance';

describe('Attendance State Machine & Code Utils', () => {
  describe('determineAttendanceStatus()', () => {
    it('should assign PRESENT when both START and END checkpoints are submitted', () => {
      const status = determineAttendanceStatus(true, true);
      expect(status).toBe('PRESENT');
    });

    it('should assign PARTIAL when only START checkpoint is submitted', () => {
      const status = determineAttendanceStatus(true, false);
      expect(status).toBe('PARTIAL');
    });

    it('should assign LATE when only END checkpoint is submitted', () => {
      const status = determineAttendanceStatus(false, true);
      expect(status).toBe('LATE');
    });

    it('should assign ABSENT when neither checkpoint is submitted', () => {
      const status = determineAttendanceStatus(false, false);
      expect(status).toBe('ABSENT');
    });
  });

  describe('generateAttendanceCode()', () => {
    it('should generate a code with the requested character length', () => {
      const code4 = generateAttendanceCode(4);
      expect(code4).toHaveLength(4);

      const code6 = generateAttendanceCode(6);
      expect(code6).toHaveLength(6);
    });

    it('should exclude visually ambiguous characters (I, O, 0, 1)', () => {
      // Generate 100 codes to ensure random sampling adheres to unambiguous character set
      for (let i = 0; i < 100; i++) {
        const code = generateAttendanceCode(6);
        expect(code).not.toMatch(/[IO01]/);
      }
    });
  });

  describe('generateExpiry() & isCodeValid()', () => {
    it('should generate a future expiry timestamp', () => {
      const expiry = generateExpiry(60);
      expect(expiry.getTime()).toBeGreaterThan(Date.now());
      expect(isCodeValid(expiry)).toBe(true);
    });

    it('should mark a past timestamp as invalid', () => {
      const past = new Date(Date.now() - 5000);
      expect(isCodeValid(past)).toBe(false);
      expect(getRemainingSeconds(past)).toBe(0);
    });

    it('should calculate remaining seconds accurately for active codes', () => {
      const expiry = new Date(Date.now() + 30000); // 30s in future
      const remaining = getRemainingSeconds(expiry);
      expect(remaining).toBeGreaterThanOrEqual(28);
      expect(remaining).toBeLessThanOrEqual(30);
    });
  });
});
