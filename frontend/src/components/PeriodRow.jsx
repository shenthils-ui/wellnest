import { prettyShort } from '../lib/date';

const FLOWS = [
  { key: 'spotting', label: 'Spotting', dot: 'bg-rose-200' },
  { key: 'light', label: 'Light', dot: 'bg-rose-300' },
  { key: 'medium', label: 'Medium', dot: 'bg-rose-400' },
  { key: 'heavy', label: 'Heavy', dot: 'bg-rose-600' },
];

// Period logging + a small cycle readout. Tapping a flow marks the day; tapping
// the selected flow again (or "None") clears it.
export default function PeriodRow({ flow, cycleDay, cycle, date, onSet }) {
  const summary = cycle && cycle.enoughData;
  const daysUntil = cycle?.daysUntilNext;

  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden>🌸</span>
        <h2 className="section-title flex-1">Period &amp; cycle</h2>
        {cycleDay != null && (
          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
            Cycle day {cycleDay}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onSet(null)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition active:scale-95 ${
            !flow
              ? 'bg-slate-200 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-200'
              : 'bg-white text-slate-500 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700'
          }`}
        >
          None
        </button>
        {FLOWS.map((f) => {
          const on = flow === f.key;
          return (
            <button
              key={f.key}
              onClick={() => onSet(on ? null : f.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition active:scale-95 ${
                on
                  ? 'bg-rose-500 text-white ring-rose-500'
                  : 'bg-white text-slate-600 ring-slate-200 hover:ring-rose-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${on ? 'bg-white' : f.dot}`} />
              {f.label}
            </button>
          );
        })}
      </div>

      {summary ? (
        <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
          Average cycle <b>{cycle.avgCycle} days</b> · next period around{' '}
          <b>{prettyShort(cycle.predictedNext)}</b>{' '}
          {daysUntil > 0 ? `(in ${daysUntil} days)` : daysUntil === 0 ? '(today)' : `(${-daysUntil} days late)`}.
          {cycle.fertileStart && (
            <> Fertile window ~ {prettyShort(cycle.fertileStart)}–{prettyShort(cycle.fertileEnd)}.</>
          )}
        </p>
      ) : cycle && cycle.hasAnyData ? (
        <p className="mt-2.5 text-xs text-slate-400">Log one more period to see cycle length & predictions.</p>
      ) : (
        <p className="mt-2.5 text-xs text-slate-400">Tap a flow on the days of a period — after a couple of cycles you’ll see predictions here.</p>
      )}
    </section>
  );
}
