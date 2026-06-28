'use strict';

// One-tap "Back up to Google Drive". Server-side OAuth so the phone never has
// to sign in to Google directly — you authorize once in the PC browser, the
// refresh token is stored locally, and after that any device can ask the server
// to upload. Uses the drive.file scope (the app only ever sees files it creates).
const express = require('express');
const { db } = require('../db');
const { dumpAll } = require('../dump');

const router = express.Router();

const PORT = parseInt(process.env.PORT, 10) || 3001;
const REDIRECT_URI = process.env.DRIVE_REDIRECT_URI || `http://localhost:${PORT}/api/drive/callback`;
const SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
const FOLDER_NAME = 'WellNest Backups';

/* ----------------------------- settings ----------------------------- */
const sGet = (k) => {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
  return r ? r.value : null;
};
const sSet = (k, v) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v == null ? null : String(v));
const sDel = (k) => db.prepare('DELETE FROM settings WHERE key = ?').run(k);

function getConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || sGet('google_client_id'),
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || sGet('google_client_secret'),
  };
}
const isConnected = () => !!sGet('drive_refresh_token');

/* ----------------------------- helpers ------------------------------ */
async function exchangeCode(code) {
  const { clientId, clientSecret } = getConfig();
  const body = new URLSearchParams({
    code, client_id: clientId, client_secret: clientSecret,
    redirect_uri: REDIRECT_URI, grant_type: 'authorization_code',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!r.ok) throw new Error('token exchange failed: ' + (await r.text()));
  return r.json();
}

async function refreshAccessToken() {
  const { clientId, clientSecret } = getConfig();
  const refresh = sGet('drive_refresh_token');
  if (!refresh || !clientId || !clientSecret) throw new Error('not connected');
  const body = new URLSearchParams({
    client_id: clientId, client_secret: clientSecret,
    refresh_token: refresh, grant_type: 'refresh_token',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!r.ok) throw new Error('refresh failed: ' + (await r.text()));
  const t = await r.json();
  sSet('drive_access_token', t.access_token);
  sSet('drive_token_expiry', Date.now() + (t.expires_in || 3600) * 1000);
  return t.access_token;
}

async function getAccessToken() {
  const tok = sGet('drive_access_token');
  const exp = Number(sGet('drive_token_expiry') || 0);
  if (tok && Date.now() < exp - 60000) return tok;
  return refreshAccessToken();
}

async function ensureFolder(token) {
  const existing = sGet('drive_folder_id');
  if (existing) return existing;
  // search app-created folders for our name
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`);
  const sr = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const sj = await sr.json();
  if (sj.files && sj.files.length) { sSet('drive_folder_id', sj.files[0].id); return sj.files[0].id; }
  const cr = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const cj = await cr.json();
  sSet('drive_folder_id', cj.id);
  return cj.id;
}

// Generic upload to the WellNest Backups folder. content may be a string or a
// Buffer (e.g. a PDF). Returns the created file's metadata.
async function uploadFileToDrive(name, mimeType, content) {
  const token = await getAccessToken();
  const folderId = await ensureFolder(token);
  const boundary = 'wellnest' + Date.now();
  const meta = { name, parents: [folderId], mimeType };
  const pre = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    'utf8'
  );
  const mid = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const post = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const body = Buffer.concat([pre, mid, post]);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,name', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!r.ok) throw new Error('upload failed: ' + (await r.text()));
  return r.json();
}

async function uploadBackup() {
  const name = `wellnest-backup-${new Date().toISOString().slice(0, 10)}-${Date.now()}.json`;
  const j = await uploadFileToDrive(name, 'application/json', JSON.stringify(dumpAll(), null, 2));
  sSet('drive_last_backup', new Date().toISOString());
  if (j.webViewLink) sSet('drive_last_file', j.webViewLink);
  return j;
}

/* ----------------------------- routes ------------------------------- */
router.get('/drive/status', (req, res) => {
  const { clientId, clientSecret } = getConfig();
  res.json({
    configured: !!(clientId && clientSecret),
    connected: isConnected(),
    email: sGet('drive_email'),
    lastBackup: sGet('drive_last_backup'),
    lastFile: sGet('drive_last_file'),
    auto: sGet('drive_auto') === '1',
    redirectUri: REDIRECT_URI,
  });
});

router.post('/drive/config', (req, res) => {
  const b = req.body || {};
  if (!b.client_id || !b.client_secret) return res.status(400).json({ error: 'client_id and client_secret required' });
  sSet('google_client_id', String(b.client_id).trim());
  sSet('google_client_secret', String(b.client_secret).trim());
  res.json({ ok: true });
});

router.get('/drive/auth', (req, res) => {
  const { clientId, clientSecret } = getConfig();
  if (!clientId || !clientSecret) return res.status(400).send('Google Drive is not configured yet. Add your Client ID & Secret in Settings first.');
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: clientId, redirect_uri: REDIRECT_URI, response_type: 'code',
    scope: SCOPE, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true',
  });
  res.redirect(url);
});

router.get('/drive/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect('/settings?drive=error');
  try {
    const t = await exchangeCode(code);
    if (t.refresh_token) sSet('drive_refresh_token', t.refresh_token);
    sSet('drive_access_token', t.access_token);
    sSet('drive_token_expiry', Date.now() + (t.expires_in || 3600) * 1000);
    // who did we connect as?
    try {
      const ur = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${t.access_token}` } });
      const uj = await ur.json();
      if (uj.email) sSet('drive_email', uj.email);
    } catch (_) { /* non-fatal */ }
    res.redirect('/settings?drive=connected');
  } catch (e) {
    console.error('Drive connect error:', e.message);
    res.redirect('/settings?drive=error');
  }
});

router.post('/drive/backup', async (req, res) => {
  if (!isConnected()) return res.status(400).json({ error: 'not connected' });
  try {
    const j = await uploadBackup();
    res.json({ ok: true, name: j.name, link: j.webViewLink, lastBackup: sGet('drive_last_backup') });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.post('/drive/auto', (req, res) => {
  sSet('drive_auto', req.body && req.body.enabled ? '1' : '0');
  res.json({ ok: true, auto: sGet('drive_auto') === '1' });
});

router.post('/drive/disconnect', (req, res) => {
  ['drive_refresh_token', 'drive_access_token', 'drive_token_expiry', 'drive_email', 'drive_folder_id', 'drive_last_file', 'drive_last_backup', 'drive_auto'].forEach(sDel);
  res.json({ ok: true });
});

// Optional weekly auto-backup. Checks periodically; uploads if connected, the
// auto toggle is on, and it's been over 7 days since the last Drive backup.
function startAutoBackup() {
  const check = async () => {
    try {
      if (sGet('drive_auto') !== '1' || !isConnected()) return;
      const last = sGet('drive_last_backup');
      const days = last ? (Date.now() - new Date(last).getTime()) / 86400000 : Infinity;
      if (days >= 7) { await uploadBackup(); console.log('WellNest: weekly Drive backup uploaded.'); }
    } catch (e) { /* try again next interval */ }
  };
  setTimeout(check, 60 * 1000); // shortly after boot
  setInterval(check, 6 * 60 * 60 * 1000); // every 6h
}

module.exports = router;
module.exports.startAutoBackup = startAutoBackup;
module.exports.uploadFileToDrive = uploadFileToDrive;
module.exports.isDriveConnected = isConnected;
