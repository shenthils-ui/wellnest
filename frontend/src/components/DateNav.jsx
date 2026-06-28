import { addDays, prettyDate, relativeLabel, todayISO, isFuture } from '../lib/date';
import { ChevronLeft, ChevronRight } from './Icons';

// Previous / next day navigation with a friendly label. Future days are
// reachable for planning but the "next" arrow stops a little ahead.
export default function DateNav({ date, onChange }) {
  const rel = relativeLabel(date);
  const canGoForward = date < addDays(todayISO(), 7);

  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <button
        onClick={() => onChange(addDays(date, -1))}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-softer active:scale-95 dark:bg-slate-900 dark:text-slate-300"
        aria-label="Previous day"
      >
        <ChevronLeft width={20} height={20} />
      </button>

      <button
        onClick={() => onChange(todayISO())}
        className="flex flex-col items-center"
        title="Jump to today"
      >
        {rel && (
          <span
            className={`text-xs font-semibold uppercase tracking-wide ${
              rel === 'Today' ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400'
            }`}
          >
            {rel}
          </span>
        )}
        <span className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {prettyDate(date)}
        </span>
      </button>

      <button
        onClick={() => canGoForward && onChange(addDays(date, 1))}
        disabled={!canGoForward}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-softer active:scale-95 disabled:opacity-30 dark:bg-slate-900 dark:text-slate-300"
        aria-label="Next day"
      >
        <ChevronRight width={20} height={20} />
      </button>
    </div>
  );
}
