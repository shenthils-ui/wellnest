import { useEffect, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { apiGet } from '../../lib/net';
import {
  createTracker, updateTracker, deleteTracker, reorderTrackers,
  addTrackerOption, deleteTrackerOption,
} from '../../lib/data';
import Modal from '../Modal';
import { PlusIcon, PencilIcon, XIcon, ChevronLeft, ChevronRight } from '../Icons';

const SECTIONS = [
  { key: 'food', label: 'Food & meals' },
  { key: 'feeling', label: 'How you feel' },
];

function TrackerEditor({ tracker, onSave, onClose, onRetire }) {
  const isNew = !tracker;
  const [name, setName] = useState(tracker?.name || '');
  const [section, setSection] = useState(tracker?.section || 'food');
  const [kind, setKind] = useState(tracker?.kind || 'multi');
  const [intensity, setIntensity] = useState(!!tracker?.has_intensity);
  const [icon, setIcon] = useState(tracker?.icon || '');
  const [hint, setHint] = useState(tracker?.hint || '');

  const save = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(), section, kind,
      has_intensity: kind === 'multi' ? intensity : false,
      icon: icon.trim() || null, hint: hint.trim() || null,
    });
  };

  return (
    <Modal
      title={isNew ? 'New tracker' : 'Edit tracker'}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          {!isNew && onRetire ? (
            <button onClick={onRetire} className="text-sm font-medium text-rose-500">Retire</button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-subtle">Cancel</button>
            <button onClick={save} className="btn-primary" disabled={!name.trim()}>Save</button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="section-title mb-1.5 block">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Smoothie ingredients" autoFocus />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="section-title mb-1.5 block">Shows under</label>
            <select className="input" value={section} onChange={(e) => setSection(e.target.value)}>
              {SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="section-title mb-1.5 block">Choice</label>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="multi">Tap several</option>
              <option value="single">Pick one</option>
            </select>
          </div>
        </div>
        {kind === 'multi' && (
          <label className="flex items-center justify-between rounded-xl bg-white px-3.5 py-3 dark:bg-slate-900">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Strength levels <span className="text-xs font-normal text-slate-400">(light / medium / strong — good for pain)</span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={intensity} onChange={(e) => setIntensity(e.target.checked)} />
          </label>
        )}
        <div className="flex gap-3">
          <div className="w-24">
            <label className="section-title mb-1.5 block">Icon</label>
            <input className="input text-center" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🥗" maxLength={2} />
          </div>
          <div className="flex-1">
            <label className="section-title mb-1.5 block">Hint (optional)</label>
            <input className="input" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="short helper line" />
          </div>
        </div>
        {isNew && <p className="text-xs text-slate-400">You can add the tappable options after saving.</p>}
      </div>
    </Modal>
  );
}

export default function TrackersManager() {
  const { refreshCatalog } = useApp();
  const [all, setAll] = useState([]);
  const [editing, setEditing] = useState(undefined); // undefined=closed, null=new, obj=edit
  const [err, setErr] = useState(null);
  const [draftFor, setDraftFor] = useState(null); // tracker id whose add-input is open
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    try {
      setAll(await apiGet('/api/trackers?includeInactive=1'));
      setErr(null);
    } catch {
      setErr('Managing trackers needs your home server.');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const after = async () => { await load(); await refreshCatalog(); };

  const onSave = async (body) => {
    try {
      if (editing) await updateTracker(editing.id, body);
      else await createTracker(body);
      setEditing(undefined);
      after();
    } catch { setErr('Could not save — are you on the home server?'); }
  };
  const onRetire = async () => {
    if (!editing) return;
    await deleteTracker(editing.id);
    setEditing(undefined);
    after();
  };

  const active = all.filter((t) => t.active).sort((a, b) => a.display_order - b.display_order || a.id - b.id);
  const retired = all.filter((t) => !t.active);

  const move = async (tracker, dir) => {
    const idx = active.findIndex((t) => t.id === tracker.id);
    const target = idx + dir;
    if (target < 0 || target >= active.length) return;
    const ids = active.map((t) => t.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    setAll((prev) => prev.map((t) => {
      const o = ids.indexOf(t.id);
      return o >= 0 ? { ...t, display_order: o } : t;
    }));
    try { await reorderTrackers(ids); after(); } catch { load(); }
  };

  const addOption = async (trackerId) => {
    const label = draft.trim();
    setDraft('');
    setDraftFor(null);
    if (!label) return;
    await addTrackerOption(trackerId, label);
    after();
  };
  const retireOption = async (trackerId, optionId) => {
    await deleteTrackerOption(trackerId, optionId);
    after();
  };

  if (err) return <p className="px-1 py-2 text-sm text-amber-600">{err}</p>;

  const bySection = SECTIONS.map((s) => ({ ...s, items: active.filter((t) => t.section === s.key) }));

  return (
    <div className="space-y-4">
      <button onClick={() => setEditing(null)} className="btn-ghost w-full">
        <PlusIcon width={18} height={18} /> Add tracker
      </button>

      {bySection.map((sec) => sec.items.length > 0 && (
        <div key={sec.key}>
          <div className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{sec.label}</div>
          <div className="space-y-2">
            {sec.items.map((t, i) => (
              <div key={t.id} className="card p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex flex-col">
                    <button onClick={() => move(t, -1)} disabled={i === 0} className="text-slate-300 disabled:opacity-30 dark:text-slate-600" aria-label="Up">
                      <ChevronLeft width={15} height={15} className="rotate-90" />
                    </button>
                    <button onClick={() => move(t, 1)} disabled={i === sec.items.length - 1} className="text-slate-300 disabled:opacity-30 dark:text-slate-600" aria-label="Down">
                      <ChevronRight width={15} height={15} className="rotate-90" />
                    </button>
                  </div>
                  <span className="flex-1 truncate font-medium text-slate-700 dark:text-slate-200">
                    {t.icon ? <span className="mr-1">{t.icon}</span> : null}{t.name}
                    <span className="ml-2 text-[11px] font-normal text-slate-400">
                      {t.kind === 'single' ? 'pick one' : 'tap several'}{t.has_intensity ? ' · strength' : ''}
                    </span>
                  </span>
                  <button onClick={() => setEditing(t)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-black/5 dark:hover:bg-white/5" aria-label="Edit">
                    <PencilIcon width={15} height={15} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {t.options.filter((o) => o.active).map((o) => (
                    <span key={o.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {o.emoji ? <span>{o.emoji}</span> : null}{o.label}
                      <button onClick={() => retireOption(t.id, o.id)} className="text-slate-400 hover:text-rose-500" aria-label={`Remove ${o.label}`}>
                        <XIcon width={11} height={11} />
                      </button>
                    </span>
                  ))}
                  {draftFor === t.id ? (
                    <input
                      autoFocus value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addOption(t.id); if (e.key === 'Escape') { setDraft(''); setDraftFor(null); } }}
                      onBlur={() => addOption(t.id)}
                      placeholder="new option…"
                      className="w-28 rounded-full border border-brand-300 bg-white px-2.5 py-1 text-xs outline-none dark:bg-slate-900"
                    />
                  ) : (
                    <button onClick={() => { setDraftFor(t.id); setDraft(''); }} className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-400 hover:border-brand-400 hover:text-brand-600 dark:border-slate-600">
                      <PlusIcon width={12} height={12} /> add
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {retired.length > 0 && (
        <div>
          <div className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Retired ({retired.length})</div>
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {retired.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2.5">
                <span className="truncate text-sm text-slate-500">{t.name}</span>
                <button onClick={async () => { await updateTracker(t.id, { active: true }); after(); }} className="text-sm font-medium text-brand-600 dark:text-brand-300">Restore</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing !== undefined && (
        <TrackerEditor tracker={editing} onSave={onSave} onClose={() => setEditing(undefined)} onRetire={editing ? onRetire : undefined} />
      )}
    </div>
  );
}
