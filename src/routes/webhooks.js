import { Router } from 'express';
import { requireApiKey, requireMasterKey } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import { query } from '../db/index.js';
import logger from '../services/logger.js';

const router = Router();

router.post('/', requireMasterKey, validate('createWebhook'), async (req, res) => {
  const { url, label, events, secret } = req.body;
  try {
    const { rows } = await query(`INSERT INTO webhooks (url,label,events,secret) VALUES ($1,$2,$3,$4) RETURNING id,url,label,events,is_active,created_at`, [url, label, events, secret || null]);
    res.status(201).json({ ok: true, webhook: rows[0] });
  } catch (err) { logger.error({ err }, 'createWebhook failed'); res.status(500).json({ error: 'Failed to create webhook' }); }
});

router.get('/', requireApiKey('read'), async (_req, res) => {
  try {
    const { rows } = await query(`SELECT id,url,label,events,is_active,created_at,last_delivery,last_status FROM webhooks ORDER BY created_at DESC`);
    res.json({ ok: true, webhooks: rows });
  } catch (err) { logger.error({ err }, 'listWebhooks failed'); res.status(500).json({ error: 'Failed to list webhooks' }); }
});

router.get('/:id/logs', requireApiKey('read'), async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  try {
    const { rows } = await query(`SELECT event,status_code,attempt,success,error,delivered_at FROM webhook_delivery_log WHERE webhook_id = $1 ORDER BY delivered_at DESC LIMIT $2`, [req.params.id, limit]);
    res.json({ ok: true, logs: rows });
  } catch (err) { logger.error({ err }, 'webhookLogs failed'); res.status(500).json({ error: 'Failed to fetch logs' }); }
});

router.patch('/:id', requireMasterKey, async (req, res) => {
  const { is_active, label, events, secret } = req.body;
  const updates = []; const params = []; let idx = 1;
  if (typeof is_active === 'boolean') { updates.push(`is_active=$${idx++}`); params.push(is_active); }
  if (label) { updates.push(`label=$${idx++}`); params.push(label); }
  if (events) { updates.push(`events=$${idx++}`); params.push(events); }
  if (secret !== undefined) { updates.push(`secret=$${idx++}`); params.push(secret || null); }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);
  try {
    const { rows } = await query(`UPDATE webhooks SET ${updates.join(',')} WHERE id=$${idx} RETURNING id,url,label,events,is_active`, params);
    if (!rows.length) return res.status(404).json({ error: 'Webhook not found' });
    res.json({ ok: true, webhook: rows[0] });
  } catch (err) { logger.error({ err }, 'updateWebhook failed'); res.status(500).json({ error: 'Failed to update webhook' }); }
});

router.delete('/:id', requireMasterKey, async (req, res) => {
  try {
    const { rowCount } = await query('DELETE FROM webhooks WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Webhook not found' });
    res.json({ ok: true });
  } catch (err) { logger.error({ err }, 'deleteWebhook failed'); res.status(500).json({ error: 'Failed to delete webhook' }); }
});

export default router;
