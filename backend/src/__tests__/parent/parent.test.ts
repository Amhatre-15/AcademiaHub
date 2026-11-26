import { Request, Response } from 'express';
import { ParentController } from '../../controllers/parent/ParentController';
import { prisma } from '../../config/prisma';

// Mock Prisma
jest.mock('../../config/prisma', () => ({
  prisma: {
    parentStudent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    attendanceRecord: {
      findMany: jest.fn(),
    },
    subjectGrade: {
      findMany: jest.fn(),
    },
  },
}));

describe('Parent Portal Controller (Phase 18)', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      user: {
        userId: 'parent-user-123',
        role: 'PARENT',
        username: 'parent_john',
      },
      params: {},
    };

    mockRes = {
      json: jsonMock,
      status: statusMock,
    };

    jest.clearAllMocks();
  });

  describe('getChildren', () => {
    it('returns linked children with computed attendance and flags statutory warning for <75%', async () => {
      (prisma.parentStudent.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'link-1',
          student: {
            id: 'student-1',
            prn: 'PRN001',
            firstName: 'Rahul',
            lastName: 'Sharma',
            email: 'rahul@campus.edu',
            phone: '9876543210',
            enrollments: [
              {
                class: { name: 'TE-CSE' },
                division: { name: 'A' },
                academicYear: { name: '2024-25' },
              },
            ],
            attendanceRecords: [
              { finalStatus: 'PRESENT' },
              { finalStatus: 'PRESENT' },
              { finalStatus: 'ABSENT' },
              { finalStatus: 'ABSENT' }, // 2 / 4 = 50% -> <75% warning!
            ],
          },
        },
      ]);

      await ParentController.getChildren(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [
            expect.objectContaining({
              studentId: 'student-1',
              prn: 'PRN001',
              attendancePercentage: 50,
              statutoryWarning: true,
            }),
          ],
        })
      );
    });
  });

  describe('getChildAttendance', () => {
    it('returns 403 Forbidden when a parent attempts to view an unlinked child profile (IDOR guard)', async () => {
      mockReq.params = { studentId: 'student-stranger' };
      (prisma.parentStudent.findUnique as jest.Mock).mockResolvedValue(null);

      await ParentController.getChildAttendance(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Access denied'),
        })
      );
    });

    it('returns detailed lecture breakdown and warning message when attendance is under 75%', async () => {
      mockReq.params = { studentId: 'student-1' };
      (prisma.parentStudent.findUnique as jest.Mock).mockResolvedValue({
        id: 'link-1',
        student: { id: 'student-1', prn: 'PRN001', firstName: 'Rahul', lastName: 'Sharma' },
      });

      (prisma.attendanceRecord.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'att-1',
          finalStatus: 'PRESENT',
          startAttended: true,
          endAttended: true,
          createdAt: new Date(),
          session: {
            subject: { name: 'Database Systems' },
            faculty: { firstName: 'Dr.', lastName: 'Smith' },
          },
        },
        {
          id: 'att-2',
          finalStatus: 'ABSENT',
          startAttended: false,
          endAttended: false,
          createdAt: new Date(),
          session: {
            subject: { name: 'Operating Systems' },
            faculty: { firstName: 'Prof.', lastName: 'Brown' },
          },
        },
      ]);

      await ParentController.getChildAttendance(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            metrics: expect.objectContaining({
              totalLectures: 2,
              attendedLectures: 1,
              attendancePercentage: 50,
              statutoryWarning: true,
              warningMessage: expect.stringContaining('Attendance is below 75%'),
            }),
          }),
        })
      );
    });
  });

  describe('getChildGrades', () => {
    it('returns published grades and SGPA calculation for an authorized child', async () => {
      mockReq.params = { studentId: 'student-1' };
      (prisma.parentStudent.findUnique as jest.Mock).mockResolvedValue({
        id: 'link-1',
        student: { id: 'student-1', prn: 'PRN001', firstName: 'Rahul', lastName: 'Sharma' },
      });

      (prisma.subjectGrade.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'grade-1',
          attendanceScore: 90,
          quizScore: 90,
          assignmentScore: 90,
          examScore: 90,
          totalWeightedScore: 90,
          letterGrade: 'O',
          gradePoint: 10.0,
          subject: { code: 'CS101', name: 'Computer Architecture' },
          academicYear: { name: '2024-25' },
        },
      ]);

      await ParentController.getChildGrades(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            sgpa: 10.0,
            transcriptHash: expect.any(String),
          }),
        })
      );
    });
  });
});
