import express from 'express';
import { applySecurityMiddleware } from './middleware/security.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import logger from './services/logger.js';
import config from './config/index.js';
import router from './routes/index.js';

const app = express();

if (config.app.trustProxy) app.set('trust proxy', 1);

applySecurityMiddleware(app);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

app.use((req, _res, next) => {
  logger.debug({ method: req.method, path: req.path, ip: req.ip }, 'incoming request');
  next();
});

app.use(globalLimiter);
app.use(router);

// Global error handler
app.use((err, _req, res, _next) => {
  logger.error({ err }, 'Unhandled application error');
  const detail = config.app.env !== 'production' ? err.message : undefined;
  res.status(err.status || 500).json({ error: 'Internal Server Error', ...(detail ? { detail } : {}) });
});

export default app;
