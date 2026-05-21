import { Router } from 'express';
import { generationLimiter } from '../middleware/rateLimiter.js';
import { generateImages, regenerateImage, getHistory } from './generationController.js';

const router = Router();

router.post('/images', generationLimiter, generateImages);
router.post('/regenerate', generationLimiter, regenerateImage);
router.get('/history', getHistory);

export default router;
