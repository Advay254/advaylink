import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

function required(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

function optional(name, fallback = '') {
  return process.env[name] || fallback;
}

const config = {
  app: {
    name: 'AdvayLink',
    version: pkg.version,
    port: parseInt(optional('PORT', '3000'), 10),
    env: optional('NODE_ENV', 'production'),
    trustProxy: optional('TRUST_PROXY', 'true') === 'true',
  },
  db: {
    url: required('DATABASE_URL'),
    ssl: optional('DB_SSL', 'true') === 'true',
    poolMax: parseInt(optional('DB_POOL_MAX', '5'), 10),
  },
  security: {
    masterKey: required('MASTER_KEY'),
    webhookSecret: optional('WEBHOOK_SECRET', ''),
    ipWhitelist: optional('IP_WHITELIST', '')
      .split(',').map(s => s.trim()).filter(Boolean),
  },
  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '60000'), 10),
    maxRequests: parseInt(optional('RATE_LIMIT_MAX', '60'), 10),
    messageCooldownMs: parseInt(optional('MESSAGE_COOLDOWN_MS', '5000'), 10),
  },
  webhook: {
    timeoutMs: parseInt(optional('WEBHOOK_TIMEOUT_MS', '10000'), 10),
    maxRetries: parseInt(optional('WEBHOOK_MAX_RETRIES', '3'), 10),
    retryBaseDelayMs: parseInt(optional('WEBHOOK_RETRY_DELAY_MS', '2000'), 10),
  },
  whatsapp: {
    sessionName: optional('WA_SESSION_NAME', 'advaylink'),
    reconnectDelay: parseInt(optional('WA_RECONNECT_DELAY_MS', '5000'), 10),
  },
};

export default config;
