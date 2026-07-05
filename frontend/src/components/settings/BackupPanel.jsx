import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { importBackup } from '../../lib/data';
import { STANDALONE, apiGet } from '../../lib/net';
import DriveBackup from './DriveBackup';
import { DownloadIcon, UploadIcon, PrinterIcon } from '../Icons';

export default function BackupPanel() {
  const { refreshCatalog } = useApp();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('Restoring will REPLACE all current data with the contents of this backup. Continue?')) return;
    setBusy(true);
    setMsg(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await importBackup(payload);
      await refreshCatalog();
      setMsg(`Restored ✓ (${res.counts.activity_logs} day entries, ${res.counts.symptom_entries} readings).`);
    } catch (err) {
      setMsg('Import failed — please choose a valid WellNest JSON backup.');
    } finally {
      setBusy(false);
    }
  };

  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem('wellnest-last-backup'));
  const daysSince = lastBackup
    ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000)
    : null;
  const overdue = daysSince === null || daysSince >= 7;
  const markBackedUp = () => {
    const now = new Date().toISOString();
    localStorage.setItem('wellnest-last-backup', now);
    setLastBackup(now);
  };

  const Download = ({ href, children, onClick }) => (
    <a href={href} className="btn-subtle w-full justify-start" download onClick={onClick}>
      <DownloadIcon width={17} height={17} /> {children}
    </a>
  );

  // Standalone build: no server, so generate the backup file on-device. apiGet
  // is answered by the local engine (see net.js), so no direct engine import
  // is needed here — keeping sql.js out of the server build.
  const saveJsonLocal = async () => {
    markBackedUp();
    const data = await apiGet('/api/export/json');
    const text = JSON.stringify(data, null, 2);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `wellnest-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl px-3.5 py-2.5 text-xs ${
          overdue
            ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-brand-50 text-brand-700 dark:bg-slate-800/60 dark:text-brand-200'
        }`}
      >
        {lastBackup
          ? overdue
            ? `It's been ${daysSince} days since your last backup — a good time to save one. 🛟`
            : `Last backup: ${daysSince === 0 ? 'today' : `${daysSince} day(s) ago`} ✓`
          : 'No backup saved yet — saving one now is a good idea. 🛟'}
      </div>

      <div>
        <div className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Backup</div>
        <div className="space-y-2">
          {STANDALONE ? (
            <button onClick={saveJsonLocal} className="btn-subtle w-full justify-start">
              <DownloadIcon width={17} height={17} /> Save backup (JSON) — for restoring
            </button>
          ) : (
            <>
              <Download href="/api/export/json" onClick={markBackedUp}>Save backup (JSON) — for restoring</Download>
              <Download href="/api/export/csv?type=daily">Daily summary (CSV)</Download>
              <Download href="/api/export/csv?type=activities">Routine log (CSV)</Download>
              <Download href="/api/export/csv?type=symptoms">Symptom log (CSV)</Download>
            </>
          )}
        </div>
        <p className="mt-2 px-1 text-xs text-slate-400">
          {STANDALONE
            ? 'Save this file regularly and keep a copy safe (e.g. Google Drive) — it’s your backup, and it’s how you move data to/from the laptop.'
            : 'Save the JSON file about once a week. Prefer one tap? Set up Google Drive below.'}
        </p>
      </div>

      {!STANDALONE && (
        <div className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
          <DriveBackup />
        </div>
      )}

      <div>
        <div className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Restore</div>
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-subtle w-full justify-start">
          <UploadIcon width={17} height={17} /> {busy ? 'Restoring…' : 'Import a JSON backup'}
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
        {msg && <p className="mt-2 px-1 text-xs text-brand-600 dark:text-brand-300">{msg}</p>}
      </div>

      <div>
        <div className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">For appointments</div>
        <button onClick={() => navigate('/report')} className="btn-ghost w-full justify-start">
          <PrinterIcon width={17} height={17} /> Doctor report (printable)
        </button>
      </div>
    </div>
  );
}
