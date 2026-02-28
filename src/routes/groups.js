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

router.post('/', requireApiKey('write'), validate('createGroup'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  try { const result = await sock.groupCreate(req.body.name, req.body.participants); res.status(201).json({ ok: true, group: result }); }
  catch (err) { logger.error({ err }, 'createGroup failed'); res.status(500).json({ error: 'Failed to create group', detail: err.message }); }
});

router.get('/', requireApiKey('read'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  try { const groups = await sock.groupFetchAllParticipating(); res.json({ ok: true, groups }); }
  catch (err) { logger.error({ err }, 'groupFetchAll failed'); res.status(500).json({ error: 'Failed to fetch groups', detail: err.message }); }
});

router.get('/:jid', requireApiKey('read'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  try { const metadata = await sock.groupMetadata(decodeURIComponent(req.params.jid)); res.json({ ok: true, group: metadata }); }
  catch (err) { logger.error({ err }, 'groupMetadata failed'); res.status(500).json({ error: 'Failed to fetch group', detail: err.message }); }
});

router.post('/participants', requireApiKey('write'), validate('groupParticipants'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  try { const result = await sock.groupParticipantsUpdate(req.body.groupJid, req.body.participants, req.body.action); res.json({ ok: true, result }); }
  catch (err) { logger.error({ err }, 'groupParticipants failed'); res.status(500).json({ error: 'Failed to update participants', detail: err.message }); }
});

router.patch('/', requireApiKey('write'), validate('updateGroup'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  const { groupJid, subject, description } = req.body;
  try {
    if (subject) await sock.groupUpdateSubject(groupJid, subject);
    if (description) await sock.groupUpdateDescription(groupJid, description);
    res.json({ ok: true });
  } catch (err) { logger.error({ err }, 'updateGroup failed'); res.status(500).json({ error: 'Failed to update group', detail: err.message }); }
});

router.delete('/:jid/leave', requireApiKey('write'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  try { await sock.groupLeave(decodeURIComponent(req.params.jid)); res.json({ ok: true }); }
  catch (err) { logger.error({ err }, 'groupLeave failed'); res.status(500).json({ error: 'Failed to leave group', detail: err.message }); }
});

router.get('/:jid/invite', requireApiKey('read'), async (req, res) => {
  const sock = assertConnected(res); if (!sock) return;
  try { const code = await sock.groupInviteCode(decodeURIComponent(req.params.jid)); res.json({ ok: true, inviteLink: `https://chat.whatsapp.com/${code}` }); }
  catch (err) { logger.error({ err }, 'groupInvite failed'); res.status(500).json({ error: 'Failed to get invite link', detail: err.message }); }
});

export default router;
