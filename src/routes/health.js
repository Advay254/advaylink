import { Router } from 'express';
import { getState } from '../whatsapp/client.js';
import { requireApiKey } from '../middleware/auth.js';
import config from '../config/index.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'AdvayLink', version: config.app.version, whatsapp: getState().status, timestamp: new Date().toISOString() });
});

router.get('/status', requireApiKey('read'), (_req, res) => {
  const wa = getState();
  res.json({ service: 'AdvayLink', version: config.app.version, environment: config.app.env, whatsapp: { status: wa.status, user: wa.user, queueLength: wa.queueLength }, timestamp: new Date().toISOString() });
});

export default router;
