import { useState } from 'react';
import { PlusIcon } from './Icons';

// Intensity styling for has_intensity trackers (e.g. Pain): 1→light, 2→med, 3→strong.
const INTENSITY = {
  1: { label: 'light', cls: 'bg-amber-300 text-amber-900 ring-amber-300' },
  2: { label: 'medium', cls: 'bg-orange-400 text-white ring-orange-400' },
  3: { label: 'strong', cls: 'bg-rose-500 text-white ring-rose-500' },
};

// Decide what a tap should do next, returning { selected, intensity }.
function nextState(tracker, current) {
  const isSel = !!current;
  if (tracker.has_intensity) {
    const i = current?.intensity || 0;
    if (i >= 3) return { selected: false, intensity: null }; // strong → off
    return { selected: true, intensity: i + 1 };             // off/1/2 → next
  }
  // plain toggle (single-select replacement is handled by the hook)
  return { selected: !isSel, intensity: null };
}

export default function ChipTracker({ tracker, selected = {}, onSet, onAddOption }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const submitNew = async () => {
    const label = draft.trim();
    if (!label) { setAdding(false); return; }
    setBusy(true);
    try {
      await onAddOption(tracker.id, label);
      setDraft('');
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-3.5">
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="font-medium text-slate-800 dark:text-slate-100">
          {tracker.icon ? <span className="mr-1">{tracker.icon}</span> : null}
          {tracker.name}
        </h3>
        {tracker.kind === 'single' && (
          <span className="text-[11px] text-slate-400">pick one</span>
        )}
      </div>
      {tracker.hint && <p className="-mt-1 mb-2 text-xs text-slate-400">{tracker.hint}</p>}

      <div className="flex flex-wrap gap-1.5">
        {tracker.options.map((o) => {
          const cur = selected[o.id];
          const isSel = !!cur;
          const intensity = cur?.intensity;
          const intMeta = intensity ? INTENSITY[intensity] : null;
          return (
            <button
              key={o.id}
              data-chip={o.id}
              onClick={() => onSet(tracker, o.id, nextState(tracker, cur))}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition active:scale-95 ${
                isSel
                  ? intMeta
                    ? `${intMeta.cls} ring-0`
                    : 'bg-brand-600 text-white ring-brand-600'
                  : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'
              }`}
            >
              {o.emoji ? <span className="mr-1">{o.emoji}</span> : null}
              {o.label}
              {intMeta ? <span className="ml-1 text-[10px] opacity-90">· {intMeta.label}</span> : null}
            </button>
          );
        })}

        {/* add a new option inline (no typing needed day-to-day, but available) */}
        {adding ? (
          <span className="inline-flex items-center gap-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitNew(); if (e.key === 'Escape') setAdding(false); }}
              onBlur={submitNew}
              placeholder="new…"
              disabled={busy}
              className="w-28 rounded-full border border-brand-300 bg-white px-3 py-1.5 text-sm outline-none dark:bg-slate-900 dark:text-slate-100"
            />
          </span>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-400 hover:border-brand-400 hover:text-brand-600 dark:border-slate-600"
          >
            <PlusIcon width={14} height={14} /> add
          </button>
        )}
      </div>
    </section>
  );
}
