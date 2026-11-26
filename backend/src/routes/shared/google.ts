import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { GoogleClassroomController } from '../../controllers/shared/GoogleClassroomController';

const router = Router();

// Public callback if needed directly under /api/shared/google/callback
router.get('/callback', GoogleClassroomController.handleCallback);

// All following routes require authentication
router.use(requireAuth);

// Status and OAuth URL
router.get('/status', GoogleClassroomController.getStatus);
router.get('/url', GoogleClassroomController.getAuthUrl);
router.delete('/disconnect', GoogleClassroomController.disconnect);

// Courses and Classroom content
router.get('/courses', GoogleClassroomController.listCourses);
router.get('/classroom/details', GoogleClassroomController.getCourseDetails);
router.get('/classroom/links', GoogleClassroomController.listAllLinks);
router.get('/drive/file/:fileId/download', GoogleClassroomController.proxyDriveDownload);

// Link & Unlink (Faculty and Admin)
router.post('/link', requireRole('FACULTY', 'IT_ADMIN'), GoogleClassroomController.linkCourse);
router.delete('/link/:id', requireRole('FACULTY', 'IT_ADMIN'), GoogleClassroomController.unlinkCourse);

export default router;
