import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import {
  startSession,
  getActiveSession,
  endSession,
  generateAttendanceCode,
  overrideAttendance
} from '../../controllers/faculty/SessionController';
import {
  listSessionDoubts,
  updateDoubtStatus,
  saveWhiteboardState,
  getWhiteboardState,
} from '../../controllers/shared/DoubtController';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['FACULTY']));

router.get('/active', getActiveSession);
router.post('/start', startSession);
router.post('/:id/end', endSession);
router.post('/:sessionId/attendance/generate', generateAttendanceCode);
router.post('/:sessionId/attendance/override', overrideAttendance);

// Phase 19: Interactive Classroom Doubts & Whiteboard
router.get('/:sessionId/doubts', listSessionDoubts);
router.patch('/:sessionId/doubts/:doubtId', updateDoubtStatus);
router.get('/:sessionId/whiteboard', getWhiteboardState);
router.post('/:sessionId/whiteboard', saveWhiteboardState);

export default router;
