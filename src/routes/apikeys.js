import { Router } from 'express';
import crypto from 'crypto';
import { requireMasterKey, hashKey } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import { query } from '../db/index.js';
import logger from '../services/logger.js';

const router = Router();

function generateRawKey() {
  return `al_${crypto.randomBytes(32).toString('hex')}`;
}

router.post('/', requireMasterKey, validate('createApiKey'), async (req, res) => {
  const { label, scopes, expiresAt } = req.body;
  const raw = generateRawKey();
  const hash = hashKey(raw);
  try {
    const { rows } = await query(`INSERT INTO api_keys (key_hash,label,scopes,expires_at) VALUES ($1,$2,$3,$4) RETURNING id,label,scopes,is_active,created_at,expires_at`, [hash, label, scopes, expiresAt || null]);
    res.status(201).json({ ok: true, apiKey: raw, meta: rows[0], warning: 'Store this key securely. It will not be shown again.' });
  } catch (err) { logger.error({ err }, 'createApiKey failed'); res.status(500).json({ error: 'Failed to create API key' }); }
});

router.get('/', requireMasterKey, async (_req, res) => {
  try {
    const { rows } = await query(`SELECT id,label,scopes,is_active,last_used,created_at,expires_at FROM api_keys ORDER BY created_at DESC`);
    res.json({ ok: true, keys: rows });
  } catch (err) { logger.error({ err }, 'listApiKeys failed'); res.status(500).json({ error: 'Failed to list API keys' }); }
});

router.patch('/:id/revoke', requireMasterKey, async (req, res) => {
  try {
    const { rowCount } = await query('UPDATE api_keys SET is_active=FALSE WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'API key not found' });
    res.json({ ok: true, message: 'API key revoked' });
  } catch (err) { logger.error({ err }, 'revokeApiKey failed'); res.status(500).json({ error: 'Failed to revoke key' }); }
});

router.delete('/:id', requireMasterKey, async (req, res) => {
  try {
    const { rowCount } = await query('DELETE FROM api_keys WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'API key not found' });
    res.json({ ok: true });
  } catch (err) { logger.error({ err }, 'deleteApiKey failed'); res.status(500).json({ error: 'Failed to delete key' }); }
});

export default router;
