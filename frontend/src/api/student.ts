import api from './client';
import type { TimetableEntry } from './admin';
import type { ClassSession, Material } from './faculty';

export interface StudentNote {
  id: string;
  title: string;
  content: string;
  classId: string | null;
  subjectId: string | null;
  sessionId: string | null;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  subject?: { id: string; name: string } | null;
  session?: { id: string; date: string; topic: string | null } | null;
}

export interface StudentAssignment {
  id: string;
  title: string;
  description: string | null;
  classId: string;
  subjectId: string;
  deadline: string | null;
  maxMarks: number | null;
  status: 'PUBLISHED' | 'CLOSED';
  createdAt: string;
  files?: any[];
  submission?: any | null;
  subject?: { name: string; code: string };
  class?: { name: string };
  faculty?: { firstName: string; lastName: string };
}

export interface StudentQuizQuestion {
  id: string;
  text: string;
  type: 'MCQ' | 'SHORT_ANSWER' | 'NUMERICAL' | 'ONE_LINER';
  durationSeconds: number;
  endsAt: string;
  options: Array<{ id: string; text: string; order: number }>;
  alreadyAnswered: boolean;
}

export interface StudentActiveQuizResponse {
  quiz: {
    id: string;
    title: string;
    status: string;
    mode: string;
    sessionId: string;
    subject: { id: string; name: string };
    class: { id: string; name: string };
  } | null;
  currentQuestion: StudentQuizQuestion | null;
  sessionId: string | null;
  eligible?: boolean;
  ineligible?: boolean;
  message?: string;
}

export interface QuizResultAnswer {
  questionId: string;
  questionText: string;
  questionType: string;
  yourAnswer: string | null;
  isCorrect: boolean;
  correctAnswer: string | null;
  explanation: string | null;
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
}

export interface QuizResultResponse {
  quiz: { id: string; title: string; subject: { name: string }; class: { name: string } };
  attempt: {
    score: number;
    maxScore: number;
    completedAt: string | null;
    answers: QuizResultAnswer[];
  } | null;
  myRank: number | null;
  totalParticipants: number;
  leaderboard: Array<{ rank: number; studentName: string; score: number; maxScore: number; isMe: boolean }>;
}

export interface StudentAttendanceSummary {
  overall: {
    total: number;
    present: number;
    partial: number;
    late: number;
    absent: number;
    excused: number;
    attendancePercentage: number;
  } | null;
  bySubject: Array<{
    subjectId: string;
    subjectName: string;
    total: number;
    present: number;
    partial: number;
    late: number;
    absent: number;
    excused: number;
    attendancePercentage: number;
  }>;
  recentSessions: Array<{
    sessionId: string;
    date: string;
    scheduledStart: string;
    subject: { id: string; name: string };
    class: { id: string; name: string };
    division: { id: string; name: string } | null;
    batch: { id: string; name: string } | null;
    status: 'PRESENT' | 'PARTIAL' | 'LATE' | 'ABSENT' | 'EXCUSED';
    automatedStatus: 'PRESENT' | 'PARTIAL' | 'LATE' | 'ABSENT' | 'EXCUSED';
    wasOverridden: boolean;
    startSubmittedAt: string | null;
    endSubmittedAt: string | null;
  }>;
}

