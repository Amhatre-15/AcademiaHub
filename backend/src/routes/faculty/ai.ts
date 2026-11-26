import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { generateQuiz } from '../../controllers/faculty/AiController';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['FACULTY']));

router.post('/generate-quiz', generateQuiz);

export default router;
