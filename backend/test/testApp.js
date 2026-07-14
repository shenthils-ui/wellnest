// Boots a real Express app (same code as production) against a throwaway
// temp SQLite database, so tests exercise the actual routes/SQL rather than
// mocks. Call once per test file (Vitest isolates each file's module
// registry, so this stays independent across files run in parallel).
'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');

function freshApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wellnest-test-'));
  process.env.WELLNEST_DATA_DIR = dir;
  const { app } = require('../server'); // require.main !== module here, so it never listens
  return app;
}

module.exports = { freshApp };
