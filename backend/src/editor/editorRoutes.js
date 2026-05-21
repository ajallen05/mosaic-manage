import { Router } from 'express';
import { generationLimiter } from '../middleware/rateLimiter.js';
import { promptEdit, saveCanvas } from './editorController.js';

const router = Router();

router.post('/prompt-edit', generationLimiter, promptEdit);
router.post('/save', saveCanvas);

export default router;
