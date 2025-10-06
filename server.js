// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// Basic Auth (robust)
function requireAuth(req, res, next) {
  const expectedUser = (process.env.ADMIN_USER || '').trim();
  const expectedPass = (process.env.ADMIN_PASS || '').trim();

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Auth required');
  }

  const encoded = auth.slice('Basic '.length).trim();
  let decoded;
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Bad credentials');
  }

  // Split on the FIRST colon only (passwords can contain colons)
  const idx = decoded.indexOf(':');
  const user = idx >= 0 ? decoded.slice(0, idx) : '';
  const pass = idx >= 0 ? decoded.slice(idx + 1) : '';

  if (user === expectedUser && pass === expectedPass) {
    return next();
  }

  // (Optional) log the username tried to Railway logs for debugging
  console.log('Auth failed for user:', user);

  res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
  return res.status(401).send('Auth required');
}


// Parse JSON bodies
app.use(express.json());

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Use a file for storage (set by env in production)
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'messages.ndjson');

// Receive a message
app.post('/messages', (req, res) => {
  const text = (req.body && req.body.text || '').toString().trim();
  if (!text) return res.status(400).json({ error: 'Text is required' });

  const entry = {
    text,
    time: new Date().toISOString(),
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || null,
    ua: req.headers['user-agent'] || null
  };

  fs.appendFile(DB_FILE, JSON.stringify(entry) + '\n', (err) => {
    if (err) return res.status(500).json({ error: 'Could not save' });
    res.json({ ok: true });
  });
});

// Read recent messages
app.get('/messages', requireAuth, (req, res) => {
  fs.readFile(DB_FILE, 'utf8', (err, data) => {
    if (err && err.code !== 'ENOENT') return res.status(500).json({ error: 'Read error' });
    const lines = (data || '').trim().split('\n').filter(Boolean);
    const last = lines.slice(-50).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean).reverse();
    res.json(last);
  });
});

// Debug note
app.get('/_debug_auth', (_req, res) => {
  res.json({
    hasUser: Boolean((process.env.ADMIN_USER || '').trim()),
    hasPass: Boolean((process.env.ADMIN_PASS || '').trim())
  });
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});
