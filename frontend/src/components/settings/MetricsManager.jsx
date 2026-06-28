import { useEffect, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { apiGet } from '../../lib/net';
import { createMetric, updateMetric, deleteMetric } from '../../lib/data';
import Modal from '../Modal';
import { PlusIcon, PencilIcon } from '../Icons';

function MetricEditor({ metric, onSave, onClose, onRetire }) {
  const [name, setName] = useState(metric?.name || '');
  const [dir, setDir] = useState(metric?.good_direction || 'high');
  return (
    <Modal
      title={metric ? 'Edit symptom' : 'New symptom'}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between">
          {metric && onRetire ? <button onClick={onRetire} className="text-sm font-medium text-rose-500">Retire</button> : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-subtle">Cancel</button>
            <button onClick={() => name.trim() && onSave({ name: name.trim(), good_direction: dir })} className="btn-primary" disabled={!name.trim()}>Save</button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="section-title mb-1.5 block">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Headache" autoFocus />
        </div>
        <div>
          <label className="section-title mb-1.5 block">For this, what's better?</label>
          <div className="flex gap-2">
            {[['high', 'Higher is better'], ['low', 'Lower is better']].map(([v, l]) => (
              <button key={v} onClick={() => setDir(v)} className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${dir === v ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                {l}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">Used to colour charts (e.g. pain = lower is better).</p>
        </div>
      </div>
    </Modal>
  );
}

export default function MetricsManager() {
  const { refreshCatalog } = useApp();
  const [all, setAll] = useState([]);
  const [editing, setEditing] = useState(undefined);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    try { setAll(await apiGet('/api/metrics?includeInactive=1')); setErr(null); }
    catch { setErr('Managing symptoms needs your home server.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const after = async () => { await load(); await refreshCatalog(); };
  const onSave = async (body) => {
    try {
      if (editing) await updateMetric(editing.id, body); else await createMetric(body);
      setEditing(undefined); after();
    } catch { setErr('Could not save.'); }
  };
  const onRetire = async () => { if (editing) { await deleteMetric(editing.id); setEditing(undefined); after(); } };
  const restore = async (m) => { await updateMetric(m.id, { active: true }); after(); };

  if (err) return <p className="px-1 py-2 text-sm text-amber-600">{err}</p>;
  const active = all.filter((m) => m.active);
  const retired = all.filter((m) => !m.active);

  return (
    <div className="space-y-3">
      <button onClick={() => setEditing(null)} className="btn-ghost w-full"><PlusIcon width={18} height={18} /> Add symptom</button>
      <div className="card divide-y divide-slate-100 dark:divide-slate-800">
        {active.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-3.5 py-2.5">
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{m.name}</div>
              <div className="text-[11px] text-slate-400">{m.good_direction === 'low' ? 'lower is better' : 'higher is better'}</div>
            </div>
            <button onClick={() => setEditing(m)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"><PencilIcon width={16} height={16} /></button>
          </div>
        ))}
      </div>
      {retired.length > 0 && (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {retired.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-sm text-slate-500">{m.name}</span>
              <button onClick={() => restore(m)} className="text-sm font-medium text-brand-600 dark:text-brand-300">Restore</button>
            </div>
          ))}
        </div>
      )}
      {editing !== undefined && (
        <MetricEditor metric={editing} onSave={onSave} onClose={() => setEditing(undefined)} onRetire={editing ? onRetire : undefined} />
      )}
    </div>
  );
}
