import {
  checkTimetableSlotConflict,
  TimetableSlotEntry,
} from '../../utils/timetableConflict';

describe('Timetable Slot Conflict Detection', () => {
  const existingEntries: TimetableSlotEntry[] = [
    {
      id: 'entry-1',
      facultyId: 'faculty-alice',
      classId: 'class-cs-1',
      divisionId: 'div-a',
      batchId: null,
      room: 'Room 301',
      dayOfWeek: 1, // Monday
      timeSlotId: 'slot-9am',
      isActive: true,
    },
    {
      id: 'entry-2',
      facultyId: 'faculty-bob',
      classId: 'class-cs-2',
      divisionId: 'div-b',
      batchId: 'batch-1',
      room: 'Lab 102',
      dayOfWeek: 2, // Tuesday
      timeSlotId: 'slot-11am',
      isActive: true,
    },
    {
      id: 'entry-inactive',
      facultyId: 'faculty-charlie',
      classId: 'class-cs-3',
      divisionId: 'div-c',
      batchId: null,
      room: 'Room 404',
      dayOfWeek: 1, // Monday
      timeSlotId: 'slot-9am',
      isActive: false, // Inactive / canceled lecture
    },
  ];

  it('should detect a faculty conflict when the same faculty is scheduled simultaneously', () => {
    const candidate: TimetableSlotEntry = {
      facultyId: 'faculty-alice', // Alice is already in Room 301 at 9am Monday
      classId: 'class-it-1',
      divisionId: 'div-a',
      batchId: null,
      room: 'Room 205',
      dayOfWeek: 1,
      timeSlotId: 'slot-9am',
    };

    const result = checkTimetableSlotConflict(existingEntries, candidate);
    expect(result.hasConflict).toBe(true);
    expect(result.conflictType).toBe('FACULTY');
    expect(result.reason).toContain('Faculty is already assigned');
  });

  it('should detect a class/division conflict when the same cohort has overlapping classes', () => {
    const candidate: TimetableSlotEntry = {
      facultyId: 'faculty-david',
      classId: 'class-cs-1',
      divisionId: 'div-a', // CS-1 Division A is already having class at 9am Monday
      batchId: null,
      room: 'Room 501',
      dayOfWeek: 1,
      timeSlotId: 'slot-9am',
    };

    const result = checkTimetableSlotConflict(existingEntries, candidate);
    expect(result.hasConflict).toBe(true);
    expect(result.conflictType).toBe('CLASS_DIVISION');
    expect(result.reason).toContain('class/division/batch already has a class scheduled');
  });

  it('should detect a room conflict when another class attempts to book the same room', () => {
    const candidate: TimetableSlotEntry = {
      facultyId: 'faculty-eve',
      classId: 'class-me-1',
      divisionId: 'div-b',
      batchId: null,
      room: 'room 301', // Same room (case-insensitive check)
      dayOfWeek: 1,
      timeSlotId: 'slot-9am',
    };

    const result = checkTimetableSlotConflict(existingEntries, candidate);
    expect(result.hasConflict).toBe(true);
    expect(result.conflictType).toBe('ROOM');
    expect(result.reason).toContain('already booked');
  });

  it('should ignore inactive / canceled timetable entries', () => {
    const candidate: TimetableSlotEntry = {
      facultyId: 'faculty-charlie', // Charlie has an inactive entry on Monday 9am
      classId: 'class-ee-1',
      divisionId: 'div-a',
      batchId: null,
      room: 'Room 404',
      dayOfWeek: 1,
      timeSlotId: 'slot-9am',
    };

    const result = checkTimetableSlotConflict(existingEntries, candidate);
    expect(result.hasConflict).toBe(false);
  });

  it('should allow self-update by excluding candidate entry id', () => {
    const candidate: TimetableSlotEntry = {
      id: 'entry-1',
      facultyId: 'faculty-alice',
      classId: 'class-cs-1',
      divisionId: 'div-a',
      batchId: null,
      room: 'Room 301',
      dayOfWeek: 1,
      timeSlotId: 'slot-9am',
    };

    const result = checkTimetableSlotConflict(existingEntries, candidate, 'entry-1');
    expect(result.hasConflict).toBe(false);
  });

  it('should approve conflict-free timetable slots', () => {
    const candidate: TimetableSlotEntry = {
      facultyId: 'faculty-alice',
      classId: 'class-cs-1',
      divisionId: 'div-a',
      batchId: null,
      room: 'Room 301',
      dayOfWeek: 3, // Wednesday - no conflict
      timeSlotId: 'slot-9am',
    };

    const result = checkTimetableSlotConflict(existingEntries, candidate);
    expect(result.hasConflict).toBe(false);
    expect(result.reason).toBeUndefined();
  });
});
