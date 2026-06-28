import { useEffect } from 'react';
import DayEditor from './DayEditor';
import { prettyDate, relativeLabel, addDays, todayISO } from '../lib/date';
import { XIcon, ChevronLeft, ChevronRight } from './Icons';

// Full-screen editable sheet for any day — used to back-fill or correct history.
export default function DaySheet({ date, onChangeDate, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const rel = relativeLabel(date);
  const canForward = date < addDays(todayISO(), 7);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mt-auto flex max-h-[92vh] flex-col rounded-t-2xl bg-sand-50 shadow-2xl animate-fade-in dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="safe-top flex items-center justify-between gap-2 border-b border-black/5 px-4 py-3 dark:border-white/10">
          <button
            onClick={() => onChangeDate(addDays(date, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-softer dark:bg-slate-900 dark:text-slate-300"
            aria-label="Previous day"
          >
            <ChevronLeft width={18} height={18} />
          </button>
          <div className="text-center">
            {rel && <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">{rel}</div>}
            <div className="font-semibold text-slate-800 dark:text-slate-100">{prettyDate(date)}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => canForward && onChangeDate(addDays(date, 1))}
              disabled={!canForward}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-softer disabled:opacity-30 dark:bg-slate-900 dark:text-slate-300"
              aria-label="Next day"
            >
              <ChevronRight width={18} height={18} />
            </button>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-softer dark:bg-slate-900 dark:text-slate-300"
              aria-label="Close"
            >
              <XIcon width={18} height={18} />
            </button>
          </div>
        </div>
        {/* body */}
        <div className="overflow-y-auto px-4 py-4">
          <DayEditor date={date} />
        </div>
      </div>
    </div>
  );
}
