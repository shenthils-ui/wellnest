import { useEffect, useMemo, useState } from 'react';
import { getLookback } from '../lib/data';
import { InfoIcon } from './Icons';

// "What came before the tougher days?" — a lagged, observational look at which
// foods/activities showed up more often in the days leading up to harder days.
export default function LookBack({ metrics, from, to }) {
  const targets = useMemo(() => metrics.filter((m) => m.id != null), [metrics]);
  const [metricId, setMetricId] = useState(null);
  const [lag, setLag] = useState(3);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (metricId == null && targets.length) {
      const pain = targets.find((m) => m.key === 'pain') || targets.find((m) => m.good_direction === 'low');
      setMetricId((pain || targets[0]).id);
    }
  }, [targets, metricId]);

  useEffect(() => {
    if (metricId == null) return;
    setBusy(true);
    getLookback({ metric_id: metricId, lag, from, to })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setBusy(false));
  }, [metricId, lag, from, to]);

  const metric = targets.find((m) => m.id === metricId);

  return (
    <section>
      <h2 className="section-title mb-2 px-1">Look back — what came before tougher days?</h2>
      <div className="card space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={metricId ?? ''} onChange={(e) => setMetricId(Number(e.target.value))}>
            {targets.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <select className="input" value={lag} onChange={(e) => setLag(Number(e.target.value))}>
            <option value={1}>same day</option>
            <option value={2}>1–2 days before</option>
            <option value={3}>last 3 days</option>
          </select>
        </div>

        {busy ? (
          <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : !data || !data.enoughData ? (
          <p className="py-4 text-center text-sm text-slate-400">
            {data?.message || 'Keep logging — this needs a few weeks of data to compare.'}
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Comparing the {data.toughDays} tougher “{metric?.name}” days with {data.betterDays} better days.
            </p>

            <Group
              title="More common before tougher days"
              tone="warn"
              items={data.worseBefore}
              empty="Nothing stood out before the harder days."
            />
            <Group
              title="More common before better days"
              tone="good"
              items={data.betterBefore}
              empty="Nothing clearly stood out on the better days."
            />

            <p className="flex items-start gap-1.5 text-xs text-slate-400">
              <InfoIcon width={13} height={13} className="mt-0.5 flex-shrink-0" />
              {data.disclaimer}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function Group({ title, tone, items, empty }) {
  const good = tone === 'good';
  return (
    <div>
      <h3 className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((f) => (
            <div key={f.key} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{f.label}</span>
              <span className="tabular-nums text-slate-400">
                {f.toughPct}% vs {f.betterPct}%
              </span>
              <span className={`w-10 text-right text-xs font-semibold tabular-nums ${good ? 'text-emerald-600' : 'text-rose-500'}`}>
                {f.diff > 0 ? '+' : ''}{f.diff}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
