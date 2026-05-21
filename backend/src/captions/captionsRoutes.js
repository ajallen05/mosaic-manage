import { Router } from 'express';
import { generateCaption, updateCaption } from './captionsController.js';

const router = Router();

router.post('/generate', generateCaption);
router.put('/:imageId', updateCaption);

export default router;
