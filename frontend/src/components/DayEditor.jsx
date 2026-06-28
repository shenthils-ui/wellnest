import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useDay } from '../hooks/useDay';
import { dayCompletion, groupByBlock } from '../lib/selectors';
import { ENCOURAGEMENTS } from '../lib/constants';
import { isFuture, addDays } from '../lib/date';
import { addTrackerOption, loadDay, getCycle } from '../lib/data';
import ProgressRing from './ProgressRing';
import ActivityRow from './ActivityRow';
import SymptomScale from './SymptomScale';
import ChipTracker from './ChipTracker';
import PeriodRow from './PeriodRow';
import { SparkleIcon } from './Icons';

function encouragementFor(date, percent) {
  if (percent === 100) return 'Every step done today — beautifully steady. 🌿';
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ENCOURAGEMENTS[h % ENCOURAGEMENTS.length];
}

export default function DayEditor({ date }) {
  const { catalog, refreshCatalog } = useApp();
  const { day, loading, setLog, setSymptom, addSymptom, clearSymptom, setMeta, toggleTherapy, setTracker, setTherapyNote, setPeriod } = useDay(date);

  // cycle info (for showing the cycle day on this date), refreshed after a period change
  const [cycleInfo, setCycleInfo] = useState(null);
  const refreshCycle = () => getCycle().then(setCycleInfo).catch(() => {});
  useEffect(() => { refreshCycle(); }, []);
  const cycleDay = useMemo(() => {
    const starts = cycleInfo?.starts || [];
    let last = null;
    for (const s of starts) if (s <= date) last = s;
    if (!last) return null;
    return Math.round((new Date(date + 'T00:00:00') - new Date(last + 'T00:00:00')) / 86400000) + 1;
  }, [cycleInfo, date]);

  const foodTrackers = useMemo(
    () => (catalog.trackers || []).filter((t) => t.section === 'food'),
    [catalog.trackers]
  );
  const feelingTrackers = useMemo(
    () => (catalog.trackers || []).filter((t) => t.section === 'feeling'),
    [catalog.trackers]
  );

  const onAddOption = async (trackerId, label) => {
    await addTrackerOption(trackerId, label);
    await refreshCatalog();
  };

  // Copy yesterday's food chips onto today — handy for repeat meals.
  const [copying, setCopying] = useState(false);
  const copyYesterdayFood = async () => {
    setCopying(true);
    try {
      const { day: prev } = await loadDay(addDays(date, -1));
      const prevTrk = prev.trackers || {};
      for (const t of foodTrackers) {
        const sel = prevTrk[t.id] || prevTrk[String(t.id)];
        if (!sel) continue;
        for (const [optId, info] of Object.entries(sel)) {
          setTracker(t, Number(optId), { selected: true, intensity: info?.intensity ?? null });
        }
      }
    } finally {
      setCopying(false);
    }
  };

  const completion = useMemo(
    () => (day ? dayCompletion(catalog.activities, date, day.logs) : { expected: 0, done: 0, percent: null }),
    [catalog.activities, date, day]
  );
  const groups = useMemo(
    () => groupByBlock(catalog.activities, date),
    [catalog.activities, date]
  );

  // notes: local state with debounced autosave (cycle_day is preserved as-is)
  const [notes, setNotes] = useState('');
  const [cycleField, setCycleField] = useState('');
  const timer = useRef(null);
  useEffect(() => {
    if (day) {
      setNotes(day.notes || '');
      setCycleField(day.cycle_day != null ? String(day.cycle_day) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day?.date, loading]);

  const commitMeta = (nextNotes, nextCycle) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const cd = nextCycle === '' ? null : Math.max(1, Math.min(60, parseInt(nextCycle, 10) || 0)) || null;
      setMeta(nextNotes === '' ? null : nextNotes, cd);
    }, 500);
  };

  if (loading && !day) {
    return (
      <div className="space-y-3">
        <div className="card h-28 animate-pulse" />
        <div className="card h-40 animate-pulse" />
      </div>
    );
  }

  const future = isFuture(date);

  return (
    <div className="space-y-5">
      {/* completion */}
      <div className="card flex items-center gap-4 p-4">
        <ProgressRing percent={completion.percent ?? 0} size={76}>
          <span className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {completion.percent ?? '–'}
            {completion.percent != null && <span className="text-xs">%</span>}
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          {completion.expected > 0 ? (
            <>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {completion.done} of {completion.expected} done
              </p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {future ? 'Planning ahead — no pressure.' : encouragementFor(date, completion.percent)}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">Nothing scheduled today — rest well. 🌙</p>
          )}
        </div>
      </div>

      {/* activities by time block */}
      {groups.map((group) => (
        <section key={group.key}>
          <div className="mb-2 flex items-center gap-2 px-1">
            <span aria-hidden>{group.emoji}</span>
            <h2 className="section-title">{group.label}</h2>
          </div>
          <div className="space-y-2">
            {group.activities.map((a) => (
              <ActivityRow
                key={a.id}
                activity={a}
                status={day.logs[a.id] || null}
                onCycle={(s) => setLog(a.id, s)}
              />
            ))}
          </div>
        </section>
      ))}

      {groups.length === 0 && (
        <div className="card p-6 text-center text-sm text-slate-500">
          No active activities yet. Add some in <span className="font-medium">Settings</span>.
        </div>
      )}

      {/* food & meals (chip trackers) */}
      {foodTrackers.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2 px-1">
            <span aria-hidden>🍽️</span>
            <h2 className="section-title flex-1">Food &amp; meals</h2>
            <button
              onClick={copyYesterdayFood}
              disabled={copying}
              className="text-xs font-medium text-brand-600 disabled:opacity-50 dark:text-brand-300"
            >
              {copying ? 'Copying…' : '↺ Copy yesterday'}
            </button>
          </div>
          <div className="space-y-2">
            {foodTrackers.map((t) => (
              <ChipTracker
                key={t.id}
                tracker={t}
                selected={day.trackers?.[t.id] || day.trackers?.[String(t.id)] || {}}
                onSet={setTracker}
                onAddOption={onAddOption}
              />
            ))}
          </div>
        </section>
      )}

      {/* symptoms + feeling chips */}
      {(catalog.metrics.length > 0 || feelingTrackers.length > 0) && (
        <section>
          <div className="mb-2 flex items-center gap-2 px-1">
            <SparkleIcon width={16} height={16} className="text-brand-500" />
            <h2 className="section-title">How are you feeling?</h2>
          </div>
          <div className="space-y-2">
            {catalog.metrics.map((m) => (
              <SymptomScale
                key={m.id}
                metric={m}
                data={day.symptoms[m.id]}
                onSet={(v) => setSymptom(m.id, v)}
                onAdd={(v) => addSymptom(m.id, v)}
                onClear={() => clearSymptom(m.id)}
              />
            ))}
            {feelingTrackers.map((t) => (
              <ChipTracker
                key={t.id}
                tracker={t}
                selected={day.trackers?.[t.id] || day.trackers?.[String(t.id)] || {}}
                onSet={setTracker}
                onAddOption={onAddOption}
              />
            ))}
          </div>
        </section>
      )}

      {/* period / cycle */}
      <PeriodRow
        flow={day.period}
        cycleDay={cycleDay}
        cycle={cycleInfo}
        date={date}
        onSet={(f) => { setPeriod(f); setTimeout(refreshCycle, 400); }}
      />

      {/* notes */}
      <section className="card space-y-3 p-4">
        <div>
          <label className="section-title mb-1.5 block">Notes</label>
          <textarea
            className="input min-h-[72px] resize-y"
            placeholder="Anything worth remembering about today…"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              commitMeta(e.target.value, cycleField);
            }}
          />
        </div>
      </section>

      {/* therapies */}
      {catalog.therapies.length > 0 && (
        <section>
          <div className="mb-2 px-1">
            <h2 className="section-title">Therapies — done today?</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {catalog.therapies.map((t) => {
              const on = day.therapies.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTherapy(t.id)}
                  className={`rounded-full px-3.5 py-2 text-sm font-medium transition active:scale-95 ${
                    on
                      ? 'bg-brand-600 text-white shadow-softer'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'
                  }`}
                >
                  {on ? '✓ ' : ''}
                  {t.name}
                </button>
              );
            })}
          </div>
          {/* notes for any therapy marked done today */}
          {catalog.therapies.filter((t) => day.therapies.includes(t.id)).map((t) => (
            <TherapyNote
              key={t.id}
              name={t.name}
              value={day.therapyNotes?.[t.id] || ''}
              onCommit={(v) => setTherapyNote(t.id, v)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

// A gentle, debounced note for a therapy done today (e.g. what happened).
function TherapyNote({ name, value, onCommit }) {
  const [text, setText] = useState(value);
  const t = useRef(null);
  useEffect(() => { setText(value); }, [value]);
  const onChange = (v) => {
    setText(v);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => onCommit(v), 600);
  };
  return (
    <div className="mt-2">
      <input
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Note for ${name}… (optional)`}
        className="input text-sm"
      />
    </div>
  );
}
