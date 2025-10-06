// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.set('trust proxy', 1);

// --- CORS & preflight (harmless; helps in edge cases)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Parse JSON bodies
app.use(express.json());

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Ensure "/" serves index.html
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- Storage config
const DB_FILE = (process.env.DB_FILE || path.join(__dirname, 'messages.ndjson')).trim();
const DB_DIR = path.dirname(DB_FILE);

// Ensure directory exists
try {
  fs.mkdirSync(DB_DIR, { recursive: true });
} catch (e) {
  console.error('mkdir error:', e.code || e.message, 'for', DB_DIR);
}

// Tiny debug to verify env is loaded & path chosen (remove later)
app.get('/_debug_storage', (_req, res) => {
  res.json({ DB_FILE, DB_DIR, hasEnv: Boolean(process.env.DB_FILE) });
});

// --- Basic Auth (keep yours if already added)
function requireAuth(req, res, next) {
  const expectedUser = (process.env.ADMIN_USER || '').trim();
  const expectedPass = (process.env.ADMIN_PASS || '').trim();

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Auth required');
  }
  const encoded = auth.slice('Basic '.length).trim();
  let decoded = '';
  try { decoded = Buffer.from(encoded, 'base64').toString('utf8'); } catch {}
  const idx = decoded.indexOf(':');
  const user = idx >= 0 ? decoded.slice(0, idx) : '';
  const pass = idx >= 0 ? decoded.slice(idx + 1) : '';
  if (user === expectedUser && pass === expectedPass) return next();
  console.log('Auth failed for user:', user);
  res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
  return res.status(401).send('Auth required');
}

// --- POST: save message (HARDENED)
app.post('/messages', (req, res) => {
  try {
    const text = (req.body && req.body.text || '').toString().trim();
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const ip = (req.headers['x-forwarded-for']?.split(',')[0]?.trim())
            || req.socket.remoteAddress || null;
    const ua = req.headers['user-agent'] || null;

    const entry = { text, time: new Date().toISOString(), ip, ua };

    fs.appendFile(DB_FILE, JSON.stringify(entry) + '\n', (err) => {
      if (err) {
        console.error('Write error:', err.code || err.message, 'DB_FILE=', DB_FILE);
        return res.status(500).json({ error: 'Could not save (server write error)' });
      }
      return res.json({ ok: true });
    });
  } catch (e) {
    console.error('POST /messages exception:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// --- PUBLIC read (no IP/UA)
app.get('/messages-public', (req, res) => {
  fs.readFile(DB_FILE, 'utf8', (err, data) => {
    if (err && err.code !== 'ENOENT') {
      console.error('Read error:', err.code || err.message, 'DB_FILE=', DB_FILE);
      return res.status(500).json({ error: 'Read error' });
    }
    const lines = (data || '').trim().split('\n').filter(Boolean);
    const last = lines.slice(-50).map(line => {
      try {
        const obj = JSON.parse(line);
        return { time: obj.time, text: obj.text };
      } catch { return null; }
    }).filter(Boolean).reverse();
    res.json(last);
  });
});

// --- ADMIN read (full), protected
app.get('/messages', requireAuth, (req, res) => {
  fs.readFile(DB_FILE, 'utf8', (err, data) => {
    if (err && err.code !== 'ENOENT') {
      console.error('Read error:', err.code || err.message, 'DB_FILE=', DB_FILE);
      return res.status(500).json({ error: 'Read error' });
    }
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
  console.log(`Server running → http://localhost:${PORT} (DB_FILE=${DB_FILE})`);
});