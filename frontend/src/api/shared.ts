import api from './client';

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  refEntityType: string | null;
  refEntityId: string | null;
  isRead: boolean;
  createdAt: string;
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

export const sharedApi = {
  notifications: {
    list: async () => {
      const res = await api.get<{ notifications: Notification[] }>('/shared/notifications');
      return res.data.notifications;
    },
    markAsRead: async (id: string) => {
      const res = await api.patch<{ success: boolean }>(`/shared/notifications/${id}/read`);
      return res.data;
    },
    markAllAsRead: async () => {
      const res = await api.patch<{ success: boolean }>(`/shared/notifications/all/read`);
      return res.data;
    }
  },
  notices: {
    list: async () => {
      const res = await api.get<{ notices: Notice[] }>('/shared/notices');
      return res.data.notices;
    },
    create: async (data: any) => {
      const res = await api.post<{ notice: Notice }>('/shared/notices', data);
      return res.data.notice;
    }
  }
};
