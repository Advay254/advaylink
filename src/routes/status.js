import { Router } from 'express';
import axios from 'axios';
import { getSocket } from '../whatsapp/client.js';
import queue from '../whatsapp/queue.js';
import { requireApiKey } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import logger from '../services/logger.js';

const router = Router();
const STATUS_JID = 'status@broadcast';

function assertConnected(res) {
  const sock = getSocket();
  if (!sock) { res.status(503).json({ error: 'Service Unavailable', message: 'WhatsApp is not connected.' }); return null; }
  return sock;
}

router.post('/text', requireApiKey('write'), validate('updateStatus'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  try {
    const result = await queue.push(() => sock.sendMessage(STATUS_JID, { text: req.body.status }));
    res.json({ ok: true, messageId: result?.key?.id });
  } catch (err) { logger.error({ err }, 'postTextStatus failed'); res.status(500).json({ error: 'Failed to post status', detail: err.message }); }
});

router.post('/media', requireApiKey('write'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  const { url, caption, type = 'image' } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  if (!['image', 'video'].includes(type)) return res.status(400).json({ error: 'type must be image or video' });
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    const buffer = Buffer.from(response.data);
    const mimetype = response.headers['content-type'] || (type === 'image' ? 'image/jpeg' : 'video/mp4');
    const result = await queue.push(() => sock.sendMessage(STATUS_JID, { [type]: buffer, mimetype, caption: caption || '' }));
    res.json({ ok: true, messageId: result?.key?.id });
  } catch (err) { logger.error({ err }, 'postMediaStatus failed'); res.status(500).json({ error: 'Failed to post media status', detail: err.message }); }
});

export default router;
