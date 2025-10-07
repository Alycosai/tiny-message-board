const db = require('../db');

(async () => {
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    const result = await db.accessLog.deleteMany({ where: { ts: { lt: cutoff } } });
    console.log(`Deleted ${result.count} old access logs`);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
