require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const accessLog = require('./middleware/accessLog');
const requireAuth = require('./middleware/auth');
const messagesRouter = require('./routes/messages');

const app = express();

// If you're behind a proxy (Railway), trust it so req.ip is correct
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// Gentle global rate limit: 100 requests / 15 minutes per IP
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Log every request to DB (non-blocking)
app.use(accessLog());

// Serve your static site from /public at the root ("/")
app.use(express.static('public'));

// Home route fallback (optional if you have public/index.html)
app.get('/', (req, res) => {
  // If public/index.html exists, express.static will serve it automatically.
  res.sendFile('index.html', { root: 'public' });
});

app.get('/health', (req, res) => res.status(200).send('ok'));

app.get('/dbcheck', async (req, res, next) => {
  try {
    // Prisma example:
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).send('db ok');
  } catch (err) {
    console.error('DB check failed:', err);
    next(err); // will hit error handler below
  }
});

// Protect ONLY the /messages section
app.use('/messages', requireAuth, messagesRouter);

// 404
app.use((req, res) => res.status(404).send('Not found'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Server error');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server listening on http://localhost:' + PORT);
});
