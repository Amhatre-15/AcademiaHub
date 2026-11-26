import api from './client';
import type { TimetableEntry } from './admin';

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

export interface FacultyAssignment {
  id: string;
  title: string;
  description: string | null;
  classId: string;
  subjectId: string;
  deadline: string | null;
  maxMarks: number | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  createdAt: string;
  files: any[];
  submissions: any[];
  subject?: { name: string; code: string };
  class?: { name: string };
  _count?: { submissions: number };
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  audienceType: string;
  audienceRefId: string | null;
  isPinned: boolean;
  createdAt: string;
  createdBy: { username: string };
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  text: string;
  type: 'MCQ' | 'SHORT_ANSWER' | 'NUMERICAL' | 'ONE_LINER';
  order: number;
  durationSeconds: number;
  correctAnswer: string | null;
  explanation: string | null;
  isActive: boolean;
  launchedAt: string | null;
  endsAt: string | null;
  options: QuizOption[];
}

export interface Quiz {
  id: string;
  title: string;
  description: string | null;
  subjectId: string;
  classId: string;
  divisionId: string | null;
  batchId: string | null;
  facultyId: string;
  sessionId: string | null;
  mode: 'MANUAL' | 'AUTOMATIC';
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  currentQuestionId: string | null;
  questionIntervalSec: number | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  subject?: { id: string; name: string; code?: string | null };
  class?: { id: string; name: string };
  division?: { id: string; name: string } | null;
  batch?: { id: string; name: string } | null;
  session?: { id: string; date: string; topic: string | null } | null;
  questions?: QuizQuestion[];
  _count?: { questions: number; attempts: number };
}

export interface Material {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  visibility: 'PRIVATE' | 'CLASS' | 'COURSE';
  createdAt: string;
  subject?: { name: string; code: string | null };
  class?: { name: string };
  session?: { date: string; topic: string | null } | null;
}

export interface ClassSession {
  id: string;
  timetableEntryId: string | null;
  facultyId: string;
  subjectId: string;
  classId: string;
  divisionId: string | null;
  batchId: string | null;
  date: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  status: 'PREPARED' | 'ACTIVE' | 'CLOSED';
  topic: string | null;
  notes: string | null;
  subject?: { name: string; code: string | null };
  class?: { name: string };
  faculty?: { firstName: string; lastName: string };
  attendanceCheckpoints?: AttendanceCheckpoint[];
}

export interface AttendanceCheckpoint {
  id: string;
  sessionId: string;
  checkpointType: 'START' | 'END';
  code?: string;
  qrSecret?: string;
  serverTime?: number;
  generatedAt: string;
  expiresAt: string;
  closedAt: string | null;
  isActive: boolean;
  _count?: { submissions: number };
}

export type AttendanceStatus = 'PRESENT' | 'PARTIAL' | 'LATE' | 'ABSENT' | 'EXCUSED';

export interface AttendanceRosterEntry {
  studentId: string;
  prn: string;
  firstName: string;
  lastName: string;
  attendanceRecord: {
    id: string;
    automatedStatus: AttendanceStatus;
    finalStatus: AttendanceStatus;
    startSubmittedAt: string | null;
    endSubmittedAt: string | null;
    overrideReason: string | null;
    overriddenAt: string | null;
    overriddenBy: string | null;
  } | null;
}

export interface SessionAttendanceResponse {
  session: ClassSession & {
    subject: { id: string; name: string };
    class: { id: string; name: string };
    division: { id: string; name: string } | null;
    batch: { id: string; name: string } | null;
    checkpoints: AttendanceCheckpoint[];
  };
  roster: AttendanceRosterEntry[];
  summary: {
    total: number;
    present: number;
    partial: number;
    late: number;
    absent: number;
    excused: number;
    noRecord: number;
  };
}

