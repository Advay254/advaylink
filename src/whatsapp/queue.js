import config from '../config/index.js';
import logger from '../services/logger.js';

class MessageQueue {
  constructor() {
    this._queue = [];
    this._running = false;
    this._lastSentAt = 0;
  }

  push(fn) {
    return new Promise((resolve, reject) => {
      this._queue.push({ fn, resolve, reject });
      if (!this._running) this._drain();
    });
  }

  async _drain() {
    this._running = true;
    while (this._queue.length > 0) {
      const elapsed = Date.now() - this._lastSentAt;
      const cooldown = config.rateLimit.messageCooldownMs;
      if (elapsed < cooldown) await sleep(cooldown - elapsed);
      const job = this._queue.shift();
      if (!job) break;
      try {
        const result = await job.fn();
        this._lastSentAt = Date.now();
        job.resolve(result);
      } catch (err) {
        logger.error({ err }, 'Message queue job failed');
        job.reject(err);
      }
    }
    this._running = false;
  }

  get length() { return this._queue.length; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export default new MessageQueue();
