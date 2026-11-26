import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { chat } from '../../controllers/student/AiController';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['STUDENT']));

router.post('/chat', chat);

export default router;
