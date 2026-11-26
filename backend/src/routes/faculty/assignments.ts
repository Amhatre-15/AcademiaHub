import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import multer from 'multer';
import {
  createAssignment,
  listAssignments,
  getAssignment,
  gradeSubmission,
} from '../../controllers/faculty/AssignmentController';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

router.use(requireAuth);
router.use(requireRole(['FACULTY']));

router.post('/', upload.single('file'), createAssignment);
router.get('/', listAssignments);
router.get('/:id', getAssignment);
router.patch('/:id/submissions/:submissionId/grade', gradeSubmission);

export default router;
