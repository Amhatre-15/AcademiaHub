import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { ExamController } from '../../controllers/admin/ExamController';

const router = Router();

router.use(requireAuth);

// Examination Officer & IT Admin endpoints
router.post('/halls', requireRole('IT_ADMIN', 'EXAM_OFFICER'), ExamController.createHall);
router.get('/halls', requireRole('IT_ADMIN', 'EXAM_OFFICER'), ExamController.listHalls);
router.post('/seating/generate', requireRole('IT_ADMIN', 'EXAM_OFFICER'), ExamController.generateSeating);

// Digital Hall Ticket: accessible by IT_ADMIN, EXAM_OFFICER, and STUDENT
router.get('/hall-ticket/:studentId', requireRole('IT_ADMIN', 'EXAM_OFFICER', 'STUDENT'), ExamController.getStudentHallTicket);

export default router;
