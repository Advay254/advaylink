import { initAuthCreds } from '@whiskeysockets/baileys';
import { query } from '../db/index.js';
import logger from '../services/logger.js';

async function dbGet(id) {
  try {
    const { rows } = await query('SELECT data FROM wa_auth_state WHERE id = $1', [id]);
    return rows.length ? rows[0].data : null;
  } catch (err) {
    logger.error({ err, id }, 'auth-state get error');
    return null;
  }
}

async function dbSet(id, value) {
  await query(
    `INSERT INTO wa_auth_state (id, data, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [id, JSON.stringify(value)]
  );
}

async function dbDelete(id) {
  await query('DELETE FROM wa_auth_state WHERE id = $1', [id]);
}

export async function useSupabaseAuthState() {
  const creds = (await dbGet('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              const val = await dbGet(`key:${type}:${id}`);
              if (val != null) data[id] = val;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const [type, ids] of Object.entries(data)) {
            for (const [id, value] of Object.entries(ids)) {
              const storeKey = `key:${type}:${id}`;
              tasks.push(value ? dbSet(storeKey, value) : dbDelete(storeKey));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => dbSet('creds', creds),
  };
}
