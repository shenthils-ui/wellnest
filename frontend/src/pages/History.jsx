import { useEffect, useMemo, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { loadCalendarYear } from '../lib/data';
import { monthLabel, todayISO } from '../lib/date';
import { completionColor, valueColor } from '../lib/constants';
import CalendarMonth from '../components/CalendarMonth';
import YearPixels from '../components/YearPixels';
import CycleCard from '../components/CycleCard';
import DaySheet from '../components/DaySheet';
import { ChevronLeft, ChevronRight } from '../components/Icons';

function Legend({ mode, metric }) {
  if (mode === 'completion') {
    return (
      <div className="mt-3 flex items-center justify-center gap-3 text-xs text-slate-400">
        <span>less</span>
        <div className="flex gap-1">
          {[10, 35, 60, 90].map((p) => (
            <span key={p} className="h-3 w-3 rounded-full" style={{ background: completionColor(p) }} />
          ))}
        </div>
        <span>done</span>
      </div>
    );
  }
  const good = metric?.good_direction === 'low' ? 'lower is better' : 'higher is better';
  return (
    <div className="mt-3 flex items-center justify-center gap-3 text-xs text-slate-400">
      <span>1</span>
      <div className="flex gap-1">
        {[1, 4, 7, 10].map((v) => (
          <span key={v} className="h-3 w-3 rounded-full" style={{ background: valueColor(v, metric?.good_direction).bg }} />
        ))}
      </div>
      <span>10 · {good}</span>
    </div>
  );
}

export default function History() {
  const { catalog } = useApp();
  const now = new Date();
  const [view, setView] = useState('month');
  const [year, setYear] = useState(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [colorMode, setColorMode] = useState('completion');
  const [yearMetricId, setYearMetricId] = useState(null);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState(null);

  // default the year-pixels metric to "pain" if present, else the first metric
  useEffect(() => {
    if (yearMetricId == null && catalog.metrics.length) {
      const pain = catalog.metrics.find((m) => m.key === 'pain');
      setYearMetricId(pain ? pain.id : catalog.metrics[0].id);
    }
  }, [catalog.metrics, yearMetricId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: r, fromCache } = await loadCalendarYear(year);
    const map = {};
    (r.perDay || []).forEach((d) => { map[d.date] = d; });
    setData(map);
    setOffline(fromCache);
    setLoading(false);
  }, [year]);

  useEffect(() => { refresh(); }, [refresh]);

  const colorMetric = useMemo(
    () => (colorMode === 'completion' ? null : catalog.metrics.find((m) => m.id === colorMode)),
    [colorMode, catalog.metrics]
  );
  const yearMetric = useMemo(
    () => catalog.metrics.find((m) => m.id === yearMetricId),
    [catalog.metrics, yearMetricId]
  );

  const prevMonth = () => {
    if (monthIdx === 0) { setMonthIdx(11); setYear((y) => y - 1); }
    else setMonthIdx((m) => m - 1);
  };
  const nextMonth = () => {
    if (monthIdx === 11) { setMonthIdx(0); setYear((y) => y + 1); }
    else setMonthIdx((m) => m + 1);
  };

  return (
    <div className="animate-fade-in space-y-4">
      {/* view toggle */}
      <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {[['month', 'Calendar'], ['year', 'Year in pixels']].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${
              view === v ? 'bg-white text-brand-700 shadow-softer dark:bg-slate-900 dark:text-brand-300' : 'text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {offline && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          Showing saved data — reconnect to your home server for the latest.
        </p>
      )}

      <CycleCard />

      {view === 'month' ? (
        <>
          {/* month nav */}
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-softer dark:bg-slate-900 dark:text-slate-300">
              <ChevronLeft width={18} height={18} />
            </button>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{monthLabel(year, monthIdx)}</h2>
            <button onClick={nextMonth} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-softer dark:bg-slate-900 dark:text-slate-300">
              <ChevronRight width={18} height={18} />
            </button>
          </div>

          {/* color-by chips */}
          <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3">
            <Chip active={colorMode === 'completion'} onClick={() => setColorMode('completion')}>Done %</Chip>
            {catalog.metrics.map((m) => (
              <Chip key={m.id} active={colorMode === m.id} onClick={() => setColorMode(m.id)}>{m.name}</Chip>
            ))}
          </div>

          <div className="card p-4">
            <CalendarMonth
              year={year}
              monthIdx={monthIdx}
              dataByDate={data}
              colorMode={colorMode}
              metric={colorMetric}
              onSelectDay={setSelected}
            />
            <Legend mode={colorMode === 'completion' ? 'completion' : 'symptom'} metric={colorMetric} />
          </div>
          <p className="px-1 text-center text-xs text-slate-400">Tap any day to view or back-fill it.</p>
        </>
      ) : (
        <>
          {/* year nav */}
          <div className="flex items-center justify-between">
            <button onClick={() => setYear((y) => y - 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-softer dark:bg-slate-900 dark:text-slate-300">
              <ChevronLeft width={18} height={18} />
            </button>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{year}</h2>
            <button onClick={() => setYear((y) => y + 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-softer dark:bg-slate-900 dark:text-slate-300">
              <ChevronRight width={18} height={18} />
            </button>
          </div>

          <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3">
            {catalog.metrics.map((m) => (
              <Chip key={m.id} active={yearMetricId === m.id} onClick={() => setYearMetricId(m.id)}>{m.name}</Chip>
            ))}
          </div>

          {yearMetric && (
            <div className="card p-4">
              <YearPixels year={year} metric={yearMetric} dataByDate={data} onSelectDay={setSelected} />
              <Legend mode="symptom" metric={yearMetric} />
            </div>
          )}
        </>
      )}

      {selected && (
        <DaySheet
          date={selected}
          onChangeDate={setSelected}
          onClose={() => {
            setSelected(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-brand-600 text-white shadow-softer'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'
      }`}
    >
      {children}
    </button>
  );
}
