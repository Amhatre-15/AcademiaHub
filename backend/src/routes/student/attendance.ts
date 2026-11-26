import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getAttendanceSummary } from '../../controllers/student/AttendanceController';

const router = Router();

router.use(requireAuth);
router.use(requireRole('STUDENT'));

// Overall attendance summary (overall + per subject + recent sessions)
router.get('/', getAttendanceSummary);

export default router;
