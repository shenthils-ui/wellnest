import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  getOverview,
  getActivityInsights,
  getSymptomInsights,
  getStreaks,
  getCorrelation,
  getCorrelationScan,
} from '../lib/data';
import { todayISO, addDays, prettyShort } from '../lib/date';
import { metricColor } from '../lib/metricColors';
import ProgressRing from '../components/ProgressRing';
import SymptomTrendChart from '../components/SymptomTrendChart';
import LookBack from '../components/LookBack';
import { FlameIcon, InfoIcon } from '../components/Icons';

const RANGES = [
  { days: 7, label: '1 week' },
  { days: 30, label: '1 month' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
];

export default function Insights() {
  const { catalog } = useApp();
  const [rangeDays, setRangeDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [overview, setOverview] = useState(null);
  const [activities, setActivities] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [streaks, setStreaks] = useState([]);
  const [scan, setScan] = useState([]);
  const [selectedMetricIds, setSelectedMetricIds] = useState(new Set());
  const [showAllStreaks, setShowAllStreaks] = useState(false);

  const to = todayISO();
  const from = addDays(to, -(rangeDays - 1));

  // default chart metrics: energy + pain (or first two)
  useEffect(() => {
    if (selectedMetricIds.size === 0 && catalog.metrics.length) {
      const want = catalog.metrics.filter((m) => ['energy', 'pain'].includes(m.key)).map((m) => m.id);
      setSelectedMetricIds(new Set(want.length ? want : catalog.metrics.slice(0, 2).map((m) => m.id)));
    }
  }, [catalog.metrics, selectedMetricIds.size]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setOffline(false);
    Promise.all([
      getOverview(from, to),
      getActivityInsights(from, to),
      getSymptomInsights(from, to),
      getStreaks(),
      getCorrelationScan(from, to),
    ])
      .then(([ov, act, sym, st, sc]) => {
        if (!active) return;
        setOverview(ov);
        setActivities(act.activities || []);
        setSymptoms(sym.metrics || []);
        setStreaks(st.activities || []);
        setScan(sc.findings || []);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setOffline(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [from, to]);

  if (offline) {
    return (
      <div className="card p-6 text-center text-slate-500">
        <p className="font-medium">Insights need your home server</p>
        <p className="mt-1 text-sm">Open WellNest while connected to the same Wi-Fi as your PC to see trends and patterns.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5 pb-4">
      {/* range selector */}
      <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setRangeDays(r.days)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              rangeDays === r.days
                ? 'bg-brand-600 text-white shadow-softer'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="card h-28 animate-pulse" />
          <div className="card h-64 animate-pulse" />
        </div>
      ) : (
        <>
          <OverviewCard overview={overview} />
          <StreaksSection
            streaks={streaks}
            showAll={showAllStreaks}
            onToggle={() => setShowAllStreaks((s) => !s)}
          />
          <TrendsSection
            metrics={catalog.metrics}
            symptoms={symptoms}
            selectedIds={selectedMetricIds}
            onToggle={(id) =>
              setSelectedMetricIds((prev) => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
              })
            }
          />
          <CorrelationSection
            activities={catalog.activities}
            metrics={catalog.metrics}
            scan={scan}
            from={from}
            to={to}
          />
          <LookBack metrics={catalog.metrics} from={from} to={to} />
          <AdherenceSection activities={activities} />
        </>
      )}
    </div>
  );
}

/* ------------------------------ Overview ------------------------------ */
function OverviewCard({ overview }) {
  if (!overview) return null;
  const best = overview.best?.[0];
  const worst = overview.worst?.[0];
  return (
    <section className="card p-4">
      <div className="flex items-center gap-4">
        <ProgressRing percent={overview.avgCompletion ?? 0} size={72}>
          <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {overview.avgCompletion ?? '–'}
            {overview.avgCompletion != null && <span className="text-xs">%</span>}
          </span>
        </ProgressRing>
        <div className="flex-1">
          <p className="font-semibold text-slate-800 dark:text-slate-100">Average completion</p>
          <p className="text-sm text-slate-500">
            {overview.daysLogged} {overview.daysLogged === 1 ? 'day' : 'days'} logged in this range
          </p>
        </div>
      </div>
      {(best || worst) && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {best && (
            <div className="rounded-xl bg-emerald-50 px-3 py-2 dark:bg-emerald-900/20">
              <div className="text-xs text-slate-400">Brightest day</div>
              <div className="font-medium text-emerald-700 dark:text-emerald-300">
                {prettyShort(best.date)} · {best.completionPct}%
              </div>
            </div>
          )}
          {worst && (
            <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/40">
              <div className="text-xs text-slate-400">Gentlest day</div>
              <div className="font-medium text-slate-600 dark:text-slate-300">
                {prettyShort(worst.date)} · {worst.completionPct}%
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------ Streaks ------------------------------- */
function StreaksSection({ streaks, showAll, onToggle }) {
  const sorted = useMemo(
    () => [...streaks].sort((a, b) => (b.consistency ?? 0) - (a.consistency ?? 0)),
    [streaks]
  );
  const shown = showAll ? sorted : sorted.slice(0, 6);
  if (sorted.length === 0) return null;

  return (
    <section>
      <h2 className="section-title mb-2 px-1">Streaks & consistency</h2>
      <div className="card divide-y divide-slate-100 dark:divide-slate-800">
        {shown.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{s.name}</div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${s.consistency ?? 0}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1 text-amber-500" title="Current streak">
              <FlameIcon width={15} height={15} />
              <span className="text-sm font-semibold tabular-nums">{s.currentStreak}</span>
            </div>
            <div className="w-10 text-right text-xs font-semibold tabular-nums text-slate-400">
              {s.consistency != null ? `${s.consistency}%` : '–'}
            </div>
          </div>
        ))}
      </div>
      {sorted.length > 6 && (
        <button onClick={onToggle} className="mt-2 w-full text-center text-sm font-medium text-brand-600 dark:text-brand-300">
          {showAll ? 'Show less' : `Show all ${sorted.length}`}
        </button>
      )}
      <p className="mt-1.5 px-1 text-xs text-slate-400">
        Consistency rewards regularity over time — an occasional miss won’t undo your progress.
      </p>
    </section>
  );
}

/* ------------------------------ Trends -------------------------------- */
function TrendsSection({ metrics, symptoms, selectedIds, onToggle }) {
  return (
    <section>
      <h2 className="section-title mb-2 px-1">Symptom trends</h2>
      <div className="card p-3">
        <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto">
          {metrics.map((m, i) => {
            const on = selectedIds.has(m.id);
            return (
              <button
                key={m.id}
                onClick={() => onToggle(m.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  on ? 'text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
                style={on ? { backgroundColor: metricColor(m, i) } : undefined}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: on ? '#fff' : metricColor(m, i) }} />
                {m.name}
              </button>
            );
          })}
        </div>
        <SymptomTrendChart metrics={symptoms} selectedIds={selectedIds} />
      </div>
    </section>
  );
}

/* ---------------------------- Correlation ----------------------------- */
function CorrelationSection({ activities, metrics, scan, from, to }) {
  const activeActs = activities.filter((a) => a.active);
  const [activityId, setActivityId] = useState(null);
  const [metricId, setMetricId] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (activityId == null && activeActs.length) {
      const walk = activeActs.find((a) => /walk/i.test(a.name));
      setActivityId(walk ? walk.id : activeActs[0].id);
    }
    if (metricId == null && metrics.length) {
      const pain = metrics.find((m) => m.key === 'pain');
      setMetricId(pain ? pain.id : metrics[0].id);
    }
  }, [activeActs, metrics, activityId, metricId]);

  useEffect(() => {
    if (activityId == null || metricId == null) return;
    setBusy(true);
    getCorrelation(activityId, metricId, from, to)
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setBusy(false));
  }, [activityId, metricId, from, to]);

  const max = 10;
  const metric = metrics.find((m) => m.id === metricId);

  return (
    <section>
      <h2 className="section-title mb-2 px-1">What seems to help?</h2>
      <div className="card space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={activityId ?? ''} onChange={(e) => setActivityId(Number(e.target.value))}>
            {activeActs.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select className="input" value={metricId ?? ''} onChange={(e) => setMetricId(Number(e.target.value))}>
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {busy ? (
          <div className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : result && result.diff != null ? (
          <div className="space-y-2.5">
            <CorrBar label="On days done" value={result.doneAvg} max={max} count={result.doneCount} color="#4d8a6e" />
            <CorrBar label="On other days" value={result.notDoneAvg} max={max} count={result.notDoneCount} color="#94a3b8" />
            <p className="text-sm text-slate-600 dark:text-slate-300">{result.note}</p>
            <p className="flex items-start gap-1.5 text-xs text-slate-400">
              <InfoIcon width={13} height={13} className="mt-0.5 flex-shrink-0" />
              {result.disclaimer}
            </p>
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-slate-400">
            Not enough overlapping data yet — keep logging and patterns will appear.
          </p>
        )}
      </div>

      {scan.length > 0 && (
        <div className="mt-3">
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Top observations</h3>
          <div className="card divide-y divide-slate-100 p-0 dark:divide-slate-800">
            {scan.slice(0, 4).map((f, i) => (
              <p key={i} className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{f.note}</p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CorrBar({ label, value, max, count, color }) {
  const pct = value != null ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="tabular-nums text-slate-400">{count} days</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="flex h-full items-center justify-end rounded-full px-2" style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: color }}>
            <span className="text-xs font-semibold text-white">{value ?? '–'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Adherence ------------------------------- */
function AdherenceSection({ activities }) {
  const withData = activities.filter((a) => a.expected > 0);
  const sorted = useMemo(() => [...withData].sort((a, b) => b.skipped - a.skipped), [withData]);

  const mostTired = useMemo(
    () => [...withData].sort((a, b) => b.tired - a.tired)[0],
    [withData]
  );
  const mostForgot = useMemo(
    () => [...withData].sort((a, b) => b.forgot - a.forgot)[0],
    [withData]
  );

  if (withData.length === 0) {
    return (
      <section>
        <h2 className="section-title mb-2 px-1">Activity adherence</h2>
        <div className="card p-6 text-center text-sm text-slate-400">
          Log a few days and your adherence patterns will show up here.
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="section-title mb-2 px-1">Activity adherence</h2>

      {/* plain-language patterns */}
      <div className="mb-3 space-y-2">
        {mostTired && mostTired.tired >= 3 && (
          <div className="flex gap-2.5 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-900/20">
            <span aria-hidden>🌙</span>
            <p className="text-amber-800 dark:text-amber-200">
              <span className="font-semibold">{mostTired.name}</span> was most often set aside as “too tired”
              ({mostTired.tired}×). Frequent tired-skips can mean the day is over-scheduled — and resting is a valid choice.
            </p>
          </div>
        )}
        {mostForgot && mostForgot.forgot >= 3 && (
          <div className="flex gap-2.5 rounded-xl bg-sky-50 p-3 text-sm dark:bg-sky-900/20">
            <span aria-hidden>🔔</span>
            <p className="text-sky-800 dark:text-sky-200">
              <span className="font-semibold">{mostForgot.name}</span> slipped by most often ({mostForgot.forgot}×).
              A gentle reminder (Settings → reminders) might help it stick.
            </p>
          </div>
        )}
      </div>

      <div className="card divide-y divide-slate-100 dark:divide-slate-800">
        {sorted.map((a) => {
          const total = a.done + a.tired + a.forgot + a.unset;
          const w = (n) => (total ? `${(n / total) * 100}%` : '0%');
          return (
            <div key={a.id} className="px-4 py-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{a.name}</span>
                <span className="text-sm font-semibold tabular-nums text-slate-500">{a.completionPct ?? '–'}%</span>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="bg-emerald-500" style={{ width: w(a.done) }} />
                <div className="bg-amber-400" style={{ width: w(a.tired) }} />
                <div className="bg-rose-400" style={{ width: w(a.forgot) }} />
              </div>
              <div className="mt-1.5 flex gap-3 text-xs text-slate-400">
                <span className="text-emerald-600 dark:text-emerald-400">✓ {a.done} done</span>
                {a.tired > 0 && <span className="text-amber-600 dark:text-amber-400">🌙 {a.tired} rested</span>}
                {a.forgot > 0 && <span className="text-rose-500">— {a.forgot} missed</span>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 px-1 text-xs text-slate-400">
        Sorted by most skipped first. Skips are information, not failings.
      </p>
    </section>
  );
}
