import { Router } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireMasterKey } from '../middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

const dashboardHtml = readFileSync(join(__dirname, '../views/dashboard.html'), 'utf8');

router.get('/dashboard', requireMasterKey, (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(dashboardHtml);
});

router.get('/', (_req, res) => res.redirect('/dashboard'));

export default router;
