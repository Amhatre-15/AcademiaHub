import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import multer from 'multer';
import {
  listAssignments,
  getAssignment,
  submitAssignment,
} from '../../controllers/student/AssignmentController';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

router.use(requireAuth);
router.use(requireRole(['STUDENT']));

router.get('/', listAssignments);
router.get('/:id', getAssignment);
router.post('/:id/submit', upload.single('file'), submitAssignment);

export default router;
