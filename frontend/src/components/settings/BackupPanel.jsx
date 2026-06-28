import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { importBackup } from '../../lib/data';
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

  const Download = ({ href, children }) => (
    <a href={href} className="btn-subtle w-full justify-start" download>
      <DownloadIcon width={17} height={17} /> {children}
    </a>
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Backup</div>
        <div className="space-y-2">
          <Download href="/api/export/json">Full backup (JSON) — for restoring</Download>
          <Download href="/api/export/csv?type=daily">Daily summary (CSV)</Download>
          <Download href="/api/export/csv?type=activities">Routine log (CSV)</Download>
          <Download href="/api/export/csv?type=symptoms">Symptom log (CSV)</Download>
        </div>
        <p className="mt-2 px-1 text-xs text-slate-400">
          Tip: save a JSON backup somewhere safe about once a week.
        </p>
      </div>

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
