const db = require('../db');

module.exports = function accessLog() {
  return (req, res, next) => {
    res.on('finish', async () => {
      try {
        await db.accessLog.create({
          data: {
            path: req.originalUrl || req.url,
            remoteIp: (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim(),
            userAgent: req.get('user-agent') || '',
            authUser: req.user || null,
            status: res.statusCode
          }
        });
      } catch {
        // never crash the request because logging failed
      }
    });
    next();
  };
};
