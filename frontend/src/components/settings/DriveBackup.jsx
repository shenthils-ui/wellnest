import { useEffect, useState } from 'react';
import { getDriveStatus, saveDriveConfig, backupToDrive, setDriveAuto, disconnectDrive } from '../../lib/data';
import { prettyDate } from '../../lib/date';

export default function DriveBackup() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showSetup, setShowSetup] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const load = () => getDriveStatus().then(setStatus).catch(() => setStatus({ error: true }));
  useEffect(() => {
    load();
    const p = new URLSearchParams(window.location.search).get('drive');
    if (p === 'connected') setMsg({ ok: true, text: 'Google Drive connected ✓' });
    if (p === 'error') setMsg({ ok: false, text: 'Could not connect — check your Client ID/Secret and the redirect URI.' });
    if (p) window.history.replaceState({}, '', '/settings');
  }, []);

  const saveConfig = async () => {
    if (!clientId.trim() || !clientSecret.trim()) return;
    setBusy(true); setMsg(null);
    try {
      await saveDriveConfig(clientId.trim(), clientSecret.trim());
      setShowSetup(false);
      await load();
      setMsg({ ok: true, text: 'Saved. Now tap “Connect Google Drive” on this PC.' });
    } catch { setMsg({ ok: false, text: 'Could not save — are you on the home server?' }); }
    finally { setBusy(false); }
  };

  const backupNow = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await backupToDrive();
      await load();
      setMsg({ ok: true, text: 'Backed up to Google Drive ✓', link: r.link });
    } catch (e) {
      setMsg({ ok: false, text: 'Backup failed — try “Connect” again on the PC.' });
    } finally { setBusy(false); }
  };

  const toggleAuto = async (e) => { await setDriveAuto(e.target.checked); load(); };
  const disconnect = async () => { if (window.confirm('Disconnect Google Drive?')) { await disconnectDrive(); load(); } };

  if (!status) return <div className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
  if (status.error) {
    return <p className="text-sm text-amber-600">Google Drive backup needs your home server.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span aria-hidden>☁️</span>
        <h4 className="flex-1 font-medium text-slate-800 dark:text-slate-100">Google Drive backup</h4>
        {status.connected && <span className="text-xs text-emerald-600 dark:text-emerald-400">● Connected</span>}
      </div>

      {msg && (
        <p className={`rounded-lg px-3 py-2 text-xs ${msg.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'}`}>
          {msg.text} {msg.link && <a className="underline" href={msg.link} target="_blank" rel="noreferrer">open</a>}
        </p>
      )}

      {/* CONNECTED */}
      {status.connected ? (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Connected as <b>{status.email || 'your Google account'}</b>.
            {status.lastBackup ? <> Last Drive backup: {prettyDate(status.lastBackup.slice(0, 10))}.</> : <> No Drive backup yet.</>}
          </p>
          <button onClick={backupNow} disabled={busy} className="btn-primary w-full">
            {busy ? 'Backing up…' : '☁️ Back up to Drive now'}
          </button>
          <label className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 text-sm dark:bg-slate-900">
            <span className="text-slate-600 dark:text-slate-300">Back up automatically every week</span>
            <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={status.auto} onChange={toggleAuto} />
          </label>
          <button onClick={disconnect} className="text-xs font-medium text-rose-500">Disconnect</button>
        </>
      ) : status.configured ? (
        /* CONFIGURED, NOT CONNECTED */
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Do this once <b>on the PC</b> (Google sign-in won’t work from the phone). After that,
            the “Back up to Drive” button works from any device.
          </p>
          <a href="/api/drive/auth" className="btn-primary w-full justify-center">Connect Google Drive</a>
          <button onClick={() => setShowSetup((s) => !s)} className="text-xs text-slate-400 underline">Re-enter Client ID / Secret</button>
        </>
      ) : (
        /* NOT CONFIGURED */
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Optional: upload an encrypted-at-rest copy of your backup to your own Google Drive with one tap.
            Your data still lives on this PC — only this backup file goes to your Drive.
          </p>
          <button onClick={() => setShowSetup((s) => !s)} className="btn-subtle w-full justify-center">
            {showSetup ? 'Hide setup' : 'Set up Google Drive (one time)'}
          </button>
        </>
      )}

      {/* SETUP FORM */}
      {showSetup && (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/50">
          <p className="font-medium text-slate-600 dark:text-slate-300">One-time Google setup:</p>
          <ol className="list-decimal space-y-1 pl-4 text-slate-500 dark:text-slate-400">
            <li>Go to <a className="underline" href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">console.cloud.google.com</a> → create a project.</li>
            <li>“APIs &amp; Services” → <b>Enable</b> the <b>Google Drive API</b>.</li>
            <li>“OAuth consent screen” → External → fill the basics → add the Drive scope is not needed (we use a minimal one) → <b>Publish</b> (so it doesn’t expire weekly).</li>
            <li>“Credentials” → Create <b>OAuth client ID</b> → type <b>Web application</b>.</li>
            <li>Add this <b>Authorized redirect URI</b> exactly:
              <code className="mt-1 block break-all rounded bg-white px-2 py-1 text-[11px] dark:bg-slate-900">{status.redirectUri}</code>
            </li>
            <li>Copy the <b>Client ID</b> and <b>Client secret</b> and paste below.</li>
          </ol>
          <input className="input" placeholder="Client ID (…apps.googleusercontent.com)" value={clientId} onChange={(e) => setClientId(e.target.value)} />
          <input className="input" placeholder="Client secret" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
          <button onClick={saveConfig} disabled={busy || !clientId.trim() || !clientSecret.trim()} className="btn-primary w-full">Save</button>
        </div>
      )}
    </div>
  );
}
