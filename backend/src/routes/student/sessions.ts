import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import {
  getActiveSession,
  submitAttendance
} from '../../controllers/student/SessionController';
import {
  listSessionDoubts,
  createDoubt,
  toggleUpvote,
  getWhiteboardState,
} from '../../controllers/shared/DoubtController';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['STUDENT']));

router.get('/active', getActiveSession);
router.post('/:sessionId/attendance/submit', submitAttendance);

// Phase 19: Interactive Classroom Doubts & Whiteboard
router.get('/:sessionId/doubts', listSessionDoubts);
router.post('/:sessionId/doubts', createDoubt);
router.post('/:sessionId/doubts/:doubtId/upvote', toggleUpvote);
router.get('/:sessionId/whiteboard', getWhiteboardState);

export default router;
