import helmet from 'helmet';
import config from '../config/index.js';
import logger from '../services/logger.js';

export function applySecurityMiddleware(app) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
        fontSrc: ["'self'", 'fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  }));

  app.disable('x-powered-by');

  if (config.security.ipWhitelist.length > 0) {
    app.use((req, res, next) => {
      const clientIp =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket.remoteAddress;
      if (config.security.ipWhitelist.includes(clientIp)) return next();
      logger.warn({ clientIp, path: req.path }, 'IP whitelist rejection');
      return res.status(403).json({ error: 'Forbidden' });
    });
  }
}
