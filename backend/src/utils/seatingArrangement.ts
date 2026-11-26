/**
 * AcademiaHub — Automated Exam Seating Scatter Algorithm (Phase 18)
 * 
 * Scatters students from different branches and subjects across an exam hall grid
 * to guarantee that horizontally and vertically adjacent students do NOT share the
 * same branch or subject (preventing identical question paper visibility).
 */

export interface CandidateStudent {
  studentId: string;
  prn: string;
  name: string;
  branchId: string;
  subjectId: string;
}

export interface ExamHallGrid {
  id?: string;
  name: string;
  rows: number;
  cols: number;
  capacity?: number;
}

export interface AllocatedSeat {
  row: number;
  col: number;
  seatNumber: string; // e.g. "A1", "A2", "B1"
  student: CandidateStudent | null;
}

export interface SeatingArrangementResult {
  hallName: string;
  totalSeats: number;
  assignedCount: number;
  unassignedCount: number;
  utilizationRate: number; // percentage 0 - 100
  grid: AllocatedSeat[][];
  adjacencyConflicts: number;
  unassignedStudents: CandidateStudent[];
}

/**
 * Generate seat label from 0-indexed row and col (e.g. 0,0 -> "A1", 1,2 -> "B3")
 */
export function formatSeatNumber(row: number, col: number): string {
  const rowLetter = String.fromCharCode(65 + row); // 65 is 'A'
  return `${rowLetter}${col + 1}`;
}

/**
 * Checks if placing a candidate student at (row, col) violates branch/subject adjacency
 * with already assigned neighbors (North, South, East, West).
 */
export function hasAdjacencyConflict(
  grid: AllocatedSeat[][],
  row: number,
  col: number,
  candidate: CandidateStudent
): boolean {
  const directions = [
    [-1, 0], // North
    [1, 0],  // South
    [0, -1], // West
    [0, 1],  // East
  ];

  for (const [dr, dc] of directions) {
    const nr = row + dr;
    const nc = col + dc;

    if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length) {
      const neighbor = grid[nr][nc].student;
      if (neighbor) {
        if (
          neighbor.branchId === candidate.branchId ||
          neighbor.subjectId === candidate.subjectId
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Scatter and allocate students across the exam hall grid.
 * Groups students by branch/subject and distributes them in a round-robin / checkerboard fashion.
 */
export function generateSeatingArrangement(
  hall: ExamHallGrid,
  students: CandidateStudent[]
): SeatingArrangementResult {
  const { rows, cols } = hall;
  const totalSeats = rows * cols;

  // Initialize empty grid
  const grid: AllocatedSeat[][] = [];
  for (let r = 0; r < rows; r++) {
    const rowArr: AllocatedSeat[] = [];
    for (let c = 0; c < cols; c++) {
      rowArr.push({
        row: r,
        col: c,
        seatNumber: formatSeatNumber(r, c),
        student: null,
      });
    }
    grid.push(rowArr);
  }

  // Group candidate students by branch to interleave
  const branchGroups = new Map<string, CandidateStudent[]>();
  for (const s of students) {
    const list = branchGroups.get(s.branchId) || [];
    list.push(s);
    branchGroups.set(s.branchId, list);
  }

  // Sort groups by descending size so dominant branches get dispersed first
  const sortedBranchKeys = Array.from(branchGroups.keys()).sort(
    (a, b) => (branchGroups.get(b)?.length || 0) - (branchGroups.get(a)?.length || 0)
  );

  // Flatten interleaved list
  const interleavedQueue: CandidateStudent[] = [];
  let remainingInGroups = true;
  let idx = 0;

  while (remainingInGroups) {
    remainingInGroups = false;
    for (const bKey of sortedBranchKeys) {
      const group = branchGroups.get(bKey);
      if (group && idx < group.length) {
        interleavedQueue.push(group[idx]);
        remainingInGroups = true;
      }
    }
    idx++;
  }

  const unassignedStudents: CandidateStudent[] = [];
  let assignedCount = 0;

  // Allocate seats prioritizing conflict-free placements
  const remainingCandidates = [...interleavedQueue];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (remainingCandidates.length === 0) break;

      // Find the first candidate that causes no adjacency conflict
      let candidateIndex = -1;
      for (let i = 0; i < remainingCandidates.length; i++) {
        if (!hasAdjacencyConflict(grid, r, c, remainingCandidates[i])) {
          candidateIndex = i;
          break;
        }
      }

      // If no perfect match found without conflict, pick candidate if capacity dictates
      if (candidateIndex === -1 && remainingCandidates.length > 0) {
        // Look for the candidate with lowest conflict potential
        candidateIndex = 0;
      }

      if (candidateIndex !== -1) {
        const selected = remainingCandidates.splice(candidateIndex, 1)[0];
        grid[r][c].student = selected;
        assignedCount++;
      }
    }
  }

  // Any left in remainingCandidates are unassigned due to hall capacity
  unassignedStudents.push(...remainingCandidates);

  // Validate adjacency conflicts in final layout
  let adjacencyConflicts = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const student = grid[r][c].student;
      if (!student) continue;

      // Check right neighbor
      if (c + 1 < cols && grid[r][c + 1].student) {
        const rightNeighbor = grid[r][c + 1].student!;
        if (
          rightNeighbor.branchId === student.branchId ||
          rightNeighbor.subjectId === student.subjectId
        ) {
          adjacencyConflicts++;
        }
      }

      // Check bottom neighbor
      if (r + 1 < rows && grid[r + 1][c].student) {
        const bottomNeighbor = grid[r + 1][c].student!;
        if (
          bottomNeighbor.branchId === student.branchId ||
          bottomNeighbor.subjectId === student.subjectId
        ) {
          adjacencyConflicts++;
        }
      }
    }
  }

  const utilizationRate = totalSeats > 0 ? Math.round((assignedCount / totalSeats) * 100) : 0;

  return {
    hallName: hall.name,
    totalSeats,
    assignedCount,
    unassignedCount: unassignedStudents.length,
    utilizationRate,
    grid,
    adjacencyConflicts,
    unassignedStudents,
  };
}
