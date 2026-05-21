import { Router } from 'express';
import {
  publishNow,
  schedulePost,
  getScheduled,
  cancelScheduled,
  getHistory,
} from './publishingController.js';

const router = Router();

router.post('/now', publishNow);
router.post('/schedule', schedulePost);
router.get('/scheduled', getScheduled);
router.delete('/scheduled/:id', cancelScheduled);
router.get('/history', getHistory);

export default router;
