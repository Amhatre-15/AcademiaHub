import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { upload } from '../../middleware/upload';
import {
  uploadMaterial,
  getMaterials,
  updateMaterial,
  deleteMaterial
} from '../../controllers/faculty/MaterialController';

const router = Router();

router.use(requireAuth);
router.use(requireRole('FACULTY'));

router.post('/', upload.single('file'), uploadMaterial);
router.get('/', getMaterials);
router.patch('/:id', updateMaterial);
router.delete('/:id', deleteMaterial);

export default router;
