import { Router } from 'express';
import axios from 'axios';
import { getSocket } from '../whatsapp/client.js';
import queue from '../whatsapp/queue.js';
import { requireApiKey } from '../middleware/auth.js';
import { sendLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validator.js';
import { query } from '../db/index.js';
import logger from '../services/logger.js';

const router = Router();

function assertConnected(res) {
  const sock = getSocket();
  if (!sock) { res.status(503).json({ error: 'Service Unavailable', message: 'WhatsApp is not connected.' }); return null; }
  return sock;
}

async function logOutbound(chatJid, type, content, waMessageId) {
  try {
    await query(`INSERT INTO message_log (direction,wa_message_id,chat_jid,type,content,status) VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
      ['outbound', waMessageId || null, chatJid, type, JSON.stringify(content), 'sent']);
  } catch (err) { logger.error({ err }, 'Failed to log outbound message'); }
}

router.post('/text', requireApiKey('write'), sendLimiter, validate('sendText'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  const { jid, text, quotedMessageId } = req.body;
  try {
    const opts = quotedMessageId ? { quoted: { key: { id: quotedMessageId, remoteJid: jid } } } : {};
    const result = await queue.push(() => sock.sendMessage(jid, { text }, opts));
    await logOutbound(jid, 'text', { text }, result?.key?.id);
    res.json({ ok: true, messageId: result?.key?.id });
  } catch (err) { logger.error({ err }, 'sendText failed'); res.status(500).json({ error: 'Failed to send message', detail: err.message }); }
});

router.post('/media', requireApiKey('write'), sendLimiter, validate('sendMedia'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  const { jid, type, url, caption, fileName, mimetype, quotedMessageId } = req.body;
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    const buffer = Buffer.from(response.data);
    const resolvedMime = mimetype || response.headers['content-type'] || 'application/octet-stream';
    const msgContent = { [type]: buffer, mimetype: resolvedMime };
    if (caption) msgContent.caption = caption;
    if (fileName) msgContent.fileName = fileName;
    const opts = quotedMessageId ? { quoted: { key: { id: quotedMessageId, remoteJid: jid } } } : {};
    const result = await queue.push(() => sock.sendMessage(jid, msgContent, opts));
    await logOutbound(jid, type, { url, caption }, result?.key?.id);
    res.json({ ok: true, messageId: result?.key?.id });
  } catch (err) { logger.error({ err }, 'sendMedia failed'); res.status(500).json({ error: 'Failed to send media', detail: err.message }); }
});

router.post('/location', requireApiKey('write'), sendLimiter, validate('sendLocation'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  const { jid, latitude, longitude, name, address } = req.body;
  try {
    const result = await queue.push(() => sock.sendMessage(jid, { location: { degreesLatitude: latitude, degreesLongitude: longitude, name, address } }));
    await logOutbound(jid, 'location', { latitude, longitude }, result?.key?.id);
    res.json({ ok: true, messageId: result?.key?.id });
  } catch (err) { logger.error({ err }, 'sendLocation failed'); res.status(500).json({ error: 'Failed to send location', detail: err.message }); }
});

router.post('/contact', requireApiKey('write'), sendLimiter, validate('sendContact'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  const { jid, displayName, vcard } = req.body;
  try {
    const result = await queue.push(() => sock.sendMessage(jid, { contacts: { displayName, contacts: [{ displayName, vcard }] } }));
    await logOutbound(jid, 'contact', { displayName }, result?.key?.id);
    res.json({ ok: true, messageId: result?.key?.id });
  } catch (err) { logger.error({ err }, 'sendContact failed'); res.status(500).json({ error: 'Failed to send contact', detail: err.message }); }
});

router.post('/reaction', requireApiKey('write'), sendLimiter, validate('sendReaction'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  const { jid, messageId, emoji } = req.body;
  try {
    await queue.push(() => sock.sendMessage(jid, { react: { text: emoji, key: { remoteJid: jid, id: messageId } } }));
    res.json({ ok: true });
  } catch (err) { logger.error({ err }, 'sendReaction failed'); res.status(500).json({ error: 'Failed to send reaction', detail: err.message }); }
});

router.post('/poll', requireApiKey('write'), sendLimiter, validate('sendPoll'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  const { jid, name, options, selectableCount } = req.body;
  try {
    const result = await queue.push(() => sock.sendMessage(jid, { poll: { name, values: options, selectableCount } }));
    await logOutbound(jid, 'poll', { name, options }, result?.key?.id);
    res.json({ ok: true, messageId: result?.key?.id });
  } catch (err) { logger.error({ err }, 'sendPoll failed'); res.status(500).json({ error: 'Failed to send poll', detail: err.message }); }
});

router.post('/delete', requireApiKey('write'), sendLimiter, validate('deleteMessage'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  const { jid, messageId, forEveryone } = req.body;
  try {
    if (forEveryone) await sock.sendMessage(jid, { delete: { remoteJid: jid, id: messageId, fromMe: true } });
    else await sock.chatModify({ clear: { messages: [{ id: messageId, fromMe: true }] } }, jid);
    res.json({ ok: true });
  } catch (err) { logger.error({ err }, 'deleteMessage failed'); res.status(500).json({ error: 'Failed to delete message', detail: err.message }); }
});

router.post('/read', requireApiKey('write'), validate('markRead'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  const { jid, messageIds } = req.body;
  try {
    await sock.readMessages(messageIds.map(id => ({ remoteJid: jid, id, fromMe: false })));
    res.json({ ok: true });
  } catch (err) { logger.error({ err }, 'markRead failed'); res.status(500).json({ error: 'Failed to mark read', detail: err.message }); }
});

router.post('/typing', requireApiKey('write'), validate('typing'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  const { jid, action } = req.body;
  try {
    await sock.sendPresenceUpdate(action, jid);
    res.json({ ok: true });
  } catch (err) { logger.error({ err }, 'typing failed'); res.status(500).json({ error: 'Failed to update typing', detail: err.message }); }
});

router.get('/log', requireApiKey('read'), async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  const offset = parseInt(req.query.offset || '0', 10);
  const jid = req.query.jid;
  try {
    const params = [limit, offset];
    const where = jid ? 'WHERE chat_jid = $3' : '';
    if (jid) params.push(jid);
    const { rows } = await query(`SELECT * FROM message_log ${where} ORDER BY timestamp DESC LIMIT $1 OFFSET $2`, params);
    res.json({ ok: true, messages: rows });
  } catch (err) { logger.error({ err }, 'message log failed'); res.status(500).json({ error: 'Failed to fetch message log' }); }
});

export default router;
