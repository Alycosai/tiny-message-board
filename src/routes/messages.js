const express = require('express');
const db = require('../db');

const router = express.Router();

// Helpers
function getIp(req) {
  return (req.headers['x-forwarded-for'] || req.ip || '')
    .toString()
    .split(',')[0]
    .trim();
}
function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}

// List messages + form (simple HTML UI)
router.get('/', async (req, res, next) => {
  try {
    const messages = await db.message.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const list = messages.map(m => {
      const when = new Date(m.createdAt).toLocaleString();
      const author = m.author ? `<strong>${escapeHtml(m.author)}</strong>` : '<em>Anonymous</em>';
      const content = escapeHtml(m.content);
      const ip = m.sourceIp ? ` <small style="opacity:.6">(${escapeHtml(m.sourceIp)})</small>` : '';
      return `<li style="margin-bottom:.5rem">${author}: ${content} — <small>${when}</small>${ip}</li>`;
    }).join('');

    res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Messages</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Inter,Arial,sans-serif;
         max-width:720px;margin:2rem auto;padding:0 1rem}
    form{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem}
    input,textarea,button{font:inherit;padding:.5rem;border:1px solid #ccc;border-radius:.5rem}
    textarea{flex:1;min-height:70px}
  </style>
</head>
<body>
  <h1>Messages</h1>
  <form method="POST" action="/messages">
    <input name="author" placeholder="Your name (optional)"/>
    <textarea name="content" placeholder="Write a message..." required></textarea>
    <button type="submit">Post</button>
  </form>
  <ol>${list || '<li><em>No messages yet</em></li>'}</ol>
  <p><a href="/">← Back home</a></p>
</body>
</html>`);
  } catch (e) { next(e); }
});

// Create message (works with form POST or JSON)
router.post(
  '/',
  express.urlencoded({ extended: false }),
  express.json(),
  async (req, res, next) => {
    try {
      const author = (req.body.author || '').trim() || null;
      const content = (req.body.content || '').trim();
      if (!content) return res.status(400).send('Content is required');

      const msg = await db.message.create({
        data: { author, content, sourceIp: getIp(req) }
      });

      const wantsHtml = (req.headers.accept || '').includes('text/html');
      if (wantsHtml) return res.redirect('/messages');
      return res.status(201).json(msg);
    } catch (e) { next(e); }
  }
);

module.exports = router;
