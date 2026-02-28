import { query } from './index.js';
import logger from '../services/logger.js';

const MIGRATIONS = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS api_keys (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        key_hash    TEXT        NOT NULL UNIQUE,
        label       TEXT        NOT NULL,
        scopes      TEXT[]      NOT NULL DEFAULT ARRAY['read','write'],
        is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
        last_used   TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at  TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS wa_auth_state (
        id          TEXT        PRIMARY KEY,
        data        JSONB       NOT NULL,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS webhooks (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        url           TEXT        NOT NULL,
        label         TEXT        NOT NULL,
        events        TEXT[]      NOT NULL DEFAULT ARRAY['message','status','qr','connection'],
        secret        TEXT,
        is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_delivery TIMESTAMPTZ,
        last_status   INTEGER
      );

      CREATE TABLE IF NOT EXISTS message_log (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        direction       TEXT        NOT NULL CHECK (direction IN ('inbound','outbound')),
        wa_message_id   TEXT,
        chat_jid        TEXT        NOT NULL,
        sender_jid      TEXT,
        type            TEXT        NOT NULL,
        content         JSONB       NOT NULL DEFAULT '{}',
        status          TEXT        NOT NULL DEFAULT 'pending',
        timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS webhook_delivery_log (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        webhook_id   UUID        NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
        event        TEXT        NOT NULL,
        payload      JSONB       NOT NULL,
        status_code  INTEGER,
        attempt      INTEGER     NOT NULL DEFAULT 1,
        success      BOOLEAN     NOT NULL DEFAULT FALSE,
        error        TEXT,
        delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_message_log_chat_jid   ON message_log (chat_jid);
      CREATE INDEX IF NOT EXISTS idx_message_log_timestamp  ON message_log (timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash      ON api_keys (key_hash);
      CREATE INDEX IF NOT EXISTS idx_wdl_webhook_id         ON webhook_delivery_log (webhook_id);
    `,
  },
];

export async function migrate() {
  logger.info('Running database migrations…');

  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INTEGER PRIMARY KEY,
      name        TEXT    NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const migration of MIGRATIONS) {
    const { rows } = await query(
      'SELECT version FROM schema_migrations WHERE version = $1',
      [migration.version]
    );
    if (rows.length > 0) continue;

    logger.info({ version: migration.version, name: migration.name }, 'Applying migration');
    await query(migration.sql);
    await query(
      'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
      [migration.version, migration.name]
    );
    logger.info({ version: migration.version }, 'Migration applied');
  }

  logger.info('Database migrations complete');
}
