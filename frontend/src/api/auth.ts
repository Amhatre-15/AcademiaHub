import api from './client';

export type { LoginRequest, ChangePasswordRequest, AuthUser, LoginResponse };

interface LoginRequest {
  username: string;
  password: string;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface AuthUser {
  id: string;
  username: string;
  role: 'IT_ADMIN' | 'FACULTY' | 'STUDENT' | 'PARENT' | 'EXAM_OFFICER' | 'DEAN';
  firstLogin: boolean;
  profile: {
    id: string;
    firstName?: string;
    lastName?: string;
    prn?: string;
    employeeId?: string;
  } | null;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<LoginResponse>('/auth/login', data).then((r) => r.data),

  changePassword: (data: ChangePasswordRequest) =>
    api.post('/auth/change-password', data).then((r) => r.data),

  me: () =>
    api.get<{ user: AuthUser }>('/auth/me').then((r) => r.data.user),

  logout: () =>
    api.post('/auth/logout').then((r) => r.data),
};
