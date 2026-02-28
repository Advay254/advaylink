import { Router } from 'express';
import { getState } from '../whatsapp/client.js';

const router = Router();

router.get('/qr/state', (req, res) => {
  const { status, qrBase64 } = getState();
  res.json({ status, qr: status === 'qr' ? qrBase64 : null });
});

router.get('/qr', (req, res) => {
  const { status, qrBase64 } = getState();

  if (req.headers.accept?.includes('application/json')) {
    return res.json({ ok: true, status, qr: status === 'qr' ? qrBase64 : null });
  }

  if (status === 'connected') return res.redirect('/dashboard');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>AdvayLink — Scan QR</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;600&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    :root{--bg:#0a0a0f;--surface:#111118;--border:#1e1e2e;--accent:#00e5a0;--adim:rgba(0,229,160,0.12);--text:#e8e8f0;--muted:#6b6b80}
    body{background:var(--bg);color:var(--text);font-family:'IBM Plex Sans',sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem}
    .brand{font-family:'IBM Plex Mono',monospace;font-size:.75rem;font-weight:600;letter-spacing:.25em;text-transform:uppercase;color:var(--accent);margin-bottom:2.5rem}
    .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:2.5rem;max-width:380px;width:100%;text-align:center}
    h1{font-size:1.25rem;font-weight:600;margin-bottom:.5rem}
    .sub{font-size:.875rem;color:var(--muted);margin-bottom:2rem;line-height:1.6}
    #qrWrap{width:240px;height:240px;margin:0 auto}
    #qrImg{width:240px;height:240px;border-radius:12px;border:2px solid var(--border);display:none}
    #placeholder{width:240px;height:240px;border-radius:12px;border:2px dashed var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;color:var(--muted);font-size:.8rem}
    .spinner{width:32px;height:32px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:100px;font-family:'IBM Plex Mono',monospace;font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;margin-top:1.5rem;background:var(--adim);color:var(--accent);border:1px solid rgba(0,229,160,.2)}
    .dot{width:6px;height:6px;border-radius:50%;background:currentColor;animation:pulse 1.5s ease-in-out infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
    .hint{font-size:.72rem;color:var(--muted);margin-top:1rem;font-family:'IBM Plex Mono',monospace}
  </style>
</head>
<body>
  <div class="brand">AdvayLink</div>
  <div class="card">
    <h1>Authenticate WhatsApp</h1>
    <p class="sub">Open WhatsApp → Settings → Linked Devices → Link a Device, then scan below.</p>
    <div id="qrWrap">
      <div id="placeholder"><div class="spinner"></div><span id="ptext">Waiting for QR…</span></div>
      <img id="qrImg" alt="QR Code"/>
    </div>
    <div class="badge"><span class="dot"></span><span id="statusLabel">Connecting…</span></div>
    <p class="hint" id="hint">Checking every 3 seconds…</p>
  </div>
  <script>
    const img=document.getElementById('qrImg'),ph=document.getElementById('placeholder'),lbl=document.getElementById('statusLabel'),hint=document.getElementById('hint'),pt=document.getElementById('ptext');
    let attempts=0;
    async function poll(){
      try{
        const data=await fetch('/qr/state').then(r=>r.json());
        attempts++;
        if(data.status==='connected'){lbl.textContent='Connected! Redirecting…';return window.location.href='/dashboard';}
        lbl.textContent={qr:'QR Ready — Scan now!',connecting:'Connecting to WhatsApp…',disconnected:'Disconnected — retrying…'}[data.status]||data.status;
        if(data.qr){img.src=data.qr;img.style.display='block';ph.style.display='none';hint.textContent='QR expires in ~60s — scan quickly!';}
        else{img.style.display='none';ph.style.display='flex';pt.textContent=attempts>5?'Still waiting… WhatsApp is slow to respond':'Waiting for QR…';hint.textContent='Checking every 3 seconds…';}
      }catch(_){lbl.textContent='Network error — retrying…';}
      setTimeout(poll,3000);
    }
    poll();
  </script>
</body>
</html>`);
});

export default router;
