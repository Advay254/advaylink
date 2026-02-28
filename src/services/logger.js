import pino from 'pino';
import config from '../config/index.js';

const logger = pino({
  level: config.app.env === 'production' ? 'info' : 'debug',
  transport: config.app.env !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  base: { service: 'advaylink' },
  redact: {
    paths: ['req.headers.authorization', 'req.headers["x-api-key"]'],
    censor: '[REDACTED]',
  },
});

export default logger;
