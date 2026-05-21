import { Router } from 'express';
import {
  getConnections,
  instagramAuth,
  instagramCallback,
  disconnectInstagram,
  linkedinAuth,
  linkedinCallback,
  disconnectLinkedin,
} from './socialController.js';

const router = Router();

router.get('/connections', getConnections);
router.get('/instagram/auth', instagramAuth);
router.get('/instagram/callback', instagramCallback);
router.delete('/instagram', disconnectInstagram);
router.get('/linkedin/auth', linkedinAuth);
router.get('/linkedin/callback', linkedinCallback);
router.delete('/linkedin', disconnectLinkedin);

export default router;
