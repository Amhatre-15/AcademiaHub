export interface TimetableSlotEntry {
  id?: string;
  facultyId: string;
  classId: string;
  divisionId?: string | null;
  batchId?: string | null;
  room?: string | null;
  dayOfWeek: number;
  timeSlotId: string;
  academicYearId?: string;
  semesterId?: string;
  isActive?: boolean;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictType?: 'FACULTY' | 'CLASS_DIVISION' | 'ROOM';
  reason?: string;
}

/**
 * Pure evaluation function for timetable slot collisions.
 * Validates against:
 * 1. Faculty double-booking (same faculty cannot teach two classes at the same time).
 * 2. Class/Division/Batch collision (same cohort cannot attend two classes at the same time).
 * 3. Room collision (same physical lecture room cannot host two simultaneous sessions).
 */
export function checkTimetableSlotConflict(
  existingEntries: TimetableSlotEntry[],
  candidate: TimetableSlotEntry,
  excludeId?: string
): ConflictCheckResult {
  for (const entry of existingEntries) {
    // Skip self when updating an existing entry
    if (excludeId && entry.id === excludeId) {
      continue;
    }

    // Skip inactive entries
    if (entry.isActive === false) {
      continue;
    }

    // Must match the same day and time slot to conflict
    if (entry.dayOfWeek !== candidate.dayOfWeek || entry.timeSlotId !== candidate.timeSlotId) {
      continue;
    }

    // 1. Check Faculty conflict
    if (entry.facultyId === candidate.facultyId) {
      return {
        hasConflict: true,
        conflictType: 'FACULTY',
        reason: 'Faculty is already assigned to a class during this time slot.',
      };
    }

    // 2. Check Class / Division / Batch conflict
    const sameClass = entry.classId === candidate.classId;
    const sameDivision = (entry.divisionId || null) === (candidate.divisionId || null);
    const sameBatch = (entry.batchId || null) === (candidate.batchId || null);

    if (sameClass && sameDivision && sameBatch) {
      return {
        hasConflict: true,
        conflictType: 'CLASS_DIVISION',
        reason: 'This class/division/batch already has a class scheduled at this time.',
      };
    }

    // 3. Check Room conflict
    if (
      candidate.room &&
      entry.room &&
      candidate.room.trim().toLowerCase() === entry.room.trim().toLowerCase()
    ) {
      return {
        hasConflict: true,
        conflictType: 'ROOM',
        reason: `Room ${candidate.room} is already booked during this time slot.`,
      };
    }
  }

  return { hasConflict: false };
}
