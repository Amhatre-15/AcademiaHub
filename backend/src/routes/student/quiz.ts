import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import {
  getActiveQuiz,
  submitAnswer,
  reportViolation,
  getQuizResult,
  getQuizHistory,
} from '../../controllers/student/QuizController';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['STUDENT']));

router.get('/active', getActiveQuiz);
router.post('/submit', submitAnswer);
router.post('/violation', reportViolation);
router.get('/history', getQuizHistory);
router.get('/:quizId/result', getQuizResult);

export default router;
