# AdvayLink

**Enterprise WhatsApp API Bridge**

AdvayLink is a production-grade, self-hosted WhatsApp gateway that exposes a secure REST API for sending and receiving WhatsApp messages, managing groups, handling contacts, delivering webhook events, and more — without a browser or third-party cloud dependency.

Built on [Baileys](https://github.com/WhiskeySockets/Baileys) (the same underlying library that powers WAHA), AdvayLink runs natively on the WhatsApp WebSocket protocol with a memory footprint small enough for Render's free tier (< 80 MB RAM at idle).

---

## Key Features

- **Full messaging support** — text, media, location, contacts, polls, reactions, message deletion, read receipts, typing indicators
- **Group management** — create groups, add/remove/promote participants, update metadata, generate invite links
- **Contact utilities** — check registration, fetch profile pictures and bios, subscribe to presence, block/unblock
- **WhatsApp Status (Stories)** — post text and media status updates
- **Persistent sessions** — auth state stored in Supabase/PostgreSQL; no QR re-scan after restarts
- **Webhook delivery** — broadcast incoming events to any number of registered URLs with HMAC-SHA256 signing and exponential-backoff retry
- **API key management** — scoped keys, revocation, expiry, and a master key for administrative operations
- **Rate limiting** — 5-second minimum between sends (configurable), per-key global rate limits
- **Auto-migration** — database schema created automatically on first boot; no manual SQL
- **Minimal dashboard** — browser-based UI for QR scanning, sending test messages, managing webhooks and API keys
- **Security-first** — Helmet headers, IP whitelist (optional), input validation via Joi, no plaintext key storage, HMAC-verified webhooks

---

## Architecture

```
WhatsApp ←─────────────────────────────────────────────────────── Baileys (WS)
              │                                                        │
    inbound events                                           outbound sends
              │                                                        │
         AdvayLink (Express)
              │
     ┌────────┴────────┐
     │                 │
  Supabase          Webhooks ──► n8n / Zapier / Custom receiver
  (auth state,
   message log,
   api keys)
```

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- A [Supabase](https://supabase.com) project (free tier is sufficient)
- A WhatsApp account to link

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/your-org/advaylink.git
cd advaylink

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL and MASTER_KEY

# 4. Start the server
npm run dev

# 5. Open the dashboard and scan the QR code
open http://localhost:3000/dashboard
```

### Production Deployment (Render)

1. Push the repository to GitHub.
2. Create a new **Web Service** on [Render](https://render.com) and connect the repository.
   Render will detect `render.yaml` automatically.
3. In the Render dashboard, set the following environment variables:
   | Variable | Description |
   |---|---|
   | `DATABASE_URL` | Your Supabase PostgreSQL connection string |
   | `MASTER_KEY` | Strong random secret (Render auto-generates one if using `render.yaml`) |
4. Deploy. On first boot, AdvayLink creates all required database tables.
5. Navigate to `https://your-app.onrender.com/qr` and scan the QR code.

> **Tip:** Use [cron-job.org](https://cron-job.org) to ping `GET /health` every 14 minutes to prevent Render's free tier from spinning down the service.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | Supabase PostgreSQL connection string |
| `MASTER_KEY` | ✅ | — | Admin key for dashboard and management endpoints |
| `PORT` | | `3000` | HTTP server port (set automatically by Render) |
| `NODE_ENV` | | `production` | `production` or `development` |
| `TRUST_PROXY` | | `true` | Trust `X-Forwarded-For` (required on Render) |
| `DB_SSL` | | `true` | Enable SSL for DB connections |
| `DB_POOL_MAX` | | `5` | Max DB pool connections |
| `WEBHOOK_SECRET` | | — | Global HMAC secret for webhook signature |
| `IP_WHITELIST` | | — | Comma-separated allowed IPs (blank = allow all) |
| `RATE_LIMIT_WINDOW_MS` | | `60000` | Rate limit window in ms |
| `RATE_LIMIT_MAX` | | `60` | Max requests per window per key/IP |
| `MESSAGE_COOLDOWN_MS` | | `5000` | Minimum ms between WhatsApp sends |
| `WEBHOOK_TIMEOUT_MS` | | `10000` | Webhook delivery timeout |
| `WEBHOOK_MAX_RETRIES` | | `3` | Webhook delivery retry attempts |
| `WEBHOOK_RETRY_DELAY_MS` | | `2000` | Base delay before first retry (doubles each attempt) |
| `WA_SESSION_NAME` | | `advaylink` | Logical session identifier |
| `WA_RECONNECT_DELAY_MS` | | `5000` | Delay before reconnect attempts |

---

## API Reference

All endpoints (except `/health` and `/qr`) require an `X-API-Key` header.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Liveness check for cron-job.org |
| `GET` | `/status` | API Key | Detailed connection status |
| `GET` | `/qr` | None (HTML) / API Key (JSON) | QR code page |
| `GET` | `/dashboard` | Master Key | Management dashboard |

### Messages

| Method | Endpoint | Scope | Description |
|---|---|---|---|
| `POST` | `/messages/text` | `write` | Send a text message |
| `POST` | `/messages/media` | `write` | Send image, video, audio, document, or sticker |
| `POST` | `/messages/location` | `write` | Send a location pin |
| `POST` | `/messages/contact` | `write` | Send a contact card (vCard) |
| `POST` | `/messages/reaction` | `write` | React to a message with an emoji |
| `POST` | `/messages/poll` | `write` | Send a poll |
| `POST` | `/messages/delete` | `write` | Delete a message (for me or for everyone) |
| `POST` | `/messages/read` | `write` | Mark messages as read |
| `POST` | `/messages/typing` | `write` | Send composing / paused presence |
| `GET` | `/messages/log` | `read` | Paginated inbound/outbound message history |

### Groups

| Method | Endpoint | Scope | Description |
|---|---|---|---|
| `POST` | `/groups` | `write` | Create a group |
| `GET` | `/groups` | `read` | List all joined groups |
| `GET` | `/groups/:jid` | `read` | Fetch group metadata and members |
| `POST` | `/groups/participants` | `write` | Add, remove, promote, or demote participants |
| `PATCH` | `/groups` | `write` | Update group name or description |
| `DELETE` | `/groups/:jid/leave` | `write` | Leave a group |
| `GET` | `/groups/:jid/invite` | `read` | Get group invite link |

### Contacts

| Method | Endpoint | Scope | Description |
|---|---|---|---|
| `GET` | `/contacts/check?phone=` | `read` | Check if a number is on WhatsApp |
| `GET` | `/contacts/:jid/avatar` | `read` | Fetch profile picture URL |
| `GET` | `/contacts/:jid/status` | `read` | Fetch about / bio |
| `POST` | `/contacts/block` | `write` | Block or unblock a contact |
| `POST` | `/contacts/:jid/presence` | `write` | Subscribe to presence (online/last seen) |

### Status (Stories)

| Method | Endpoint | Scope | Description |
|---|---|---|---|
| `POST` | `/status/text` | `write` | Post a text status update |
| `POST` | `/status/media` | `write` | Post an image or video status |

### Webhooks

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/webhooks` | API Key (`read`) | List all webhooks |
| `POST` | `/webhooks` | Master Key | Register a new webhook |
| `PATCH` | `/webhooks/:id` | Master Key | Update a webhook |
| `DELETE` | `/webhooks/:id` | Master Key | Delete a webhook |
| `GET` | `/webhooks/:id/logs` | API Key (`read`) | View delivery history |

### API Keys

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api-keys` | Master Key | List all keys |
| `POST` | `/api-keys` | Master Key | Issue a new key |
| `PATCH` | `/api-keys/:id/revoke` | Master Key | Revoke a key |
| `DELETE` | `/api-keys/:id` | Master Key | Permanently delete a key |

---

## Webhook Payloads

AdvayLink signs all webhook deliveries with HMAC-SHA256. Validate the signature in your receiver:

```js
const crypto = require('crypto');

function verifySignature(body, signature, secret) {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

The signature is sent in the `X-AdvayLink-Signature` header.

### Event: `message`

```json
{
  "event": "message",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "id": "ABCDEF123456",
    "type": "extendedTextMessage",
    "fromMe": false,
    "chatJid": "1234567890@s.whatsapp.net",
    "senderJid": "1234567890@s.whatsapp.net",
    "isGroup": false,
    "timestamp": "2025-01-15T10:30:00.000Z",
    "pushName": "John Doe",
    "text": "Hello from WhatsApp",
    "quotedMessage": null
  }
}
```

### Event: `connection`

```json
{
  "event": "connection",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "data": {
    "status": "connected",
    "user": "1234567890@s.whatsapp.net"
  }
}
```

### Supported Events

| Event | Description |
|---|---|
| `message` | New inbound or outbound message |
| `message.status` | Delivery/read status update |
| `presence` | Contact online/typing status |
| `connection` | WA connection state change |
| `qr` | New QR code available (base64) |
| `group.update` | Group settings changed |
| `group.participants` | Participant added/removed/promoted |
| `call` | Incoming call event |

Register with `"events": ["*"]` to receive all events.

---

## Security

- **API keys** are stored as SHA-256 hashes. The plaintext key is shown only once at creation.
- **Master key** grants full administrative access. Treat it like a root password.
- **Webhook signatures** use HMAC-SHA256 with per-webhook or global secrets.
- **IP whitelisting** is optional and additive — set `IP_WHITELIST` to restrict access by source IP.
- **Input validation** is applied to all request bodies via Joi schemas.
- **Helmet** enforces HTTP security headers on all responses.
- **Stack traces** are suppressed in production error responses.

---

## n8n Integration

1. **Register a webhook** pointing to your n8n Webhook node URL.
2. In n8n, create a **Webhook** trigger node — use the URL generated by AdvayLink.
3. To **send messages from n8n**, use an HTTP Request node:

```
POST https://your-app.onrender.com/messages/text
Headers:
  X-API-Key: your_api_key
  Content-Type: application/json
Body:
  { "jid": "1234567890@s.whatsapp.net", "text": "Hello from n8n!" }
```

---

## Contributing

Contributions, issue reports, and feature requests are welcome. Please open an issue before submitting a pull request.

---

## License

This project is proprietary software. Unauthorised copying, modification, distribution, or use without explicit written permission is prohibited.

© 2025 AdvayLink. All rights reserved.
