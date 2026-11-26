import api from './client';

export interface LinkedChild {
  studentId: string;
  prn: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  className: string;
  divisionName: string;
  academicYear: string;
  totalLectures: number;
  attendedLectures: number;
  attendancePercentage: number;
  statutoryWarning: boolean;
}

export interface AttendanceRecordItem {
  id: string;
  subjectName: string;
  facultyName: string;
  date: string;
  finalStatus: 'PRESENT' | 'PARTIAL' | 'LATE' | 'ABSENT' | 'EXCUSED';
  startAttended: boolean;
  endAttended: boolean;
}

export interface ChildAttendanceResponse {
  student: {
    id: string;
    prn: string;
    name: string;
  };
  metrics: {
    totalLectures: number;
    attendedLectures: number;
    presentCount: number;
    partialCount: number;
    lateCount: number;
    absentCount: number;
    attendancePercentage: number;
    statutoryWarning: boolean;
    warningMessage: string;
  };
  records: AttendanceRecordItem[];
}

export interface SubjectGradeItem {
  id: string;
  subjectCode?: string;
  subjectName: string;
  academicYear: string;
  attendanceScore: number;
  quizScore: number;
  assignmentScore: number;
  examScore: number;
  totalWeightedScore: number;
  letterGrade: string;
  gradePoint: number;
}

export interface ChildGradesResponse {
  student: {
    id: string;
    prn: string;
    name: string;
  };
  sgpa: number;
  transcriptHash: string;
  grades: SubjectGradeItem[];
}

export const parentApi = {
  getChildren: async (): Promise<LinkedChild[]> => {
    const res = await api.get('/parent/children');
    return res.data.data;
  },
  getChildAttendance: async (studentId: string): Promise<ChildAttendanceResponse> => {
    const res = await api.get(`/parent/children/${studentId}/attendance`);
    return res.data.data;
  },
  getChildGrades: async (studentId: string): Promise<ChildGradesResponse> => {
    const res = await api.get(`/parent/children/${studentId}/grades`);
    return res.data.data;
  },
};