export const studentApi = {
  timetable: {
    getWeekly: async () => {
      const res = await api.get<any>('/student/timetable');
      if (Array.isArray(res.data)) return res.data;
      return res.data?.entries || [];
    },
    getToday: async () => {
      const res = await api.get<any>('/student/timetable/today');
      if (Array.isArray(res.data)) return res.data;
      return res.data?.entries || [];
    }
  },
  overview: {
    getStats: async () => {
      const res = await api.get<any>('/student/overview');
      return res.data;
    }
  },
  sessions: {
    getActive: async () => {
      const res = await api.get<ClassSession | null>('/student/sessions/active');
      return res.data;
    },
    submitAttendance: async (sessionId: string, payload: { code?: string; qrPayload?: string } | string) => {
      const body = typeof payload === 'string' ? { code: payload } : payload;
      const res = await api.post<{ success: boolean; message: string }>(
        `/student/sessions/${sessionId}/attendance/submit`,
        body
      );
      return res.data;
    }
  },
  attendance: {
    getSummary: async (): Promise<StudentAttendanceSummary> => {
      const res = await api.get<StudentAttendanceSummary>('/student/attendance');
      return res.data;
    }
  },
  materials: {
    getAll: async () => {
      const res = await api.get<{ materials: Material[] }>('/student/materials');
      return res.data.materials;
    },
    getDownloadUrl: async (id: string) => {
      const res = await api.get<{ url: string }>(`/student/materials/${id}/download`);
      return res.data.url;
    }
  },
  quiz: {
    getActive: async (): Promise<StudentActiveQuizResponse> => {
      const res = await api.get<StudentActiveQuizResponse>('/student/quiz/active');
      return res.data;
    },
    submit: async (data: {
      quizId: string;
      questionId: string;
      optionId?: string;
      answerText?: string;
      timeTakenSec?: number;
    }) => {
      const res = await api.post<{ success: boolean; isCorrect: boolean; answerId: string }>(
        '/student/quiz/submit',
        data
      );
      return res.data;
    },
    reportViolation: async (
      quizId: string,
      type: 'WINDOW_BLUR' | 'TAB_HIDDEN' | 'CONTEXT_MENU' | 'COPY' | 'PASTE'
    ) => {
      const res = await api.post<{ success: boolean; violationCount: number }>(
        '/student/quiz/violation',
        { quizId, type }
      );
      return res.data;
    },
    getResult: async (quizId: string): Promise<QuizResultResponse> => {
      const res = await api.get<QuizResultResponse>(`/student/quiz/${quizId}/result`);
      return res.data;
    },
    getHistory: async (params?: { page?: number; limit?: number }) => {
      const res = await api.get<{ attempts: any[]; total: number; page: number; limit: number; totalPages: number }>('/student/quiz/history', { params });
      return res.data;
    },
  },
  notes: {
    list: async (params?: { q?: string; classId?: string; subjectId?: string; sessionId?: string }) => {
      const res = await api.get<{ notes: StudentNote[] }>('/student/notes', { params });
      return res.data.notes;
    },
    getContext: async () => {
      const res = await api.get<{ classes: any[]; subjects: any[] }>('/student/notes/context');
      return res.data;
    },
    get: async (id: string) => {
      const res = await api.get<{ note: StudentNote }>(`/student/notes/${id}`);
      return res.data.note;
    },
    create: async (data: { title?: string; content?: string; classId?: string; subjectId?: string; sessionId?: string }) => {
      const res = await api.post<{ note: StudentNote }>('/student/notes', data);
      return res.data.note;
    },
    update: async (id: string, data: { title?: string; content?: string; classId?: string; subjectId?: string; sessionId?: string }) => {
      const res = await api.patch<{ note: StudentNote }>(`/student/notes/${id}`, data);
      return res.data.note;
    },
    delete: async (id: string) => {
      const res = await api.delete<{ success: boolean }>(`/student/notes/${id}`);
      return res.data.success;
    }
  },
  assignments: {
    list: async () => {
      const res = await api.get<{ assignments: StudentAssignment[] }>('/student/assignments');
      return res.data.assignments;
    },
    get: async (id: string) => {
      const res = await api.get<{ assignment: StudentAssignment }>(`/student/assignments/${id}`);
      return res.data.assignment;
    },
    submit: async (id: string, data: FormData) => {
      const res = await api.post<{ submission: any }>(`/student/assignments/${id}/submit`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.submission;
    },
  },
  analytics: {
    getOverview: async () => {
      const res = await api.get<{
        engagement: { totalXp: number; level: number; streak: number };
        badges: any[];
        recentEvents: any[];
        metrics: { attendancePercentage: number; quizAverage: number; assignmentCompletion: number; totalClassesAttended: number };
      }>('/student/analytics');
      return res.data;
    },
    getLeaderboard: async () => {
      const res = await api.get<{ leaderboard: any[] }>('/student/analytics/leaderboard');
      return res.data.leaderboard;
    }
  },
  ai: {
    chat: async (message: string, contextContext?: string) => {
      const res = await api.post<{ reply?: string; error?: string; disabled?: boolean }>('/student/ai/chat', { message, contextContext });
      return res.data;
    }
  },
  doubts: {
    list: async (sessionId: string) => {
      const res = await api.get<{ doubts: ClassroomDoubt[] }>(`/student/sessions/${sessionId}/doubts`);
      return res.data.doubts;
    },
    create: async (sessionId: string, data: { question: string; isAnonymous?: boolean }) => {
      const res = await api.post<{ doubt: ClassroomDoubt }>(`/student/sessions/${sessionId}/doubts`, data);
      return res.data.doubt;
    },
    toggleUpvote: async (sessionId: string, doubtId: string) => {
      const res = await api.post<{ hasUpvoted: boolean; upvotesCount: number }>(`/student/sessions/${sessionId}/doubts/${doubtId}/upvote`);
      return res.data;
    },
  },
  whiteboard: {
    get: async (sessionId: string) => {
      const res = await api.get<{ whiteboardState: string | null }>(`/student/sessions/${sessionId}/whiteboard`);
      return res.data.whiteboardState;
    },
  }
};

export interface ClassroomDoubt {
  id: string;
  sessionId: string;
  question: string;
  isAnonymous: boolean;
  status: 'PENDING' | 'ANSWERED' | 'DISMISSED';
  createdAt: string;
  authorName: string;
  authorPrn?: string;
  isAuthor: boolean;
  upvotesCount: number;
  hasUpvoted: boolean;
}

