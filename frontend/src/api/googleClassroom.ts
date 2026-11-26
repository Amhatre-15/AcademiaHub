import api from './client';

export interface GoogleStatus {
  isConfigured: boolean;
  connected: boolean;
  googleEmail: string | null;
  lastConnected: string | null;
}

export interface GoogleCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  room?: string;
  enrollmentCode?: string;
  alternateLink?: string;
  role?: 'TEACHER' | 'STUDENT';
}

export interface GoogleDriveFile {
  id: string;
  title: string;
  alternateLink?: string;
  thumbnailUrl?: string;
}

export interface GoogleMaterialItem {
  driveFile?: {
    driveFile: GoogleDriveFile;
    shareMode?: string;
  };
  youtubeVideo?: {
    id: string;
    title: string;
    alternateLink: string;
    thumbnailUrl: string;
  };
  link?: {
    url: string;
    title: string;
    thumbnailUrl?: string;
  };
  form?: {
    formUrl: string;
    title: string;
    responseUrl?: string;
  };
}

export interface GoogleCourseMaterial {
  id: string;
  title: string;
  description?: string;
  materials?: GoogleMaterialItem[];
  updateTime?: string;
  state?: string;
  alternateLink?: string;
}

export interface GoogleAnnouncement {
  id: string;
  text: string;
  materials?: GoogleMaterialItem[];
  updateTime?: string;
  state?: string;
  alternateLink?: string;
}

export interface GoogleCourseWork {
  id: string;
  title: string;
  description?: string;
  materials?: GoogleMaterialItem[];
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours: number; minutes: number };
  maxPoints?: number;
  alternateLink?: string;
  workType?: string;
}

export interface GoogleClassroomLink {
  id: string;
  classId: string;
  subjectId?: string | null;
  googleCourseId: string;
  googleCourseName: string;
  enrollmentCode?: string | null;
  section?: string | null;
  alternateLink?: string | null;
  class?: { id: string; name: string };
  subject?: { id: string; name: string; code?: string | null };
}

export interface ClassroomDetailsResponse {
  linked: boolean;
  link: GoogleClassroomLink | null;
  materials: GoogleCourseMaterial[];
  announcements: GoogleAnnouncement[];
  courseWork: GoogleCourseWork[];
  errorNotice: string | null;
}

export const googleClassroomApi = {
  getStatus: async (): Promise<GoogleStatus> => {
    const res = await api.get<GoogleStatus>('/shared/google/status');
    return res.data;
  },

  getAuthUrl: async (returnTo?: string): Promise<{ url: string }> => {
    const res = await api.get<{ url: string }>('/shared/google/url', {
      params: { returnTo },
    });
    return res.data;
  },

  disconnect: async (): Promise<{ message: string }> => {
    const res = await api.delete<{ message: string }>('/shared/google/disconnect');
    return res.data;
  },

  getCourses: async (): Promise<GoogleCourse[]> => {
    const res = await api.get<{ courses: GoogleCourse[] }>('/shared/google/courses');
    return res.data.courses;
  },

  linkCourse: async (data: {
    classId: string;
    subjectId?: string;
    googleCourseId?: string;
    enrollmentCode?: string;
  }): Promise<{ message: string; link: GoogleClassroomLink }> => {
    const res = await api.post<{ message: string; link: GoogleClassroomLink }>(
      '/shared/google/link',
      data
    );
    return res.data;
  },

  unlinkCourse: async (id: string): Promise<{ message: string }> => {
    const res = await api.delete<{ message: string }>(`/shared/google/link/${id}`);
    return res.data;
  },

  getDetails: async (params: {
    classId: string;
    subjectId?: string;
  }): Promise<ClassroomDetailsResponse> => {
    const res = await api.get<ClassroomDetailsResponse>('/shared/google/classroom/details', {
      params,
    });
    return res.data;
  },

  getLinks: async (classId?: string): Promise<GoogleClassroomLink[]> => {
    const res = await api.get<{ links: GoogleClassroomLink[] }>('/shared/google/classroom/links', {
      params: { classId },
    });
    return res.data.links;
  },

  getDriveDownloadUrl: (fileId: string): string => {
    return `/api/shared/google/drive/file/${fileId}/download`;
  },
};
