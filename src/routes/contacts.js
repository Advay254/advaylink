import { Router } from 'express';
import { getSocket } from '../whatsapp/client.js';
import { requireApiKey } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import logger from '../services/logger.js';

const router = Router();

function assertConnected(res) {
  const sock = getSocket();
  if (!sock) { res.status(503).json({ error: 'Service Unavailable', message: 'WhatsApp is not connected.' }); return null; }
  return sock;
}

router.get('/check', requireApiKey('read'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  if (!req.query.phone) return res.status(400).json({ error: 'phone query param required' });
  try { const [result] = await sock.onWhatsApp(req.query.phone); res.json({ ok: true, exists: !!result?.exists, jid: result?.jid || null }); }
  catch (err) { logger.error({ err }, 'onWhatsApp failed'); res.status(500).json({ error: 'Failed to check number', detail: err.message }); }
});

router.get('/:jid/avatar', requireApiKey('read'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  try { const url = await sock.profilePictureUrl(decodeURIComponent(req.params.jid), 'image'); res.json({ ok: true, url: url || null }); }
  catch (_) { res.json({ ok: true, url: null }); }
});

router.get('/:jid/status', requireApiKey('read'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  try { const result = await sock.fetchStatus(decodeURIComponent(req.params.jid)); res.json({ ok: true, status: result?.status || null, setAt: result?.setAt || null }); }
  catch (err) { logger.error({ err }, 'fetchStatus failed'); res.status(500).json({ error: 'Failed to fetch status', detail: err.message }); }
});

router.post('/block', requireApiKey('write'), validate('blockContact'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  try { await sock.updateBlockStatus(req.body.jid, req.body.action); res.json({ ok: true }); }
  catch (err) { logger.error({ err }, 'blockContact failed'); res.status(500).json({ error: 'Failed to update block status', detail: err.message }); }
});

router.post('/:jid/presence', requireApiKey('write'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  try { await sock.presenceSubscribe(decodeURIComponent(req.params.jid)); res.json({ ok: true, message: 'Subscribed. Events arrive via webhook.' }); }
  catch (err) { logger.error({ err }, 'presenceSubscribe failed'); res.status(500).json({ error: 'Failed to subscribe to presence', detail: err.message }); }
});

export default router;
