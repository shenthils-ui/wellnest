import { monthGrid } from '../lib/date';
import { WEEKDAYS_SHORT, completionColor, valueColor } from '../lib/constants';
import { todayISO, isFuture } from '../lib/date';

// Monthly heatmap. Each day is a coloured circle — by completion %, or by a
// chosen symptom's daily average.
export default function CalendarMonth({ year, monthIdx, dataByDate, colorMode, metric, onSelectDay }) {
  const weeks = monthGrid(year, monthIdx);
  const today = todayISO();

  const cellColor = (d) => {
    const info = dataByDate[d];
    if (colorMode === 'completion') {
      if (!info || info.completionPct == null) {
        return info?.logged ? { bg: '#cbd5e1', text: '#fff' } : null;
      }
      return { bg: completionColor(info.completionPct), text: '#fff' };
    }
    // symptom mode
    const v = info?.metrics?.[metric?.id];
    if (v == null) return null;
    return valueColor(v, metric?.good_direction);
  };

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS_SHORT.map((w, i) => (
          <div key={i} className="py-1 text-center text-xs font-medium text-slate-400">
            {w}
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((cell) => {
              const dayNum = Number(cell.iso.slice(8, 10));
              const color = cell.inMonth ? cellColor(cell.iso) : null;
              const future = isFuture(cell.iso);
              const isToday = cell.iso === today;
              return (
                <button
                  key={cell.iso}
                  onClick={() => cell.inMonth && onSelectDay(cell.iso)}
                  disabled={!cell.inMonth}
                  className={`relative flex aspect-square items-center justify-center rounded-full text-xs font-semibold transition active:scale-90 ${
                    !cell.inMonth ? 'opacity-0' : future ? 'opacity-50' : ''
                  } ${isToday ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-sand-50 dark:ring-offset-slate-900' : ''}`}
                  style={
                    color
                      ? { backgroundColor: color.bg, color: color.text }
                      : undefined
                  }
                >
                  <span
                    className={
                      color
                        ? ''
                        : 'flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                    }
                  >
                    {dayNum}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
