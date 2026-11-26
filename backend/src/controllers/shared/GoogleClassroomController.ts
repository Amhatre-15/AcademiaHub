import { Request, Response, NextFunction } from 'express';
import { GoogleClassroomService } from '../../services/GoogleClassroomService';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';

export class GoogleClassroomController {
  /**
   * GET /api/shared/google/status
   * Get Google connection status and integration availability.
   */
  static async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const isConfigured = GoogleClassroomService.isConfigured();

      const account = await prisma.googleAccount.findUnique({
        where: { userId },
        select: { googleEmail: true, updatedAt: true },
      });

      res.json({
        isConfigured,
        connected: !!account,
        googleEmail: account?.googleEmail ?? null,
        lastConnected: account?.updatedAt ?? null,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/google/url
   * Generate Google OAuth authorization URL.
   */
  static async getAuthUrl(req: Request, res: Response, next: NextFunction) {
    try {
      if (!GoogleClassroomService.isConfigured()) {
        res.status(503).json({
          error:
            'Google Classroom is not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the backend .env file.',
        });
        return;
      }

      const userId = req.user!.userId;
      const returnTo = (req.query['returnTo'] as string) || '/materials';
      // State includes userId and frontend return path
      const statePayload = Buffer.from(JSON.stringify({ userId, returnTo })).toString('base64');

      const url = GoogleClassroomService.getAuthUrl(statePayload);
      res.json({ url });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/google/callback
   * OAuth redirect callback from Google.
   */
  static async handleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.query['code'] as string;
      const state = req.query['state'] as string;

      if (!code) {
        res.redirect(`${env.FRONTEND_URL}/materials?google_auth=error&message=No+code+provided`);
        return;
      }

      let userId = '';
      let returnTo = '/materials';

      if (state) {
        try {
          const parsed = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
          userId = parsed.userId;
          returnTo = parsed.returnTo || returnTo;
        } catch {
          // ignore parsing error
        }
      }

      if (!userId && req.user) {
        userId = req.user.userId;
      }

      if (!userId) {
        res.redirect(`${env.FRONTEND_URL}/materials?google_auth=error&message=Session+lost`);
        return;
      }

      await GoogleClassroomService.handleAuthCallback(code, userId);

      res.redirect(
        `${env.FRONTEND_URL}${returnTo.startsWith('/') ? returnTo : '/' + returnTo}${
          returnTo.includes('?') ? '&' : '?'
        }google_auth=success`
      );
    } catch (error: any) {
      console.error('Google OAuth callback error:', error);
      const errMsg = encodeURIComponent(error?.message || 'Google authorization failed');
      res.redirect(`${env.FRONTEND_URL}/materials?google_auth=error&message=${errMsg}`);
    }
  }

  /**
   * DELETE /api/shared/google/disconnect
   * Disconnect user's Google account.
   */
  static async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      await GoogleClassroomService.disconnect(userId);
      res.json({ message: 'Google account disconnected successfully.' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/shared/google/courses
   * List courses accessible to current user.
   */
  static async listCourses(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const courses = await GoogleClassroomService.listCourses(userId);
      res.json({ courses });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/faculty/google/link
   * Link a Google Classroom course to an AcademicHub class and optional subject.
   */
  static async linkCourse(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { classId, subjectId, googleCourseId, enrollmentCode } = req.body;

      if (!classId) {
        res.status(400).json({ error: 'classId is required.' });
        return;
      }

      if (!googleCourseId && !enrollmentCode) {
        res.status(400).json({ error: 'Either googleCourseId or enrollmentCode is required.' });
        return;
      }

      // Check class exists
      const targetClass = await prisma.class.findUnique({
        where: { id: classId },
      });
      if (!targetClass) {
        res.status(404).json({ error: 'AcademicHub class not found.' });
        return;
      }

      // If subjectId is provided, check subject exists
      if (subjectId) {
        const targetSubject = await prisma.subject.findUnique({
          where: { id: subjectId },
        });
        if (!targetSubject) {
          res.status(404).json({ error: 'Subject not found.' });
          return;
        }
      }

      let courseDetails: any = null;

      try {
        if (googleCourseId) {
          courseDetails = await GoogleClassroomService.getCourse(userId, googleCourseId);
        } else if (enrollmentCode) {
          courseDetails = await GoogleClassroomService.findCourseByCode(userId, enrollmentCode);
        }
      } catch (err: any) {
        res.status(400).json({
          error:
            err?.message ||
            'Could not retrieve Google Classroom course. Ensure you have joined or created this course.',
        });
        return;
      }

      // Check existing link for classId and subjectId
      const existing = await prisma.googleClassroomLink.findFirst({
        where: {
          classId,
          subjectId: subjectId || null,
        },
      });

      let linked;
      const payload = {
        classId,
        subjectId: subjectId || null,
        googleCourseId: courseDetails.id,
        googleCourseName: courseDetails.name || 'Untitled Course',
        enrollmentCode: courseDetails.enrollmentCode || enrollmentCode || null,
        section: courseDetails.section || null,
        alternateLink: courseDetails.alternateLink || null,
        linkedByUserId: userId,
      };

      if (existing) {
        linked = await prisma.googleClassroomLink.update({
          where: { id: existing.id },
          data: payload,
          include: {
            class: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true, code: true } },
          },
        });
      } else {
        linked = await prisma.googleClassroomLink.create({
          data: payload,
          include: {
            class: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true, code: true } },
          },
        });
      }

      res.json({
        message: 'Google Classroom linked successfully.',
        link: linked,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/faculty/google/link/:id
   * Unlink a Google Classroom.
   */
  static async unlinkCourse(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params['id']);
      await prisma.googleClassroomLink.delete({
        where: { id },
      });
      res.json({ message: 'Google Classroom unlinked successfully.' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/shared/google/classroom/details
   * Get Google Classroom details, materials, announcements, and coursework for a class/subject.
   * Query params: classId (required), subjectId (optional)
   */
  static async getCourseDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const classId = req.query['classId'] as string;
      const subjectId = (req.query['subjectId'] as string) || null;

      if (!classId) {
        res.status(400).json({ error: 'classId is required.' });
        return;
      }

      // Find link: first try subject-specific, then fallback to class-wide
      let link = await prisma.googleClassroomLink.findFirst({
        where: {
          classId,
          ...(subjectId ? { subjectId } : {}),
        },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          class: { select: { id: true, name: true } },
        },
      });

      // If looking for a subject but none found specifically for that subject, check class-wide (subjectId: null)
      if (!link && subjectId) {
        link = await prisma.googleClassroomLink.findFirst({
          where: { classId, subjectId: null },
          include: {
            subject: { select: { id: true, name: true, code: true } },
            class: { select: { id: true, name: true } },
          },
        });
      }

      if (!link) {
        res.json({
          linked: false,
          link: null,
          materials: [],
          announcements: [],
          courseWork: [],
        });
        return;
      }

      // Try fetching using current user's Google token first; fallback to linkedByUserId's token
      let effectiveUserId = userId;
      let materials: any[] = [];
      let announcements: any[] = [];
      let courseWork: any[] = [];
      let errorNotice: string | null = null;

      const userHasGoogle = await prisma.googleAccount.findUnique({ where: { userId } });
      if (!userHasGoogle) {
        effectiveUserId = link.linkedByUserId;
      }

      try {
        const [mRes, aRes, cwRes] = await Promise.allSettled([
          GoogleClassroomService.getCourseMaterials(effectiveUserId, link.googleCourseId),
          GoogleClassroomService.getCourseAnnouncements(effectiveUserId, link.googleCourseId),
          GoogleClassroomService.getCourseWork(effectiveUserId, link.googleCourseId),
        ]);

        materials = mRes.status === 'fulfilled' ? mRes.value : [];
        announcements = aRes.status === 'fulfilled' ? aRes.value : [];
        courseWork = cwRes.status === 'fulfilled' ? cwRes.value : [];

        // If primary attempt failed with auth error, try fallback to teacher
        if (
          effectiveUserId !== link.linkedByUserId &&
          mRes.status === 'rejected' &&
          aRes.status === 'rejected'
        ) {
          try {
            const [fallbackM, fallbackA, fallbackCW] = await Promise.allSettled([
              GoogleClassroomService.getCourseMaterials(link.linkedByUserId, link.googleCourseId),
              GoogleClassroomService.getCourseAnnouncements(link.linkedByUserId, link.googleCourseId),
              GoogleClassroomService.getCourseWork(link.linkedByUserId, link.googleCourseId),
            ]);
            materials = fallbackM.status === 'fulfilled' ? fallbackM.value : [];
            announcements = fallbackA.status === 'fulfilled' ? fallbackA.value : [];
            courseWork = fallbackCW.status === 'fulfilled' ? fallbackCW.value : [];
          } catch {
            // fallback error
          }
        }
      } catch (err: any) {
        errorNotice = err?.message || 'Failed to load classroom content.';
      }

      res.json({
        linked: true,
        link,
        materials,
        announcements,
        courseWork,
        errorNotice,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/shared/google/classroom/links
   * List all linked Google Classrooms for the user's classes/subjects.
   */
  static async listAllLinks(req: Request, res: Response, next: NextFunction) {
    try {
      const classId = req.query['classId'] as string | undefined;

      const links = await prisma.googleClassroomLink.findMany({
        where: classId ? { classId } : {},
        include: {
          class: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ links });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/shared/google/drive/file/:fileId/download
   * Proxy Google Drive file download so students stay inside the platform.
   */
  static async proxyDriveDownload(req: Request, res: Response, next: NextFunction) {
    try {
      const fileId = String(req.params['fileId']);
      const userId = req.user!.userId;

      // Try current user's Google account or search for any user with valid token
      let effectiveUserId = userId;
      const userGoogle = await prisma.googleAccount.findUnique({ where: { userId } });

      if (!userGoogle) {
        // Fallback to any active teacher's Google account
        const anyAccount = await prisma.googleAccount.findFirst();
        if (anyAccount) {
          effectiveUserId = anyAccount.userId;
        } else {
          res.status(403).json({ error: 'No authorized Google account found to download file.' });
          return;
        }
      }

      const { metadata, stream } = await GoogleClassroomService.getDriveFileStream(
        effectiveUserId,
        fileId
      );

      res.setHeader('Content-Type', metadata.mimeType || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(metadata.name || 'document')}"`
      );

      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }
}
