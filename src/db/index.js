import pg from 'pg';
import config from '../config/index.js';
import logger from '../services/logger.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.db.url,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
  max: config.db.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});

export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    logger.debug({ duration: Date.now() - start, rows: result.rowCount }, 'db query');
    return result;
  } catch (err) {
    logger.error({ err, query: text }, 'db query error');
    throw err;
  }
}

export { pool };
