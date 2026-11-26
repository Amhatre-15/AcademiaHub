import { GradebookService, RubricScores } from '../../services/GradebookService';

describe('Smart Gradebook & CGPA Engine (Phase 18)', () => {
  describe('computeGrade', () => {
    it('accurately applies the 10-20-30-40 percentage rubric weighting', () => {
      // 100 on attendance (10) + 100 on quiz (20) + 100 on assignment (30) + 100 on exam (40) = 100
      const perfectScores: RubricScores = {
        attendanceScore: 100,
        quizScore: 100,
        assignmentScore: 100,
        examScore: 100,
      };

      const result = GradebookService.computeGrade(perfectScores);
      expect(result.totalWeightedScore).toBe(100);
      expect(result.letterGrade).toBe('O');
      expect(result.gradePoint).toBe(10.0);
    });

    it('correctly maps intermediate weighted score to Grade A (Very Good, 8.0)', () => {
      // Attendance: 80 * 0.10 = 8
      // Quiz: 70 * 0.20 = 14
      // Assignment: 80 * 0.30 = 24
      // Exam: 75 * 0.40 = 30
      // Total = 8 + 14 + 24 + 30 = 76
      const scores: RubricScores = {
        attendanceScore: 80,
        quizScore: 70,
        assignmentScore: 80,
        examScore: 75,
      };

      const result = GradebookService.computeGrade(scores);
      expect(result.totalWeightedScore).toBe(76);
      expect(result.letterGrade).toBe('A');
      expect(result.gradePoint).toBe(8.0);
    });

    it('assigns Grade F (Fail, 0.0) when total weighted score is below 40', () => {
      const failingScores: RubricScores = {
        attendanceScore: 30,
        quizScore: 35,
        assignmentScore: 20,
        examScore: 30,
      };

      const result = GradebookService.computeGrade(failingScores);
      expect(result.totalWeightedScore).toBeLessThan(40);
      expect(result.letterGrade).toBe('F');
      expect(result.gradePoint).toBe(0.0);
    });

    it('safely clamps scores below 0 or above 100', () => {
      const extremeScores: RubricScores = {
        attendanceScore: 150, // clamp to 100 -> 10
        quizScore: -20,       // clamp to 0 -> 0
        assignmentScore: 100, // 30
        examScore: 100,       // 40
      };

      const result = GradebookService.computeGrade(extremeScores);
      expect(result.totalWeightedScore).toBe(80);
      expect(result.letterGrade).toBe('A+');
      expect(result.gradePoint).toBe(9.0);
    });
  });

  describe('calculateSGPA', () => {
    it('returns 0 when courses array is empty', () => {
      expect(GradebookService.calculateSGPA([])).toBe(0.0);
    });

    it('computes weighted SGPA taking credit units into account', () => {
      // Course 1: GradePoint 10, Credits 4 -> 40 points
      // Course 2: GradePoint 8, Credits 4 -> 32 points
      // Course 3: GradePoint 6, Credits 2 -> 12 points
      // Total points = 84, Total credits = 10 -> SGPA = 8.4
      const courses = [
        { gradePoint: 10.0, credits: 4 },
        { gradePoint: 8.0, credits: 4 },
        { gradePoint: 6.0, credits: 2 },
      ];

      expect(GradebookService.calculateSGPA(courses)).toBe(8.4);
    });
  });

  describe('generateTranscriptHash', () => {
    it('generates a deterministic 64-character SHA-256 cryptographic hash', () => {
      const grades = [
        { subjectCode: 'CS101', letterGrade: 'O', gradePoint: 10.0 },
        { subjectCode: 'CS102', letterGrade: 'A', gradePoint: 8.0 },
      ];

      const hash1 = GradebookService.generateTranscriptHash('PRN2024001', '2024-25', 9.0, grades);
      const hash2 = GradebookService.generateTranscriptHash('PRN2024001', '2024-25', 9.0, grades);

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
    });

    it('produces a different hash when any student detail or grade is modified', () => {
      const grades = [{ subjectCode: 'CS101', letterGrade: 'O', gradePoint: 10.0 }];

      const originalHash = GradebookService.generateTranscriptHash('PRN001', '2024-25', 10.0, grades);
      const tamperedHash = GradebookService.generateTranscriptHash('PRN001', '2024-25', 9.0, grades);

      expect(originalHash).not.toBe(tamperedHash);
    });
  });
});
