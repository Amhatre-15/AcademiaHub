import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import {
  generateSeatingArrangement,
  CandidateStudent,
} from '../../utils/seatingArrangement';

export class ExamController {
  /**
   * Create or update an Exam Hall
   */
  public static async createHall(req: Request, res: Response): Promise<void> {
    try {
      const { name, rows, cols } = req.body;

      if (!name || !rows || !cols || rows <= 0 || cols <= 0) {
        res.status(400).json({
          success: false,
          message: 'Valid name, rows (>0) and cols (>0) are required',
        });
        return;
      }

      const capacity = rows * cols;

      const hall = await prisma.examHall.upsert({
        where: { name },
        update: { rows: Number(rows), cols: Number(cols), capacity },
        create: { name, rows: Number(rows), cols: Number(cols), capacity },
      });

      res.status(201).json({
        success: true,
        data: hall,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to create exam hall',
        error: error.message,
      });
    }
  }

  /**
   * List all exam halls with seat counts
   */
  public static async listHalls(req: Request, res: Response): Promise<void> {
    try {
      const halls = await prisma.examHall.findMany({
        include: {
          _count: {
            select: { seats: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      res.json({
        success: true,
        data: halls,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to list exam halls',
        error: error.message,
      });
    }
  }

  /**
   * Run the seating scatter algorithm for a hall and save allocations to DB
   */
  public static async generateSeating(req: Request, res: Response): Promise<void> {
    try {
      const { hallId, classIds } = req.body;

      if (!hallId) {
        res.status(400).json({ success: false, message: 'hallId is required' });
        return;
      }

      const hall = await prisma.examHall.findUnique({
        where: { id: hallId },
      });

      if (!hall) {
        res.status(404).json({ success: false, message: 'Exam hall not found' });
        return;
      }

      // Fetch students belonging to the specified classes (or all active enrollments if empty)
      const enrollments = await prisma.enrollment.findMany({
        where: {
          status: 'ACTIVE',
          ...(classIds && Array.isArray(classIds) && classIds.length > 0
            ? { classId: { in: classIds } }
            : {}),
        },
        include: {
          student: true,
          class: {
            include: {
              academicLevel: {
                include: {
                  branch: true,
                },
              },
            },
          },
        },
      });

      // Prepare candidate student list
      const candidateStudents: CandidateStudent[] = enrollments.map((e: any) => ({
        studentId: e.student.id,
        prn: e.student.prn,
        name: `${e.student.firstName} ${e.student.lastName}`,
        branchId: e.class.academicLevel.branchId,
        subjectId: e.classId, // group cohort
      }));

      // Run Seating Scatter Algorithm
      const arrangement = generateSeatingArrangement(
        {
          name: hall.name,
          rows: hall.rows,
          cols: hall.cols,
          capacity: hall.capacity,
        },
        candidateStudents
      );

      // Persist allocations: clear old seats for this hall first
      await prisma.examSeat.deleteMany({
        where: { hallId },
      });

      // Flatten allocated seats to insert
      const seatRecords: Array<{
        hallId: string;
        studentId: string | null;
        subjectId: string | null;
        rowNumber: number;
        colNumber: number;
        seatNumber: string;
      }> = [];

      for (let r = 0; r < arrangement.grid.length; r++) {
        for (let c = 0; c < arrangement.grid[r].length; c++) {
          const seat = arrangement.grid[r][c];
          seatRecords.push({
            hallId,
            studentId: seat.student?.studentId || null,
            subjectId: seat.student?.subjectId || null,
            rowNumber: r,
            colNumber: c,
            seatNumber: seat.seatNumber,
          });
        }
      }

      await prisma.examSeat.createMany({
        data: seatRecords,
      });

      res.json({
        success: true,
        data: {
          hallId: hall.id,
          hallName: hall.name,
          totalSeats: arrangement.totalSeats,
          assignedCount: arrangement.assignedCount,
          unassignedCount: arrangement.unassignedCount,
          utilizationRate: arrangement.utilizationRate,
          adjacencyConflicts: arrangement.adjacencyConflicts,
          grid: arrangement.grid,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate seating arrangement',
        error: error.message,
      });
    }
  }

  /**
   * Get digital hall ticket with anti-fraud cryptographic signature
   */
  public static async getStudentHallTicket(req: Request, res: Response): Promise<void> {
    try {
      const studentId = req.params.studentId as string;

      const student: any = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
          user: true,
          enrollments: {
            where: { status: 'ACTIVE' },
            include: {
              class: {
                include: {
                  academicLevel: {
                    include: {
                      branch: true,
                    },
                  },
                },
              },
            },
          },
          examSeats: {
            include: {
              hall: true,
            },
          },
        },
      });

      if (!student) {
        res.status(404).json({ success: false, message: 'Student not found' });
        return;
      }

      const activeEnrollment = student.enrollments?.[0] || null;
      const assignedSeat = student.examSeats?.[0] || null;

      const rawTicketData = `${student.prn}|${student.firstName} ${student.lastName}|${activeEnrollment?.class?.name || 'Class'}|${assignedSeat?.hall?.name || 'Unassigned'}|${assignedSeat?.seatNumber || 'N/A'}`;
      const digitalSignature = crypto.createHash('sha256').update(rawTicketData).digest('hex');

      res.json({
        success: true,
        data: {
          ticketId: `HT-${student.prn}-${new Date().getFullYear()}`,
          student: {
            id: student.id,
            prn: student.prn,
            name: `${student.firstName} ${student.lastName}`,
            email: student.email,
            branch: activeEnrollment?.class?.academicLevel?.branch?.name || 'Engineering',
            className: activeEnrollment?.class?.name || 'Class',
          },
          seating: {
            hallName: assignedSeat?.hall?.name || 'Exam Hall Not Assigned',
            seatNumber: assignedSeat?.seatNumber || 'N/A',
            row: assignedSeat ? assignedSeat.rowNumber + 1 : null,
            column: assignedSeat ? assignedSeat.colNumber + 1 : null,
          },
          instructions: [
            'Carry this digital hall ticket along with your institutional photo ID card.',
            'No electronic gadgets or unauthorized study materials are permitted in the exam hall.',
            'Report to the designated examination hall at least 15 minutes prior to the start time.',
          ],
          digitalSignature,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve hall ticket',
        error: error.message,
      });
    }
  }
}
