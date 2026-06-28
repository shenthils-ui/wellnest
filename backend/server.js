'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const cors = require('cors');
const compression = require('compression');

const { db, migrate, DB_PATH } = require('./db');
const { seed } = require('./seed');
const { todayStr } = require('./helpers');

const catalogRoutes = require('./routes/catalog');
const trackerRoutes = require('./routes/trackers');
const dayRoutes = require('./routes/day');
const insightRoutes = require('./routes/insights');
const backupRoutes = require('./routes/backup');

const PORT = parseInt(process.env.PORT, 10) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// First-run setup: create tables, seed starter routine if the DB is empty.
migrate();
seed({ silent: true });

const app = express();
app.use(compression());
app.use(cors()); // same-origin in prod; needed for the Vite dev server's proxy fallback
app.use(express.json({ limit: '25mb' })); // large limit so full JSON imports fit

// Tiny, fast endpoint the phone uses to detect that the home server is reachable.
app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'WellNest', today: todayStr(), time: new Date().toISOString() });
});

app.get('/api/stats', (req, res) => {
  res.json({
    activities: db.prepare('SELECT COUNT(*) c FROM activities').get().c,
    metrics: db.prepare('SELECT COUNT(*) c FROM metrics').get().c,
    therapies: db.prepare('SELECT COUNT(*) c FROM therapies').get().c,
    activity_logs: db.prepare('SELECT COUNT(*) c FROM activity_logs').get().c,
    symptom_entries: db.prepare('SELECT COUNT(*) c FROM symptom_entries').get().c,
    dbPath: DB_PATH,
  });
});

app.use('/api', catalogRoutes);
app.use('/api', trackerRoutes);
app.use('/api', dayRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api', backupRoutes);

// 404 for unknown API routes (so SPA fallback never swallows API typos).
app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API endpoint' }));

// In production, serve the built PWA from a single origin (best for offline +
// "install to home screen"). In dev, the Vite server hosts the frontend instead.
const DIST_DIR = path.join(__dirname, '..', 'frontend', 'dist');
const hasBuild = fs.existsSync(path.join(DIST_DIR, 'index.html'));
if (hasBuild) {
  app.use(
    express.static(DIST_DIR, {
      setHeaders(res, filePath) {
        // Never cache the service worker or HTML shell; hashed assets are immutable.
        if (filePath.endsWith('sw.js') || filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );
  // SPA fallback for client-side routes (everything that isn't a real file / API).
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

function lanAddresses() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}

const server = app.listen(PORT, HOST, () => {
  const ips = lanAddresses();
  const bar = '─'.repeat(54);
  console.log('\n' + bar);
  console.log('  🌿  WellNest is running');
  console.log(bar);
  console.log(`  Mode:        ${hasBuild ? 'production (serving built PWA)' : 'API only (run the Vite dev server for the UI)'}`);
  console.log(`  On this PC:  http://localhost:${PORT}`);
  if (ips.length) {
    console.log('  On the phone (same Wi-Fi):');
    ips.forEach((ip) => console.log(`               http://${ip}:${PORT}`));
  } else {
    console.log('  On the phone: run `ipconfig` to find this PC\'s IPv4 address.');
  }
  console.log(`  Database:    ${DB_PATH}`);
  console.log(bar + '\n');
});

// Flush WAL on shutdown so the .db file is always clean & portable.
function shutdown() {
  try { db.pragma('wal_checkpoint(TRUNCATE)'); db.close(); } catch (_) { /* ignore */ }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
