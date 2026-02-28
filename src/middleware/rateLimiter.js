import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

export const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.headers['x-api-key'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip,
  handler: (req, res) => res.status(429).json({
    error: 'Too Many Requests',
    message: `Max ${config.rateLimit.maxRequests} requests per ${config.rateLimit.windowMs / 1000}s.`,
  }),
});

export const sendLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
  handler: (_req, res) => res.status(429).json({
    error: 'Too Many Requests',
    message: 'Max 10 send requests per 60s.',
  }),
});
