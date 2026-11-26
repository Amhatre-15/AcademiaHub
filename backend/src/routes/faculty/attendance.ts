import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import {
  getSessionAttendance,
  overrideAttendance,
  getFacultySessions,
} from '../../controllers/faculty/AttendanceController';

const router = Router();

router.use(requireAuth);
router.use(requireRole('FACULTY'));

// List past sessions with summaries
router.get('/sessions', getFacultySessions);

// Get full attendance roster for a specific session
router.get('/sessions/:sessionId', getSessionAttendance);

// Override a specific student's attendance in a session
router.patch('/sessions/:sessionId/students/:studentId', overrideAttendance);

export default router;
