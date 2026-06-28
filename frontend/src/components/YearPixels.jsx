import { valueColor } from '../lib/constants';

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const DAY_LABELS = new Set([1, 10, 20, 30]);

// Classic "year in pixels": 12 month columns × 31 day rows, each pixel coloured
// by the chosen symptom's daily average.
export default function YearPixels({ year, metric, dataByDate, onSelectDay }) {
  const iso = (m, d) => `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const valid = (m, d) => new Date(year, m, d).getMonth() === m;

  const rows = [];
  for (let d = 1; d <= 31; d++) rows.push(d);

  return (
    <div className="select-none">
      {/* month headers */}
      <div className="mb-1 flex items-center gap-[3px] pl-5">
        {MONTH_INITIALS.map((mi, i) => (
          <div key={i} className="flex-1 text-center text-[10px] font-medium text-slate-400">
            {mi}
          </div>
        ))}
      </div>
      <div className="space-y-[3px]">
        {rows.map((d) => (
          <div key={d} className="flex items-center gap-[3px]">
            <div className="w-4 text-right text-[8px] leading-none text-slate-300 dark:text-slate-600">
              {DAY_LABELS.has(d) ? d : ''}
            </div>
            {MONTH_INITIALS.map((_, m) => {
              if (!valid(m, d)) return <div key={m} className="flex-1" />;
              const date = iso(m, d);
              const v = dataByDate[date]?.metrics?.[metric.id];
              const c = v != null ? valueColor(v, metric.good_direction) : null;
              return (
                <button
                  key={m}
                  onClick={() => onSelectDay(date)}
                  title={v != null ? `${date} · ${metric.name}: ${v}` : date}
                  className="aspect-square flex-1 rounded-[3px] transition active:scale-90"
                  style={{ backgroundColor: c ? c.bg : undefined }}
                >
                  {!c && <div className="h-full w-full rounded-[3px] bg-slate-100 dark:bg-slate-800" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
