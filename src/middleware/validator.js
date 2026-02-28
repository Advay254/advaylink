import Joi from 'joi';

const jid = Joi.string().pattern(/^\d+@(s\.whatsapp\.net|g\.us)$/);

const schemas = {
  sendText: Joi.object({ jid: jid.required(), text: Joi.string().min(1).max(4096).required(), quotedMessageId: Joi.string().optional() }),
  sendMedia: Joi.object({ jid: jid.required(), type: Joi.string().valid('image','video','audio','document','sticker').required(), url: Joi.string().uri().required(), caption: Joi.string().max(1024).optional(), fileName: Joi.string().max(255).optional(), mimetype: Joi.string().optional(), quotedMessageId: Joi.string().optional() }),
  sendLocation: Joi.object({ jid: jid.required(), latitude: Joi.number().min(-90).max(90).required(), longitude: Joi.number().min(-180).max(180).required(), name: Joi.string().max(255).optional(), address: Joi.string().max(512).optional() }),
  sendContact: Joi.object({ jid: jid.required(), displayName: Joi.string().required(), vcard: Joi.string().required() }),
  sendReaction: Joi.object({ jid: jid.required(), messageId: Joi.string().required(), emoji: Joi.string().max(8).allow('').required() }),
  sendPoll: Joi.object({ jid: jid.required(), name: Joi.string().min(1).max(255).required(), options: Joi.array().items(Joi.string().max(100)).min(2).max(12).required(), selectableCount: Joi.number().integer().min(1).default(1) }),
  deleteMessage: Joi.object({ jid: jid.required(), messageId: Joi.string().required(), forEveryone: Joi.boolean().default(false) }),
  markRead: Joi.object({ jid: jid.required(), messageIds: Joi.array().items(Joi.string()).min(1).required() }),
  typing: Joi.object({ jid: jid.required(), action: Joi.string().valid('composing','paused').required() }),
  createGroup: Joi.object({ name: Joi.string().min(1).max(100).required(), participants: Joi.array().items(jid).min(1).required() }),
  groupParticipants: Joi.object({ groupJid: jid.required(), participants: Joi.array().items(jid).min(1).required(), action: Joi.string().valid('add','remove','promote','demote').required() }),
  updateGroup: Joi.object({ groupJid: jid.required(), subject: Joi.string().max(100).optional(), description: Joi.string().max(512).optional() }),
  blockContact: Joi.object({ jid: jid.required(), action: Joi.string().valid('block','unblock').required() }),
  updateStatus: Joi.object({ status: Joi.string().max(139).required() }),
  createWebhook: Joi.object({
    url: Joi.string().uri({ scheme: ['http','https'] }).required(),
    label: Joi.string().min(1).max(100).required(),
    events: Joi.array().items(Joi.string().valid('*','message','message.status','presence','connection','qr','group.update','group.participants','call')).default(['message','connection','qr']),
    secret: Joi.string().min(16).optional(),
  }),
  createApiKey: Joi.object({
    label: Joi.string().min(1).max(100).required(),
    scopes: Joi.array().items(Joi.string().valid('read','write','*')).default(['read','write']),
    expiresAt: Joi.date().greater('now').optional(),
  }),
};

export function validate(schemaName) {
  const schema = schemas[schemaName];
  if (!schema) throw new Error(`Unknown validation schema: ${schemaName}`);
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
      });
    }
    req.body = value;
    next();
  };
}
