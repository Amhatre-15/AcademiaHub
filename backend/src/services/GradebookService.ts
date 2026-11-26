import crypto from 'crypto';
import { prisma } from '../config/prisma';

export interface RubricScores {
  attendanceScore: number; // 0 - 100 (weighted 10%)
  quizScore: number;       // 0 - 100 (weighted 20%)
  assignmentScore: number; // 0 - 100 (weighted 30%)
  examScore: number;       // 0 - 100 (weighted 40%)
}

export interface ComputedGradeResult {
  totalWeightedScore: number; // 0 - 100
  letterGrade: string;        // O, A+, A, B+, B, C, F
  gradePoint: number;         // 10, 9, 8, 7, 6, 5, 0
}

export interface SubjectCreditGrade {
  gradePoint: number;
  credits?: number; // defaults to 4
}

export class GradebookService {
  /**
   * Standard 10-point Indian University Grading Scale
   */
  public static readonly GRADE_SCALE = [
    { grade: 'O', min: 90, max: 100, point: 10.0, description: 'Outstanding' },
    { grade: 'A+', min: 80, max: 89.99, point: 9.0, description: 'Excellent' },
    { grade: 'A', min: 70, max: 79.99, point: 8.0, description: 'Very Good' },
    { grade: 'B+', min: 60, max: 69.99, point: 7.0, description: 'Good' },
    { grade: 'B', min: 50, max: 59.99, point: 6.0, description: 'Above Average' },
    { grade: 'C', min: 40, max: 49.99, point: 5.0, description: 'Pass' },
    { grade: 'F', min: 0, max: 39.99, point: 0.0, description: 'Fail' },
  ];

  /**
   * Weights defined in Phase 18 specification:
   * Attendance: 10%, Quizzes: 20%, Assignments: 30%, Final Exam: 40%
   */
  public static readonly WEIGHTS = {
    attendance: 0.10,
    quiz: 0.20,
    assignment: 0.30,
    exam: 0.40,
  };

  /**
   * Pure calculation: computes weighted total score, letter grade, and grade point
   */
  public static computeGrade(scores: RubricScores): ComputedGradeResult {
    const safeAttendance = Math.min(100, Math.max(0, scores.attendanceScore || 0));
    const safeQuiz = Math.min(100, Math.max(0, scores.quizScore || 0));
    const safeAssignment = Math.min(100, Math.max(0, scores.assignmentScore || 0));
    const safeExam = Math.min(100, Math.max(0, scores.examScore || 0));

    const totalWeightedScore = Number(
      (
        safeAttendance * this.WEIGHTS.attendance +
        safeQuiz * this.WEIGHTS.quiz +
        safeAssignment * this.WEIGHTS.assignment +
        safeExam * this.WEIGHTS.exam
      ).toFixed(2)
    );

    let letterGrade = 'F';
    let gradePoint = 0.0;

    for (const scale of this.GRADE_SCALE) {
      if (totalWeightedScore >= scale.min) {
        letterGrade = scale.grade;
        gradePoint = scale.point;
        break;
      }
    }

    return {
      totalWeightedScore,
      letterGrade,
      gradePoint,
    };
  }

  /**
   * Compute Semester Grade Point Average (SGPA) based on credit weighting
   */
  public static calculateSGPA(courses: SubjectCreditGrade[]): number {
    if (!courses || courses.length === 0) return 0.0;

    let totalPoints = 0;
    let totalCredits = 0;

    for (const c of courses) {
      const credits = c.credits !== undefined && c.credits > 0 ? c.credits : 4; // default 4 credits
      totalPoints += c.gradePoint * credits;
      totalCredits += credits;
    }

    if (totalCredits === 0) return 0.0;
    return Number((totalPoints / totalCredits).toFixed(2));
  }

  /**
   * Generates a cryptographic verification hash for academic transcripts
   */
  public static generateTranscriptHash(
    prn: string,
    academicYear: string,
    sgpa: number,
    grades: Array<{ subjectCode?: string; letterGrade: string; gradePoint: number }>
  ): string {
    const normalized = `${prn}|${academicYear}|${sgpa.toFixed(2)}|${grades
      .map((g) => `${g.subjectCode || 'SUB'}:${g.letterGrade}:${g.gradePoint}`)
      .sort()
      .join(',')}`;

    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Computes and saves or updates a student's SubjectGrade record in the database
   */
  public static async evaluateAndSaveStudentGrade(
    studentId: string,
    subjectId: string,
    academicYearId: string,
    scores: RubricScores,
    published: boolean = false
  ) {
    const computed = this.computeGrade(scores);

    return await prisma.subjectGrade.upsert({
      where: {
        studentId_subjectId_academicYearId: {
          studentId,
          subjectId,
          academicYearId,
        },
      },
      update: {
        attendanceScore: scores.attendanceScore,
        quizScore: scores.quizScore,
        assignmentScore: scores.assignmentScore,
        examScore: scores.examScore,
        totalWeightedScore: computed.totalWeightedScore,
        letterGrade: computed.letterGrade,
        gradePoint: computed.gradePoint,
        published,
      },
      create: {
        studentId,
        subjectId,
        academicYearId,
        attendanceScore: scores.attendanceScore,
        quizScore: scores.quizScore,
        assignmentScore: scores.assignmentScore,
        examScore: scores.examScore,
        totalWeightedScore: computed.totalWeightedScore,
        letterGrade: computed.letterGrade,
        gradePoint: computed.gradePoint,
        published,
      },
    });
  }
}
