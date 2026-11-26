import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getMaterials, getMaterialDownloadUrl } from '../../controllers/student/MaterialController';

const router = Router();

router.use(requireAuth);
router.use(requireRole('STUDENT'));

router.get('/', getMaterials);
router.get('/:id/download', getMaterialDownloadUrl);

export default router;
