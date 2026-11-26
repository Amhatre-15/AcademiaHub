import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getFacultyAnalytics } from '../../controllers/faculty/AnalyticsController';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['FACULTY']));

router.get('/', getFacultyAnalytics);

export default router;