export const facultyApi = {
  timetable: {
    getWeekly: async () => {
      const res = await api.get<TimetableEntry[]>('/faculty/timetable');
      return res.data;
    },
    getToday: async () => {
      const res = await api.get<TimetableEntry[]>('/faculty/timetable/today');
      return res.data;
    }
  },
  sessions: {
    getActive: async () => {
      const res = await api.get<ClassSession | null>('/faculty/sessions/active');
      return res.data;
    },
    start: async (timetableEntryId: string) => {
      const res = await api.post<ClassSession>('/faculty/sessions/start', { timetableEntryId });
      return res.data;
    },
    end: async (sessionId: string) => {
      const res = await api.post<ClassSession>(`/faculty/sessions/${sessionId}/end`);
      return res.data;
    },
    generateCode: async (sessionId: string, checkpointType: 'START' | 'END', durationSeconds = 60) => {
      const res = await api.post<AttendanceCheckpoint>(`/faculty/sessions/${sessionId}/attendance/generate`, {
        checkpointType,
        durationSeconds
      });
      return res.data;
    }
  },
  attendance: {
    getSessions: async (page = 1, limit = 20) => {
      const res = await api.get<{ sessions: any[]; pagination: any }>('/faculty/attendance/sessions', { params: { page, limit } });
      return res.data;
    },
    getSessionRoster: async (sessionId: string): Promise<SessionAttendanceResponse> => {
      const res = await api.get<SessionAttendanceResponse>(`/faculty/attendance/sessions/${sessionId}`);
      return res.data;
    },
    override: async (sessionId: string, studentId: string, finalStatus: AttendanceStatus, reason: string) => {
      const res = await api.patch<{ success: boolean; record: any }>(
        `/faculty/attendance/sessions/${sessionId}/students/${studentId}`,
        { finalStatus, reason }
      );
      return res.data;
    }
  },
  materials: {
    getAll: async () => {
      const res = await api.get<{ materials: Material[] }>('/faculty/materials');
      return res.data.materials;
    },
    upload: async (data: FormData) => {
      const res = await api.post<{ material: Material }>('/faculty/materials', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data.material;
    },
    update: async (id: string, data: Partial<Material>) => {
      const res = await api.patch<{ material: Material }>(`/faculty/materials/${id}`, data);
      return res.data.material;
    },
    delete: async (id: string) => {
      const res = await api.delete<{ success: boolean }>(`/faculty/materials/${id}`);
      return res.data.success;
    }
  },
  quiz: {
    list: async (params?: { page?: number; limit?: number; search?: string }) => {
      const res = await api.get<{ quizzes: Quiz[]; total: number; page: number; limit: number; totalPages: number }>('/faculty/quiz', { params });
      return res.data;
    },
    get: async (id: string) => {
      const res = await api.get<{ quiz: Quiz }>(`/faculty/quiz/${id}`);
      return res.data.quiz;
    },
    create: async (data: {
      title: string;
      description?: string;
      subjectId: string;
      classId: string;
      divisionId?: string;
      batchId?: string;
      sessionId?: string;
      mode?: 'MANUAL' | 'AUTOMATIC';
    }) => {
      const res = await api.post<{ quiz: Quiz }>('/faculty/quiz', data);
      return res.data.quiz;
    },
    update: async (id: string, data: Partial<Quiz>) => {
      const res = await api.patch<{ quiz: Quiz }>(`/faculty/quiz/${id}`, data);
      return res.data.quiz;
    },
    delete: async (id: string) => {
      const res = await api.delete<{ success: boolean }>(`/faculty/quiz/${id}`);
      return res.data.success;
    },
    addQuestion: async (quizId: string, data: {
      text: string;
      type: 'MCQ' | 'SHORT_ANSWER' | 'NUMERICAL' | 'ONE_LINER';
      durationSeconds: number;
      correctAnswer?: string;
      explanation?: string;
      options?: Array<{ text: string; isCorrect: boolean; order?: number }>;
    }) => {
      const res = await api.post<{ question: QuizQuestion }>(`/faculty/quiz/${quizId}/questions`, data);
      return res.data.question;
    },
    updateQuestion: async (quizId: string, questionId: string, data: Partial<QuizQuestion & { options: Array<{ text: string; isCorrect: boolean; order?: number }> }>) => {
      const res = await api.patch<{ question: QuizQuestion }>(`/faculty/quiz/${quizId}/questions/${questionId}`, data);
      return res.data.question;
    },
    deleteQuestion: async (quizId: string, questionId: string) => {
      const res = await api.delete<{ success: boolean }>(`/faculty/quiz/${quizId}/questions/${questionId}`);
      return res.data.success;
    },
    start: async (quizId: string) => {
      const res = await api.post<{ quiz: Quiz; sessionId: string }>(`/faculty/quiz/${quizId}/start`);
      return res.data;
    },
    launchQuestion: async (quizId: string, questionId: string) => {
      const res = await api.post<{ success: boolean; question: { id: string; endsAt: string } }>(
        `/faculty/quiz/${quizId}/launch-question`,
        { questionId }
      );
      return res.data;
    },
    end: async (quizId: string) => {
      const res = await api.post<{ quiz: Quiz; leaderboard: any[] }>(`/faculty/quiz/${quizId}/end`);
      return res.data;
    },
    getResults: async (quizId: string) => {
      const res = await api.get<{ quiz: Quiz }>(`/faculty/quiz/${quizId}/results`);
      return res.data.quiz;
    },
  },
  assignments: {
    list: async () => {
      const res = await api.get<{ assignments: FacultyAssignment[] }>('/faculty/assignments');
      return res.data.assignments;
    },
    get: async (id: string) => {
      const res = await api.get<{ assignment: FacultyAssignment }>(`/faculty/assignments/${id}`);
      return res.data.assignment;
    },
    create: async (data: FormData) => {
      const res = await api.post<{ assignment: FacultyAssignment }>('/faculty/assignments', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.assignment;
    },
    grade: async (assignmentId: string, submissionId: string, data: { grade: number; feedback?: string }) => {
      const res = await api.patch<{ submission: any }>(`/faculty/assignments/${assignmentId}/submissions/${submissionId}/grade`, data);
      return res.data.submission;
    },
  },
  analytics: {
    getOverview: async () => {
      const res = await api.get<{
        metrics: { totalStudents: number; averageAttendance: number; averageQuizScore: number; totalClassesConducted: number };
        recentSessions: any[];
      }>('/faculty/analytics');
      return res.data;
    }
  },
  ai: {
    generateQuiz: async (subject: string, topic: string, numQuestions?: number) => {
      const res = await api.post<{ questions: any[] }>('/faculty/ai/generate-quiz', { subject, topic, numQuestions });
      return res.data.questions;
    }
  },
  doubts: {
    list: async (sessionId: string) => {
      const res = await api.get<{ doubts: any[] }>(`/faculty/sessions/${sessionId}/doubts`);
      return res.data.doubts;
    },
    updateStatus: async (sessionId: string, doubtId: string, status: 'PENDING' | 'ANSWERED' | 'DISMISSED') => {
      const res = await api.patch<{ doubt: any }>(`/faculty/sessions/${sessionId}/doubts/${doubtId}`, { status });
      return res.data.doubt;
    },
  },
  whiteboard: {
    get: async (sessionId: string) => {
      const res = await api.get<{ whiteboardState: string | null }>(`/faculty/sessions/${sessionId}/whiteboard`);
      return res.data.whiteboardState;
    },
    save: async (sessionId: string, whiteboardState: string) => {
      const res = await api.post<{ success: boolean }>(`/faculty/sessions/${sessionId}/whiteboard`, { whiteboardState });
      return res.data;
    },
  }
};

