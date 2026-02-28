import crypto from 'crypto';
import { query } from '../db/index.js';
import config from '../config/index.js';
import logger from '../services/logger.js';

export function hashKey(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function requireApiKey(scope = null) {
  return async (req, res, next) => {
    const raw = req.headers['x-api-key'];
    if (!raw) return res.status(401).json({ error: 'Unauthorised', message: 'Missing X-API-Key header.' });

    if (raw === config.security.masterKey) {
      req.apiKey = { id: 'master', label: 'master', scopes: ['*'] };
      return next();
    }

    const hash = hashKey(raw);
    let rows;
    try {
      ({ rows } = await query(
        `SELECT id, label, scopes, is_active, expires_at FROM api_keys WHERE key_hash = $1`,
        [hash]
      ));
    } catch (err) {
      logger.error({ err }, 'DB error during API key lookup');
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ error: 'Unauthorised', message: 'Invalid or revoked API key.' });
    }

    const keyRecord = rows[0];
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Unauthorised', message: 'API key has expired.' });
    }

    if (scope && !keyRecord.scopes.includes(scope) && !keyRecord.scopes.includes('*')) {
      return res.status(403).json({ error: 'Forbidden', message: `Requires scope: ${scope}` });
    }

    query('UPDATE api_keys SET last_used = NOW() WHERE id = $1', [keyRecord.id]).catch(() => {});
    req.apiKey = keyRecord;
    next();
  };
}

export function requireMasterKey(req, res, next) {
  if (!req.headers['x-api-key'] || req.headers['x-api-key'] !== config.security.masterKey) {
    return res.status(401).json({ error: 'Unauthorised', message: 'Master key required.' });
  }
  next();
}
