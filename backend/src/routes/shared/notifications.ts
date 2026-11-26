import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import {
  getNotifications,
  markAsRead,
} from '../../controllers/shared/NotificationController';

const router = Router();

router.use(requireAuth);

router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);

export default router;
