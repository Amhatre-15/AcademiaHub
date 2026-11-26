import { google } from 'googleapis';
import { env } from '../config/env';
import { prisma } from '../config/prisma';

export class GoogleClassroomService {
  /**
   * Check whether Google OAuth credentials are fully configured.
   */
  static isConfigured(): boolean {
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    return !!(
      clientId &&
      clientSecret &&
      clientId !== 'your-google-client-id' &&
      clientSecret !== 'your-google-client-secret'
    );
  }

  /**
   * Create an OAuth2 client instance.
   */
  static getOAuth2Client() {
    return new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID || '',
      env.GOOGLE_CLIENT_SECRET || '',
      env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback'
    );
  }

  /**
   * Generate the Google OAuth authorization URL.
   */
  static getAuthUrl(state?: string): string {
    if (!this.isConfigured()) {
      throw new Error(
        'Google Classroom integration is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env'
      );
    }

    const oauth2Client = this.getOAuth2Client();

    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
      'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
      'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
      'https://www.googleapis.com/auth/classroom.announcements.readonly',
      'https://www.googleapis.com/auth/classroom.rosters.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state: state || '',
    });
  }

  /**
   * Exchange authorization code for tokens and save account to DB.
   */
  static async handleAuthCallback(code: string, userId: string) {
    const oauth2Client = this.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get the user's Google profile email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const googleEmail = userInfo.data.email || 'unknown@gmail.com';

    const expiryDate = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    const saved = await prisma.googleAccount.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || '',
        tokenExpiry: expiryDate,
        googleEmail,
      },
      update: {
        accessToken: tokens.access_token || '',
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        tokenExpiry: expiryDate,
        googleEmail,
      },
    });

    return { saved, googleEmail };
  }

  /**
   * Get an authorized OAuth2 client for a user, automatically refreshing expired tokens.
   */
  static async getAuthenticatedClient(userId: string) {
    const account = await prisma.googleAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new Error('Google account is not connected. Please connect your Google account first.');
    }

    const oauth2Client = this.getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: account.tokenExpiry.getTime(),
    });

    // Handle token refresh events
    oauth2Client.on('tokens', async (newTokens) => {
      try {
        await prisma.googleAccount.update({
          where: { userId },
          data: {
            accessToken: newTokens.access_token || account.accessToken,
            ...(newTokens.refresh_token ? { refreshToken: newTokens.refresh_token } : {}),
            tokenExpiry: newTokens.expiry_date
              ? new Date(newTokens.expiry_date)
              : new Date(Date.now() + 3600 * 1000),
          },
        });
      } catch (err) {
        console.error('Failed to update refreshed Google tokens:', err);
      }
    });

    return { oauth2Client, account };
  }

  /**
   * List courses accessible to user (courses taught or enrolled in).
   */
  static async listCourses(userId: string) {
    const { oauth2Client } = await this.getAuthenticatedClient(userId);
    const classroom = google.classroom({ version: 'v1', auth: oauth2Client });

    // Fetch both courses as teacher and courses as student
    const [teacherRes, studentRes] = await Promise.allSettled([
      classroom.courses.list({ teacherId: 'me', courseStates: ['ACTIVE'] }),
      classroom.courses.list({ studentId: 'me', courseStates: ['ACTIVE'] }),
    ]);

    const teacherCourses =
      teacherRes.status === 'fulfilled' ? teacherRes.value.data.courses || [] : [];
    const studentCourses =
      studentRes.status === 'fulfilled' ? studentRes.value.data.courses || [] : [];

    // Deduplicate by id
    const courseMap = new Map<string, any>();
    for (const c of teacherCourses) {
      if (c.id) courseMap.set(c.id, { ...c, role: 'TEACHER' });
    }
    for (const c of studentCourses) {
      if (c.id && !courseMap.has(c.id)) {
        courseMap.set(c.id, { ...c, role: 'STUDENT' });
      }
    }

    return Array.from(courseMap.values());
  }

  /**
   * Get course details by Course ID.
   */
  static async getCourse(userId: string, courseId: string) {
    const { oauth2Client } = await this.getAuthenticatedClient(userId);
    const classroom = google.classroom({ version: 'v1', auth: oauth2Client });
    const res = await classroom.courses.get({ id: courseId });
    return res.data;
  }

  /**
   * Find course by enrollment code.
   */
  static async findCourseByCode(userId: string, code: string) {
    const courses = await this.listCourses(userId);
    const trimmed = code.trim().toLowerCase();
    const found = courses.find(
      (c) =>
        (c.enrollmentCode && c.enrollmentCode.toLowerCase() === trimmed) ||
        (c.id && c.id === code.trim())
    );
    if (!found) {
      throw new Error(`No Google Classroom course found matching code or ID: "${code}"`);
    }
    return found;
  }

  /**
   * Get coursework materials for a course.
   */
  static async getCourseMaterials(userId: string, courseId: string) {
    const { oauth2Client } = await this.getAuthenticatedClient(userId);
    const classroom = google.classroom({ version: 'v1', auth: oauth2Client });

    const res = await classroom.courses.courseWorkMaterials.list({
      courseId,
      courseWorkMaterialStates: ['PUBLISHED'],
    });

    return res.data.courseWorkMaterial || [];
  }

  /**
   * Get announcements for a course.
   */
  static async getCourseAnnouncements(userId: string, courseId: string) {
    const { oauth2Client } = await this.getAuthenticatedClient(userId);
    const classroom = google.classroom({ version: 'v1', auth: oauth2Client });

    const res = await classroom.courses.announcements.list({
      courseId,
      announcementStates: ['PUBLISHED'],
    });

    return res.data.announcements || [];
  }

  /**
   * Get coursework (assignments/questions) for a course.
   */
  static async getCourseWork(userId: string, courseId: string) {
    const { oauth2Client } = await this.getAuthenticatedClient(userId);
    const classroom = google.classroom({ version: 'v1', auth: oauth2Client });

    const res = await classroom.courses.courseWork.list({
      courseId,
      courseWorkStates: ['PUBLISHED'],
    });

    return res.data.courseWork || [];
  }

  /**
   * Get drive file stream for downloading.
   */
  static async getDriveFileStream(userId: string, fileId: string) {
    const { oauth2Client } = await this.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const [metaRes, streamRes] = await Promise.all([
      drive.files.get({ fileId, fields: 'id, name, mimeType, size' }),
      drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' }),
    ]);

    return {
      metadata: metaRes.data,
      stream: streamRes.data,
    };
  }

  /**
   * Disconnect Google account.
   */
  static async disconnect(userId: string) {
    return prisma.googleAccount.deleteMany({
      where: { userId },
    });
  }
}
