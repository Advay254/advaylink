import makeWASocket, {
  DisconnectReason,
  isJidBroadcast,
  isJidGroup,
  jidNormalizedUser,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { useSupabaseAuthState } from './authState.js';
import { query } from '../db/index.js';
import config from '../config/index.js';
import logger from '../services/logger.js';
import { broadcast } from '../services/webhook.js';
import queue from './queue.js';

const state = {
  socket: null,
  qrBase64: null,
  status: 'disconnected',
  user: null,
  reconnectTimer: null,
};

export async function connect() {
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }

  state.status = 'connecting';
  logger.info('Connecting to WhatsApp…');

  let saveCreds;
  try {
    const auth = await useSupabaseAuthState();
    state.socket = makeWASocket({
      auth: auth.state,
      printQRInTerminal: false,
      logger: logger.child({ module: 'baileys' }),
      browser: ['AdvayLink', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
    });
    saveCreds = auth.saveCreds;
  } catch (err) {
    logger.error({ err }, 'Failed to initialise WhatsApp socket');
    scheduleReconnect();
    return;
  }

  const sock = state.socket;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        state.qrBase64 = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        state.status = 'qr';
        broadcast('qr', { qr: state.qrBase64 });
        logger.info('QR code ready — scan to authenticate');
      } catch (err) {
        logger.error({ err }, 'Failed to generate QR code');
      }
    }

    if (connection === 'open') {
      state.status = 'connected';
      state.qrBase64 = null;
      state.user = jidNormalizedUser(sock.user?.id || '');
      logger.info({ user: state.user }, 'WhatsApp connected');
      broadcast('connection', { status: 'connected', user: state.user });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.message || 'unknown';

      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut &&
        statusCode !== DisconnectReason.badSession;

      state.status = 'disconnected';
      state.user = null;
      state.socket = null;

      logger.warn({ statusCode, reason, shouldReconnect }, 'WhatsApp disconnected');
      broadcast('connection', { status: 'disconnected', statusCode, reason });

      if (shouldReconnect) {
        scheduleReconnect();
      } else {
        logger.error('Session invalid — clearing credentials for fresh QR');
        await query("DELETE FROM wa_auth_state WHERE id = 'creds'");
        scheduleReconnect();
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      if (isJidBroadcast(msg.key.remoteJid)) continue;
      const normalised = normaliseMessage(msg);
      try {
        await query(
          `INSERT INTO message_log
             (direction, wa_message_id, chat_jid, sender_jid, type, content, status, timestamp)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
          ['inbound', msg.key.id, msg.key.remoteJid,
           msg.key.participant || msg.key.remoteJid,
           normalised.type, JSON.stringify(normalised), 'received',
           new Date(Number(msg.messageTimestamp) * 1000)]
        );
      } catch (err) {
        logger.error({ err }, 'Failed to persist inbound message');
      }
      broadcast('message', normalised);
    }
  });

  sock.ev.on('messages.update', (updates) => {
    for (const update of updates) {
      if (update.update?.status !== undefined) {
        broadcast('message.status', {
          id: update.key.id,
          jid: update.key.remoteJid,
          status: update.update.status,
        });
      }
    }
  });

  sock.ev.on('presence.update', ({ id, presences }) => {
    broadcast('presence', { jid: id, presences });
  });

  sock.ev.on('groups.update', (updates) => {
    broadcast('group.update', { updates });
  });

  sock.ev.on('group-participants.update', ({ id, participants, action }) => {
    broadcast('group.participants', { id, participants, action });
  });

  sock.ev.on('call', (calls) => {
    broadcast('call', { calls });
  });
}

function scheduleReconnect() {
  // Exponential back-off: increases delay on repeated failures, max 60s
  const base = config.whatsapp.reconnectDelay;
  const delay = Math.min(base * (1 + Math.random()), 60000);
  logger.info({ delay: Math.round(delay) }, 'Scheduling WhatsApp reconnect…');
  state.reconnectTimer = setTimeout(connect, delay);
}

export function getSocket() { return state.socket; }

export function getState() {
  return {
    status: state.status,
    user: state.user,
    qrBase64: state.qrBase64,
    queueLength: queue.length,
  };
}

function normaliseMessage(msg) {
  const m = msg.message;
  const key = msg.key;
  const types = Object.keys(m || {});
  const type = types.find(t => t !== 'messageContextInfo') || types[0];
  const content = m?.[type];

  const base = {
    id: key.id, type,
    fromMe: key.fromMe,
    chatJid: key.remoteJid,
    senderJid: key.participant || key.remoteJid,
    isGroup: isJidGroup(key.remoteJid),
    timestamp: msg.messageTimestamp
      ? new Date(Number(msg.messageTimestamp) * 1000).toISOString() : null,
    pushName: msg.pushName || null,
    quotedMessage: null,
  };

  if (type === 'conversation') base.text = m.conversation;
  else if (type === 'extendedTextMessage') {
    base.text = content?.text;
    if (content?.contextInfo?.quotedMessage)
      base.quotedMessage = { id: content.contextInfo.stanzaId };
  }
  if (['imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage'].includes(type)) {
    base.mimetype = content?.mimetype;
    base.caption = content?.caption;
    base.fileName = content?.fileName;
  }
  if (type === 'locationMessage') {
    base.latitude = content?.degreesLatitude;
    base.longitude = content?.degreesLongitude;
    base.locationName = content?.name;
  }
  if (type === 'reactionMessage') {
    base.reactionText = content?.text;
    base.reactionTargetId = content?.key?.id;
  }
  if (type === 'pollCreationMessage') {
    base.pollName = content?.name;
    base.pollOptions = content?.options?.map(o => o.optionName);
  }
  return base;
}
