import { useState } from 'react';
import { valueColor } from '../lib/constants';

// Tappable 1–10 scale (no fiddly sliders). One tap sets the value; an optional
// "log again" adds a second reading later in the day and the app averages them.
export default function SymptomScale({ metric, data, onSet, onAdd, onClear }) {
  const [addMode, setAddMode] = useState(false);
  const min = metric.min_value || 1;
  const max = metric.max_value || 10;
  const nums = [];
  for (let n = min; n <= max; n++) nums.push(n);

  const avg = data?.avg ?? null;
  const selected = avg != null ? Math.round(avg) : null;
  const count = data?.count ?? 0;

  const handle = (n) => {
    if (addMode) {
      onAdd(n);
      setAddMode(false);
    } else {
      onSet(n);
    }
  };

  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-slate-700 dark:text-slate-200">{metric.name}</span>
          {avg != null && (
            <span className="text-xs text-slate-400">
              {count > 1 ? `avg ${avg} · ${count} logs` : `${avg}`}
            </span>
          )}
        </div>
        {avg != null && (
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setAddMode((m) => !m)}
              className={`rounded-full px-2 py-0.5 ${
                addMode
                  ? 'bg-brand-600 text-white'
                  : 'bg-brand-50 text-brand-600 dark:bg-slate-800 dark:text-brand-300'
              }`}
            >
              {addMode ? 'tap a number…' : 'log again'}
            </button>
            <button onClick={onClear} className="text-slate-400 hover:text-rose-500">
              clear
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-10 gap-1">
        {nums.map((n) => {
          const isSel = selected === n;
          const c = valueColor(n, metric.good_direction);
          return (
            <button
              key={n}
              onClick={() => handle(n)}
              style={isSel ? { backgroundColor: c.bg, color: c.text } : undefined}
              className={`flex aspect-square items-center justify-center rounded-lg text-sm font-semibold transition active:scale-90 ${
                isSel
                  ? 'shadow-softer ring-2 ring-white/60 dark:ring-black/30'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
