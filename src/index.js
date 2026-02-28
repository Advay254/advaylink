import app from './app.js';
import config from './config/index.js';
import logger from './services/logger.js';
import { migrate } from './db/migrate.js';
import { connect } from './whatsapp/client.js';
import { pool } from './db/index.js';

process.on('uncaughtException', (err) => { console.error('[FATAL] Uncaught exception:', err); process.exit(1); });
process.on('unhandledRejection', (reason) => { console.error('[FATAL] Unhandled rejection:', reason); process.exit(1); });

async function bootstrap() {
  logger.info({ version: config.app.version, env: config.app.env }, 'AdvayLink starting…');

  await migrate();

  connect().catch(err => logger.error({ err }, 'Initial WhatsApp connect failed — will auto-retry'));

  const server = app.listen(config.app.port, '0.0.0.0', () => {
    logger.info({ port: config.app.port }, `HTTP server listening on :${config.app.port}`);
    logger.info('Dashboard → /dashboard');
    logger.info('QR page   → /qr');
    logger.info('Health    → /health');
  });

  async function shutdown(signal) {
    logger.info({ signal }, 'Shutdown received, draining…');
    server.close(async () => {
      await pool.end();
      logger.info('Goodbye.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

bootstrap().catch(err => { console.error('[FATAL] Bootstrap failed:', err); process.exit(1); });
