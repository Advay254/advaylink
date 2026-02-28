import { Router } from 'express';
import healthRouter    from './health.js';
import dashboardRouter from './dashboard.js';
import qrRouter        from './qr.js';
import messagesRouter  from './messages.js';
import groupsRouter    from './groups.js';
import contactsRouter  from './contacts.js';
import statusRouter    from './status.js';
import webhooksRouter  from './webhooks.js';
import apikeysRouter   from './apikeys.js';

const router = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(qrRouter);
router.use('/messages',  messagesRouter);
router.use('/groups',    groupsRouter);
router.use('/contacts',  contactsRouter);
router.use('/status',    statusRouter);
router.use('/webhooks',  webhooksRouter);
router.use('/api-keys',  apikeysRouter);

router.use((_req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'The requested endpoint does not exist.' });
});

export default router;
