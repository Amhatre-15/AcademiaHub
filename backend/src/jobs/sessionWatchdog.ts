import { prisma } from '../config/prisma';
import { sessionManager } from '../websocket/SessionManager';
import { calculateFinalAttendance } from '../controllers/faculty/SessionController';

let watchdogTimer: NodeJS.Timeout | null = null;

/**
 * Check if an active session is stale and should be automatically closed.
 * Rules:
 * 1. If session is linked to a timetable entry with a timeSlot endTime:
 *    stale if server time is >30 minutes past the scheduled slot endTime.
 * 2. Fallback rule:
 *    stale if session has been in ACTIVE status for more than 4 hours (240 minutes).
 */
export function isSessionStale(
  session: { createdAt: Date; timetableEntry?: { timeSlot?: { endTime: string } } | null },
  now: Date = new Date(),
  gracePeriodMinutes: number = 30,
  maxSessionHours: number = 4
): boolean {
  // Check timetable slot if available
  const endTimeStr = session.timetableEntry?.timeSlot?.endTime;
  if (endTimeStr) {
    const [hours, minutes] = endTimeStr.split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      const scheduledEnd = new Date(now);
      scheduledEnd.setHours(hours, minutes, 0, 0);

      // Add grace period
      const staleThreshold = new Date(scheduledEnd.getTime() + gracePeriodMinutes * 60 * 1000);
      if (now.getTime() > staleThreshold.getTime()) {
        return true;
      }
    }
  }

  // Fallback: Max session duration elapsed since creation
  const maxDurationMs = maxSessionHours * 60 * 60 * 1000;
  const ageMs = now.getTime() - new Date(session.createdAt).getTime();
  return ageMs > maxDurationMs;
}

/**
 * Scan for orphaned active sessions and close them with final attendance computation.
 */
export async function autoCloseStaleSessions(now: Date = new Date()): Promise<number> {
  try {
    const activeSessions = await prisma.classSession.findMany({
      where: { status: 'ACTIVE' },
      include: {
        timetableEntry: {
          include: {
            timeSlot: true,
          },
        },
      },
    });

    let closedCount = 0;

    for (const session of activeSessions) {
      if (isSessionStale(session, now)) {
        console.log(`[SessionWatchdog] Auto-closing stale session ${session.id} (created at ${session.createdAt.toISOString()})`);

        // End active checkpoints
        await prisma.attendanceCheckpoint.updateMany({
          where: { sessionId: session.id, isActive: true },
          data: { isActive: false, closedAt: now }
        });

        // Close session
        await prisma.classSession.update({
          where: { id: session.id },
          data: {
            status: 'CLOSED',
            actualEnd: now,
          },
        });

        // Compute final attendance state
        await calculateFinalAttendance(session.id);

        // Notify connected WebSocket clients
        sessionManager.broadcastToSession(session.id, {
          type: 'SESSION_ENDED',
          payload: {
            sessionId: session.id,
            endedAt: now.toISOString(),
            autoClosed: true,
            reason: 'Session automatically closed by schedule watchdog.',
          },
        });

        closedCount++;
      }
    }

    if (closedCount > 0) {
      console.log(`[SessionWatchdog] Successfully auto-closed ${closedCount} stale session(s).`);
    }

    return closedCount;
  } catch (error) {
    console.error('[SessionWatchdog] Error during stale session auto-close check:', error);
    return 0;
  }
}

/**
 * Start the background session watchdog cron.
 */
export function startSessionWatchdog(intervalMs: number = 5 * 60 * 1000): void {
  if (watchdogTimer) {
    return;
  }

  console.log(`[SessionWatchdog] Background session watchdog initialized (checking every ${intervalMs / 1000}s).`);

  // Run immediate initial check after 10 seconds of server boot
  setTimeout(() => {
    autoCloseStaleSessions();
  }, 10000);

  // Set recurring periodic interval
  watchdogTimer = setInterval(() => {
    autoCloseStaleSessions();
  }, intervalMs);
}

/**
 * Stop the background session watchdog (used during graceful shutdown and tests).
 */
export function stopSessionWatchdog(): void {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
    console.log('[SessionWatchdog] Background session watchdog stopped.');
  }
}
