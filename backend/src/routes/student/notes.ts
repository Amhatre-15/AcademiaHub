import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import {
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  getNotesContext,
} from '../../controllers/student/NotesController';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['STUDENT']));

router.get('/context', getNotesContext); // before /:id to avoid conflict
router.get('/', listNotes);
router.post('/', createNote);
router.get('/:id', getNote);
router.patch('/:id', updateNote);
router.delete('/:id', deleteNote);

export default router;
