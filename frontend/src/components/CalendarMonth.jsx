import { monthGrid } from '../lib/date';
import { WEEKDAYS_SHORT, completionColor, valueColor } from '../lib/constants';
import { todayISO, isFuture } from '../lib/date';

// Flow → circle colour for logged period days.
const FLOW_BG = {
  spotting: { bg: '#f9c9d4', text: '#9f1239' },
  light: { bg: '#f4a6b8', text: '#9f1239' },
  medium: { bg: '#fb7185', text: '#ffffff' },
  heavy: { bg: '#e11d48', text: '#ffffff' },
};

// Monthly heatmap. Each day is a coloured circle — by completion %, a chosen
// symptom's daily average, or the menstrual cycle (period / predicted /
// fertile / ovulation), Flo-style.
export default function CalendarMonth({ year, monthIdx, dataByDate, colorMode, metric, cycle, onSelectDay }) {
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
    const v = info?.metrics?.[metric?.id];
    if (v == null) return null;
    return valueColor(v, metric?.good_direction);
  };

  // cycle descriptor for a date in cycle mode
  const cycleFor = (d) => {
    if (colorMode !== 'cycle' || !cycle) return null;
    if (cycle.period[d]) return { kind: 'period', flow: cycle.period[d] };
    if (cycle.predicted.has(d)) return { kind: 'predicted' };
    if (cycle.ovulation.has(d)) return { kind: 'ovulation' };
    if (cycle.fertile.has(d)) return { kind: 'fertile' };
    return null;
  };

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS_SHORT.map((w, i) => (
          <div key={i} className="py-1 text-center text-xs font-medium text-slate-400">{w}</div>
        ))}
      </div>
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((cell) => {
              const dayNum = Number(cell.iso.slice(8, 10));
              const future = isFuture(cell.iso);
              const isToday = cell.iso === today;
              const cyc = cell.inMonth ? cycleFor(cell.iso) : null;
              const color = cell.inMonth && colorMode !== 'cycle' ? cellColor(cell.iso) : null;

              // inner circle classes/styles for cycle mode
              let innerClass = '';
              let innerStyle;
              if (cyc?.kind === 'period') {
                const f = FLOW_BG[cyc.flow] || FLOW_BG.medium;
                innerStyle = { backgroundColor: f.bg, color: f.text };
              } else if (cyc?.kind === 'predicted') {
                innerClass = 'border-2 border-dotted border-rose-400 text-rose-500 dark:text-rose-300';
              } else if (cyc?.kind === 'ovulation') {
                innerClass = 'border-2 border-dotted border-teal-400 text-teal-600 dark:text-teal-300';
              } else if (cyc?.kind === 'fertile') {
                innerClass = 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300';
              }

              return (
                <button
                  key={cell.iso}
                  onClick={() => cell.inMonth && onSelectDay(cell.iso)}
                  disabled={!cell.inMonth}
                  className={`relative flex aspect-square items-center justify-center rounded-full text-xs font-semibold transition active:scale-90 ${
                    !cell.inMonth ? 'opacity-0' : future && colorMode !== 'cycle' ? 'opacity-50' : ''
                  } ${isToday ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-sand-50 dark:ring-offset-slate-900' : ''}`}
                  style={color ? { backgroundColor: color.bg, color: color.text } : undefined}
                >
                  {colorMode === 'cycle' ? (
                    <span
                      className={`flex h-full w-full items-center justify-center rounded-full ${
                        innerClass || 'text-slate-500 dark:text-slate-400'
                      }`}
                      style={innerStyle}
                    >
                      {dayNum}
                    </span>
                  ) : (
                    <span
                      className={color ? '' : 'flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}
                    >
                      {dayNum}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
