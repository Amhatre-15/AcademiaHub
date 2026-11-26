import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getStudentAnalytics, getLeaderboard } from '../../controllers/student/AnalyticsController';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['STUDENT']));

router.get('/', getStudentAnalytics);
router.get('/leaderboard', getLeaderboard);

export default router;
