import { isSessionStale } from '../../jobs/sessionWatchdog';

describe('Session Watchdog Stale Checker', () => {
  it('should mark a session as stale if timetable slot ended >30 minutes ago', () => {
    // Current time: 11:45
    const now = new Date('2026-10-18T11:45:00');

    // Lecture ended at 11:00 (45 minutes ago > 30 min grace)
    const session = {
      createdAt: new Date('2026-10-18T10:00:00'),
      timetableEntry: {
        timeSlot: {
          endTime: '11:00',
        },
      },
    };

    const stale = isSessionStale(session, now, 30);
    expect(stale).toBe(true);
  });

  it('should NOT mark a session as stale if timetable slot is active or within grace period', () => {
    // Current time: 11:15
    const now = new Date('2026-10-18T11:15:00');

    // Lecture ended at 11:00 (15 minutes ago <= 30 min grace)
    const session = {
      createdAt: new Date('2026-10-18T10:00:00'),
      timetableEntry: {
        timeSlot: {
          endTime: '11:00',
        },
      },
    };

    const stale = isSessionStale(session, now, 30);
    expect(stale).toBe(false);
  });

  it('should fall back to max duration rule if no timetable entry is attached', () => {
    const now = new Date('2026-10-18T16:00:00');

    // Created 5 hours ago (> 4h threshold)
    const staleSession = {
      createdAt: new Date('2026-10-18T11:00:00'),
      timetableEntry: null,
    };
    expect(isSessionStale(staleSession, now, 30, 4)).toBe(true);

    // Created 2 hours ago (<= 4h threshold)
    const freshSession = {
      createdAt: new Date('2026-10-18T14:00:00'),
      timetableEntry: null,
    };
    expect(isSessionStale(freshSession, now, 30, 4)).toBe(false);
  });
});
