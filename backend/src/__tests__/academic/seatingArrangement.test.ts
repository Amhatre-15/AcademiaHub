import {
  formatSeatNumber,
  hasAdjacencyConflict,
  generateSeatingArrangement,
  CandidateStudent,
  AllocatedSeat,
} from '../../utils/seatingArrangement';

describe('Exam Seating Scatter Algorithm (Phase 18)', () => {
  describe('formatSeatNumber', () => {
    it('correctly maps matrix coordinates to alphanumeric seat labels', () => {
      expect(formatSeatNumber(0, 0)).toBe('A1');
      expect(formatSeatNumber(0, 5)).toBe('A6');
      expect(formatSeatNumber(1, 2)).toBe('B3');
      expect(formatSeatNumber(3, 9)).toBe('D10');
    });
  });

  describe('hasAdjacencyConflict', () => {
    it('returns false on an empty grid', () => {
      const grid: AllocatedSeat[][] = [
        [
          { row: 0, col: 0, seatNumber: 'A1', student: null },
          { row: 0, col: 1, seatNumber: 'A2', student: null },
        ],
      ];
      const candidate: CandidateStudent = {
        studentId: 's1',
        prn: 'PRN01',
        name: 'Alice',
        branchId: 'CSE',
        subjectId: 'SUB1',
      };

      expect(hasAdjacencyConflict(grid, 0, 0, candidate)).toBe(false);
    });

    it('returns true when horizontally adjacent seat has same branchId', () => {
      const neighbor: CandidateStudent = {
        studentId: 's1',
        prn: 'PRN01',
        name: 'Alice',
        branchId: 'CSE',
        subjectId: 'SUB1',
      };
      const grid: AllocatedSeat[][] = [
        [
          { row: 0, col: 0, seatNumber: 'A1', student: neighbor },
          { row: 0, col: 1, seatNumber: 'A2', student: null },
        ],
      ];
      const candidate: CandidateStudent = {
        studentId: 's2',
        prn: 'PRN02',
        name: 'Bob',
        branchId: 'CSE', // same branch!
        subjectId: 'SUB2',
      };

      expect(hasAdjacencyConflict(grid, 0, 1, candidate)).toBe(true);
    });

    it('returns false when adjacent student has a different branch and different subject', () => {
      const neighbor: CandidateStudent = {
        studentId: 's1',
        prn: 'PRN01',
        name: 'Alice',
        branchId: 'CSE',
        subjectId: 'SUB1',
      };
      const grid: AllocatedSeat[][] = [
        [
          { row: 0, col: 0, seatNumber: 'A1', student: neighbor },
          { row: 0, col: 1, seatNumber: 'A2', student: null },
        ],
      ];
      const candidate: CandidateStudent = {
        studentId: 's2',
        prn: 'PRN02',
        name: 'Bob',
        branchId: 'MECH', // different branch
        subjectId: 'SUB2', // different subject
      };

      expect(hasAdjacencyConflict(grid, 0, 1, candidate)).toBe(false);
    });
  });

  describe('generateSeatingArrangement', () => {
    it('scatters two distinct branches across a grid with zero adjacency conflicts', () => {
      const hall = {
        name: 'Hall 101',
        rows: 4,
        cols: 4, // 16 seats
      };

      // 8 CSE students and 8 MECH students
      const students: CandidateStudent[] = [];
      for (let i = 1; i <= 8; i++) {
        students.push({
          studentId: `cse-${i}`,
          prn: `CSE${i.toString().padStart(3, '0')}`,
          name: `CSE Student ${i}`,
          branchId: 'BRANCH_CSE',
          subjectId: 'SUB_CS101',
        });
        students.push({
          studentId: `mech-${i}`,
          prn: `MECH${i.toString().padStart(3, '0')}`,
          name: `MECH Student ${i}`,
          branchId: 'BRANCH_MECH',
          subjectId: 'SUB_ME101',
        });
      }

      const result = generateSeatingArrangement(hall, students);

      expect(result.hallName).toBe('Hall 101');
      expect(result.totalSeats).toBe(16);
      expect(result.assignedCount).toBe(16);
      expect(result.unassignedCount).toBe(0);
      expect(result.utilizationRate).toBe(100);
      expect(result.adjacencyConflicts).toBe(0);
      expect(result.unassignedStudents).toHaveLength(0);

      // Verify checkerboard alternation on row 0
      expect(result.grid[0][0].student?.branchId).not.toBe(
        result.grid[0][1].student?.branchId
      );
    });

    it('correctly reports unassigned students when cohort exceeds hall capacity', () => {
      const hall = {
        name: 'Mini Lab',
        rows: 2,
        cols: 2, // 4 seats
      };

      const students: CandidateStudent[] = [
        { studentId: '1', prn: 'P1', name: 'A', branchId: 'B1', subjectId: 'S1' },
        { studentId: '2', prn: 'P2', name: 'B', branchId: 'B2', subjectId: 'S2' },
        { studentId: '3', prn: 'P3', name: 'C', branchId: 'B1', subjectId: 'S1' },
        { studentId: '4', prn: 'P4', name: 'D', branchId: 'B2', subjectId: 'S2' },
        { studentId: '5', prn: 'P5', name: 'E', branchId: 'B1', subjectId: 'S1' },
        { studentId: '6', prn: 'P6', name: 'F', branchId: 'B2', subjectId: 'S2' },
      ];

      const result = generateSeatingArrangement(hall, students);

      expect(result.totalSeats).toBe(4);
      expect(result.assignedCount).toBe(4);
      expect(result.unassignedCount).toBe(2);
      expect(result.utilizationRate).toBe(100);
      expect(result.unassignedStudents).toHaveLength(2);
    });
  });
});
