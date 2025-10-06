// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// Basic Auth (very simple lock)
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme === "Basic" && encoded) {
    const [user, pass] = Buffer.from(encoded, "base64").toString().split(":");
    if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS) {
      return next(); // let them through
    }
  }
  res.set("WWW-Authenticate", 'Basic realm="Admin Area"');
  return res.status(401).send("Auth required");
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});
