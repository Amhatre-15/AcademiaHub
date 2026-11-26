import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { GradebookService } from '../../services/GradebookService';

export class ParentController {
  /**
   * Get all registered children linked to the current parent user
   */
  public static async getChildren(req: Request, res: Response): Promise<void> {
    try {
      const parentId = req.user!.userId;

      const links = await prisma.parentStudent.findMany({
        where: { parentId },
        include: {
          student: {
            include: {
              enrollments: {
                where: { status: 'ACTIVE' },
                include: {
                  class: true,
                  division: true,
                  academicYear: true,
                },
              },
              attendanceRecords: {
                select: {
                  finalStatus: true,
                },
              },
            },
          },
        },
      });

      const children = links.map((link: any) => {
        const student = link.student;
        const totalLectures = student.attendanceRecords.length;
        const attendedLectures = student.attendanceRecords.filter(
          (r: any) => r.finalStatus === 'PRESENT' || r.finalStatus === 'LATE' || r.finalStatus === 'PARTIAL'
        ).length;

        const attendancePercentage =
          totalLectures > 0 ? Math.round((attendedLectures / totalLectures) * 100) : 100;

        const activeEnrollment = student.enrollments[0] || null;

        return {
          studentId: student.id,
          prn: student.prn,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          phone: student.phone,
          className: activeEnrollment?.class?.name || 'Unassigned',
          divisionName: activeEnrollment?.division?.name || 'Unassigned',
          academicYear: activeEnrollment?.academicYear?.name || 'N/A',
          totalLectures,
          attendedLectures,
          attendancePercentage,
          statutoryWarning: attendancePercentage < 75,
        };
      });

      res.json({
        success: true,
        data: children,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve linked children',
        error: error.message,
      });
    }
  }

  /**
   * Get attendance ledger and statutory warning check for a specific child
   */
  public static async getChildAttendance(req: Request, res: Response): Promise<void> {
    try {
      const parentId = req.user!.userId;
      const studentId = req.params.studentId as string;

      // Verify parent is authorized for this student
      const link: any = await prisma.parentStudent.findUnique({
        where: {
          parentId_studentId: {
            parentId,
            studentId,
          },
        },
        include: {
          student: true,
        },
      });

      if (!link) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to view this student profile',
        });
        return;
      }

      // Fetch attendance history
      const records = await prisma.attendanceRecord.findMany({
        where: { studentId },
        include: {
          session: {
            include: {
              subject: true,
              faculty: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const total = records.length;
      const presentCount = records.filter((r: any) => r.finalStatus === 'PRESENT').length;
      const partialCount = records.filter((r: any) => r.finalStatus === 'PARTIAL').length;
      const lateCount = records.filter((r: any) => r.finalStatus === 'LATE').length;
      const absentCount = records.filter((r: any) => r.finalStatus === 'ABSENT').length;

      const attended = presentCount + partialCount + lateCount;
      const attendancePercentage = total > 0 ? Math.round((attended / total) * 100) : 100;
      const statutoryWarning = attendancePercentage < 75;

      res.json({
        success: true,
        data: {
          student: {
            id: link.student.id,
            prn: link.student.prn,
            name: `${link.student.firstName} ${link.student.lastName}`,
          },
          metrics: {
            totalLectures: total,
            attendedLectures: attended,
            presentCount,
            partialCount,
            lateCount,
            absentCount,
            attendancePercentage,
            statutoryWarning,
            warningMessage: statutoryWarning
              ? 'ALERT: Attendance is below 75%. Student is at risk of exam debarment.'
              : 'Attendance is above statutory threshold.',
          },
          records: records.map((r: any) => ({
            id: r.id,
            subjectName: r.session.subject.name,
            facultyName: `${r.session.faculty.firstName} ${r.session.faculty.lastName}`,
            date: r.createdAt,
            finalStatus: r.finalStatus,
            startAttended: r.startAttended,
            endAttended: r.endAttended,
          })),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve attendance details',
        error: error.message,
      });
    }
  }

  /**
   * Get academic grades, SGPA, and transcript hash for a child
   */
  public static async getChildGrades(req: Request, res: Response): Promise<void> {
    try {
      const parentId = req.user!.userId;
      const studentId = req.params.studentId as string;

      const link: any = await prisma.parentStudent.findUnique({
        where: {
          parentId_studentId: {
            parentId,
            studentId,
          },
        },
        include: {
          student: true,
        },
      });

      if (!link) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to view this student profile',
        });
        return;
      }

      const grades: any[] = await prisma.subjectGrade.findMany({
        where: {
          studentId,
          published: true, // Parents only see published grades
        },
        include: {
          subject: true,
          academicYear: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const sgpa = GradebookService.calculateSGPA(
        grades.map((g: any) => ({ gradePoint: g.gradePoint, credits: 4 }))
      );

      const transcriptHash = GradebookService.generateTranscriptHash(
        link.student.prn,
        grades[0]?.academicYear?.name || '2024-25',
        sgpa,
        grades.map((g: any) => ({
          subjectCode: g.subject.code || undefined,
          letterGrade: g.letterGrade,
          gradePoint: g.gradePoint,
        }))
      );

      res.json({
        success: true,
        data: {
          student: {
            id: link.student.id,
            prn: link.student.prn,
            name: `${link.student.firstName} ${link.student.lastName}`,
          },
          sgpa,
          transcriptHash,
          grades: grades.map((g: any) => ({
            id: g.id,
            subjectCode: g.subject.code,
            subjectName: g.subject.name,
            academicYear: g.academicYear.name,
            attendanceScore: g.attendanceScore,
            quizScore: g.quizScore,
            assignmentScore: g.assignmentScore,
            examScore: g.examScore,
            totalWeightedScore: g.totalWeightedScore,
            letterGrade: g.letterGrade,
            gradePoint: g.gradePoint,
          })),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve grades',
        error: error.message,
      });
    }
  }
}
