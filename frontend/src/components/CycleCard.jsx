import { useEffect, useState } from 'react';
import { getCycle } from '../lib/data';
import { prettyShort } from '../lib/date';

// Compact cycle overview for the History screen.
export default function CycleCard() {
  const [c, setC] = useState(null);
  useEffect(() => { getCycle().then(setC).catch(() => {}); }, []);
  if (!c || !c.hasAnyData) return null;

  const daysUntil = c.daysUntilNext;
  const untilText = daysUntil > 0 ? `in ${daysUntil} days` : daysUntil === 0 ? 'today' : `${-daysUntil} days late`;

  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden>🌸</span>
        <h2 className="section-title">Cycle</h2>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Box big={c.currentDay ?? '–'} label="Cycle day" />
        <Box big={`${c.avgCycle}d`} label="Avg length" />
        <Box big={c.enoughData ? untilText.replace(' days', 'd').replace('in ', '') : '–'} label="Next period" />
      </div>

      {c.enoughData ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Next period around <b>{prettyShort(c.predictedNext)}</b> ({untilText}).
          {c.fertileStart && <> Fertile window ~ {prettyShort(c.fertileStart)}–{prettyShort(c.fertileEnd)}.</>}
        </p>
      ) : (
        <p className="mt-3 text-xs text-slate-400">Log another period to estimate cycle length and the next date.</p>
      )}

      {c.cycles?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.cycles.map((cy, i) => (
            <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800">
              {prettyShort(cy.from)} · {cy.length}d
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-400">Log period days on Today (or any past day) to keep this updated.</p>
    </section>
  );
}

function Box({ big, label }) {
  return (
    <div className="rounded-xl bg-rose-50/60 px-2 py-2 dark:bg-slate-800/50">
      <div className="text-lg font-bold text-rose-600 dark:text-rose-300">{big}</div>
      <div className="mt-0.5 text-[11px] text-slate-500">{label}</div>
    </div>
  );
}
