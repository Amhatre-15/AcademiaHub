import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import {
  createNotice,
  listNotices,
} from '../../controllers/shared/NoticeController';

const router = Router();

router.use(requireAuth);

router.post('/', createNotice);
router.get('/', listNotices);

export default router;
