import { useEffect, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { apiGet } from '../../lib/net';
import { createTherapy, updateTherapy, deleteTherapy } from '../../lib/data';
import Modal from '../Modal';
import { PlusIcon, PencilIcon } from '../Icons';

const CADENCES = [
  [7, 'Weekly'],
  [14, 'Every 2 weeks'],
  [30, 'Monthly'],
];

function TherapyEditor({ therapy, onSave, onClose, onRetire }) {
  const [name, setName] = useState(therapy?.name || '');
  const [cadence, setCadence] = useState(therapy?.cadence_days || 7);
  return (
    <Modal
      title={therapy ? 'Edit therapy' : 'New therapy'}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between">
          {therapy && onRetire ? <button onClick={onRetire} className="text-sm font-medium text-rose-500">Retire</button> : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-subtle">Cancel</button>
            <button onClick={() => name.trim() && onSave({ name: name.trim(), cadence_days: cadence })} className="btn-primary" disabled={!name.trim()}>Save</button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="section-title mb-1.5 block">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acupuncture" autoFocus />
        </div>
        <div>
          <label className="section-title mb-1.5 block">How often</label>
          <div className="flex gap-2">
            {CADENCES.map(([v, l]) => (
              <button key={v} onClick={() => setCadence(v)} className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${cadence === v ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{l}</button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function TherapiesManager() {
  const { refreshCatalog } = useApp();
  const [all, setAll] = useState([]);
  const [editing, setEditing] = useState(undefined);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    try { setAll(await apiGet('/api/therapies?includeInactive=1')); setErr(null); }
    catch { setErr('Managing therapies needs your home server.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const after = async () => { await load(); await refreshCatalog(); };
  const onSave = async (body) => {
    try { if (editing) await updateTherapy(editing.id, body); else await createTherapy(body); setEditing(undefined); after(); }
    catch { setErr('Could not save.'); }
  };
  const onRetire = async () => { if (editing) { await deleteTherapy(editing.id); setEditing(undefined); after(); } };
  const restore = async (t) => { await updateTherapy(t.id, { active: true }); after(); };

  if (err) return <p className="px-1 py-2 text-sm text-amber-600">{err}</p>;
  const active = all.filter((t) => t.active);
  const retired = all.filter((t) => !t.active);
  const label = (d) => (CADENCES.find(([v]) => v === d)?.[1] || `every ${d} days`);

  return (
    <div className="space-y-3">
      <button onClick={() => setEditing(null)} className="btn-ghost w-full"><PlusIcon width={18} height={18} /> Add therapy</button>
      <div className="card divide-y divide-slate-100 dark:divide-slate-800">
        {active.map((t) => (
          <div key={t.id} className="flex items-center justify-between px-3.5 py-2.5">
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{t.name}</div>
              <div className="text-[11px] text-slate-400">{label(t.cadence_days)}</div>
            </div>
            <button onClick={() => setEditing(t)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"><PencilIcon width={16} height={16} /></button>
          </div>
        ))}
      </div>
      {retired.length > 0 && (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {retired.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-sm text-slate-500">{t.name}</span>
              <button onClick={() => restore(t)} className="text-sm font-medium text-brand-600 dark:text-brand-300">Restore</button>
            </div>
          ))}
        </div>
      )}
      {editing !== undefined && (
        <TherapyEditor therapy={editing} onSave={onSave} onClose={() => setEditing(undefined)} onRetire={editing ? onRetire : undefined} />
      )}
    </div>
  );
}
