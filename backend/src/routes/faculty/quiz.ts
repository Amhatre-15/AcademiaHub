import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import {
  listQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  startQuiz,
  launchQuestion,
  endQuiz,
  getQuizResults,
} from '../../controllers/faculty/QuizController';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['FACULTY']));

// Quiz CRUD
router.get('/', listQuizzes);
router.post('/', createQuiz);
router.get('/:id', getQuiz);
router.patch('/:id', updateQuiz);
router.delete('/:id', deleteQuiz);

// Questions
router.post('/:id/questions', addQuestion);
router.patch('/:id/questions/:questionId', updateQuestion);
router.delete('/:id/questions/:questionId', deleteQuestion);

// Live control
router.post('/:id/start', startQuiz);
router.post('/:id/launch-question', launchQuestion);
router.post('/:id/end', endQuiz);
router.get('/:id/results', getQuizResults);

export default router;
