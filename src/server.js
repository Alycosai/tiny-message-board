// server.js (CommonJS)

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');

const accessLog = require('./middleware/accessLog');
const requireAuth = require('./middleware/auth'); // <- uses your auth.js

const prisma = new PrismaClient();
const app = express();

// Behind Railway proxy so req.ip / XFF are correct
app.set('trust proxy', 1);

// Security + rate limit
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Parse form submissions
app.use(express.urlencoded({ extended: false }));

// Optional: JSON parsing if you later add JSON APIs
// app.use(express.json());

// Log every request (your existing middleware)
app.use(accessLog());

// Serve /public at root
app.use(express.static('public'));

// Explicit home (express.static would also handle this if public/index.html exists)
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

// Health check
app.get('/health', (_req, res) => res.status(200).send('ok'));

// DB check
app.get('/dbcheck', async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).send('db ok');
  } catch (err) {
    console.error('DB check failed:', err);
    next(err);
  }
});

// ---- PUBLIC: create a message ----
app.post('/api/messages', async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    const content = (req.body.message || '').trim();
    if (!name || !content) return res.status(400).send('Name and message are required.');

    // Real client IP from X-Forwarded-For (Railway) fallback to req.ip
    const fwd = req.headers['x-forwarded-for'];
    const clientIp =
      (Array.isArray(fwd) ? fwd[0] : (fwd || '')).split(',')[0].trim() ||
      req.ip ||
      'unknown';

    await prisma.message.create({
      data: { name, content, sourceIp: clientIp },
    });

    return res.redirect('/?ok=1');
  } catch (e) {
    next(e);
  }
});

// ---- PROTECTED: messages log ----
app.get('/messages', requireAuth, async (_req, res, next) => {
  try {
    const messages = await prisma.message.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const rows = messages
      .map(
        (m) => `
        <tr>
          <td>${new Date(m.createdAt).toLocaleString()}</td>
          <td>${escapeHtml(m.name)}</td>
          <td>${escapeHtml(m.content)}</td>
          <td>${escapeHtml(m.sourceIp)}</td>
        </tr>`
      )
      .join('');

    res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Messages (protected)</title>
  <style>
    :root { color-scheme: dark; }
    body { font-family: system-ui, sans-serif; padding:24px; background:#0b0b0c; color:#eaeaea; }
    .wrap { max-width:1100px; margin:0 auto; }
    table { width:100%; border-collapse:collapse; }
    th, td { padding:10px; border-bottom:1px solid #2a2a2a; text-align:left; vertical-align:top; }
    th { position:sticky; top:0; background:#131316; }
    a { color:#9ad; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Messages</h1>
    <p><a href="/">← Back to form</a></p>
    <table>
      <thead><tr><th>Time</th><th>Name</th><th>Message</th><th>IP</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4">No messages yet.</td></tr>`}</tbody>
    </table>
  </div>
</body>
</html>`);
  } catch (e) {
    next(e);
  }
});

// Simple HTML escaping
function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// 404
app.use((req, res) => res.status(404).send('Not found'));

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).send('Server error');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server listening on http://localhost:' + PORT);
});
// --- END server.js ---