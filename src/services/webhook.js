import crypto from 'crypto';
import { query } from '../db/index.js';
import config from '../config/index.js';
import logger from '../services/logger.js';

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

async function getActiveWebhooks(event) {
  const { rows } = await query(
    `SELECT id, url, secret, events FROM webhooks
     WHERE is_active = TRUE
       AND (events @> ARRAY[$1]::TEXT[] OR events @> ARRAY['*']::TEXT[])`,
    [event]
  );
  return rows;
}

async function deliver(webhook, event, payload) {
  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const secret = webhook.secret || config.security.webhookSecret;
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': `AdvayLink/1.0.0`,
    ...(secret ? { 'X-AdvayLink-Signature': `sha256=${sign(body, secret)}` } : {}),
  };

  const { maxRetries, retryBaseDelayMs, timeoutMs } = config.webhook;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      await query(
        `UPDATE webhooks SET last_delivery = NOW(), last_status = $1 WHERE id = $2`,
        [res.status, webhook.id]
      );
      await query(
        `INSERT INTO webhook_delivery_log (webhook_id, event, payload, status_code, attempt, success)
         VALUES ($1,$2,$3::jsonb,$4,$5,TRUE)`,
        [webhook.id, event, body, res.status, attempt]
      );
      return;
    } catch (err) {
      await query(
        `INSERT INTO webhook_delivery_log (webhook_id, event, payload, attempt, success, error)
         VALUES ($1,$2,$3::jsonb,$4,FALSE,$5)`,
        [webhook.id, event, body, attempt, err.message]
      );
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, retryBaseDelayMs * Math.pow(2, attempt - 1)));
      }
    }
  }

  await query(`UPDATE webhooks SET last_delivery = NOW(), last_status = 0 WHERE id = $1`, [webhook.id]);
}

export async function broadcast(event, payload) {
  let hooks;
  try {
    hooks = await getActiveWebhooks(event);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch webhooks for broadcast');
    return;
  }
  if (!hooks.length) return;
  Promise.all(hooks.map(hook => deliver(hook, event, payload))).catch(
    err => logger.error({ err }, 'Unexpected broadcast error')
  );
}
