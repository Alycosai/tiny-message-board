// server.js (CommonJS)
require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Optional middlewares (won't crash if missing)
let accessLog = (_req, _res, next) => next();
try { accessLog = require('./middleware/accessLog'); } catch (_) { /* noop */ }

let requireAuth = (_req, _res, next) => next();
try { requireAuth = require('./middleware/auth'); } catch (_) { /* noop */ }

// DB (whatever your ../db exports — e.g., Prisma wrapper)
let db = null;
try { db = require('./db'); } catch (_) { /* if you don't need /api/messages, it's fine */ }

// Routes
const messagesRouter = require('./routes/messages');

const app = express();

// Trust proxy (Railway/Render/etc.) so req.ip and XFF are correct
app.set('trust proxy', 1);

// Security + basic hardening
app.use(helmet({
  contentSecurityPolicy: false, // keep simple; tighten later if you serve inline scripts/styles
}));

// Basic rate limit (tune as needed)
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Body parsers
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));

// Logging
app.use(accessLog);

// Static site (public/)
app.use(express.static(path.join(__dirname, 'public')));

// Helper(s)
function getIp(req) {
  return (req.headers['x-forwarded-for'] || req.ip || '')
    .toString()
    .split(',')[0]
    .trim();
}

// Home
app.get('/', (_req, res) => {
  res.sendFile('index.html', { root: path.join(__dirname, 'public') });
});

// Health
app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

// ---- PROTECTED: /messages router ----
// Your routes/messages.js should export an Express Router.
// Using app.use is the correct way to mount a router.
app.use('/messages', requireAuth, messagesRouter);

// ---- PUBLIC API: homepage form POST target ----
// Keep this if your front page form posts to /api/messages without auth.
app.post('/api/messages', async (req, res, next) => {
  try {
    if (!db || !db.message || !db.message.create) {
      return res.status(500).send('Database not initialized on server.');
    }

    const { author = 'Anonymous', content = '' } = req.body || {};
    if (!content.trim()) return res.status(400).send('Content is required');

    const msg = await db.message.create({
      data: {
        author: String(author).slice(0, 120),
        content: String(content).slice(0, 5000),
        sourceIp: getIp(req),
      },
    });

    // If the client accepts HTML, bounce back to the page; else return JSON
    const wantsHtml = (req.headers.accept || '').includes('text/html');
    if (wantsHtml) return res.redirect('/');
    return res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
});

// 404
app.use((req, res) => res.status(404).send('Not found'));

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).send('Server error');
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server listening on http://localhost:' + PORT);
});
console.log(`Server running → http://localhost:${PORT} (DB_FILE=${DB_FILE})`);