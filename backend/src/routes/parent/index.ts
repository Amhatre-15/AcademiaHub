import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { ParentController } from '../../controllers/parent/ParentController';

const router = Router();

// All parent routes require authentication and PARENT role (or IT_ADMIN for support/audits)
router.use(requireAuth);
router.use(requireRole('PARENT', 'IT_ADMIN'));

// List all children linked to this parent
router.get('/children', ParentController.getChildren);

// Child-specific attendance record and <75% statutory warning
router.get('/children/:studentId/attendance', ParentController.getChildAttendance);

// Child-specific published grades, SGPA and transcript hash
router.get('/children/:studentId/grades', ParentController.getChildGrades);

export default router;
