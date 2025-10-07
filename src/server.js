// server.js (CommonJS, ESM-interop safe)
require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ---- helper to unwrap ESM default ----
const _def = (m) => (m && (m.default || m));

const app = express();

// trust proxy (Railway/Render)
app.set('trust proxy', 1);

// security
app.use(helmet({ contentSecurityPolicy: false }));

// rate limit
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
}));

// parsers
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));

// optional middlewares (unwrap .default if ESM)
let accessLog = (_req, _res, next) => next();
try {
  accessLog = _def(require('./middleware/accessLog'));
} catch (_) {}
app.use(accessLog);

let requireAuth = (_req, _res, next) => next();
try {
  requireAuth = _def(require('./middleware/auth'));
} catch (_) {}

// static
app.use(express.static(path.join(__dirname, 'public')));

// home
app.get('/', (_req, res) => {
  res.sendFile('index.html', { root: path.join(__dirname, 'public') });
});

// health
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

// ---- routes/messages (unwrap .default if ESM) ----
// NOTE: if your file is at ./messages.js instead of ./routes/messages.js,
// change the path below accordingly.
const messagesRouter = _def(require('./routes/messages'));

// sanity checks (helpful error if exports are wrong)
if (typeof requireAuth !== 'function') {
  throw new TypeError(
    "Auth middleware must export a function. " +
    "If you're using ESM (`export default`), keep this CJS server and ensure `module.exports = fn` in ./middleware/auth.js, " +
    "or access default export via require('./middleware/auth').default."
  );
}
const isRouter =
  typeof messagesRouter === 'function' ||
  (messagesRouter && typeof messagesRouter.handle === 'function' && typeof messagesRouter.use === 'function');

if (!isRouter) {
  throw new TypeError(
    "Messages router must export an Express Router/function. " +
    "If you're using ESM (`export default router`), keep this CJS server and ensure `module.exports = router` in routes/messages.js, " +
    "or access default export via require('./routes/messages').default."
  );
}

// mount (protected)
app.use('/messages', requireAuth, messagesRouter);

// --- optional: public API endpoint if your homepage posts here ---
// Comment out if you don't use it.
let db = null;
try { db = _def(require('./db')); } catch (_) {}
function getIp(req) {
  return (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
}
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
    const wantsHtml = (req.headers.accept || '').includes('text/html');
    if (wantsHtml) return res.redirect('/');
    res.status(201).json(msg);
  } catch (e) { next(e); }
});

// 404
app.use((req, res) => res.status(404).send('Not found'));

// error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).send('Server error');
});

// start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server listening on http://localhost:' + PORT);
});
  