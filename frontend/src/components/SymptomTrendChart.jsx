import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { metricColor } from '../lib/metricColors';
import { prettyShort } from '../lib/date';

// Multi-line symptom trends. `metrics` is the insights payload (each with a
// daily-averaged series); `selectedIds` chooses which lines to draw.
export default function SymptomTrendChart({ metrics, selectedIds }) {
  const { dataset, active } = useMemo(() => {
    const active = metrics.filter((m) => selectedIds.has(m.id));
    const byDate = new Map();
    active.forEach((m) => {
      m.series.forEach(({ date, value }) => {
        if (!byDate.has(date)) byDate.set(date, { date });
        byDate.get(date)[`m${m.id}`] = value;
      });
    });
    const dataset = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    return { dataset, active };
  }, [metrics, selectedIds]);

  if (dataset.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400">
        No readings in this range yet.
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dataset} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => prettyShort(d)}
            minTickGap={28}
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            className="text-slate-400"
          />
          <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11 }} stroke="currentColor" className="text-slate-400" />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', fontSize: 12 }}
            labelFormatter={(d) => prettyShort(d)}
            formatter={(val, key) => {
              const m = active.find((mm) => `m${mm.id}` === key);
              return [val, m ? m.name : key];
            }}
          />
          {active.map((m, i) => (
            <Line
              key={m.id}
              type="monotone"
              dataKey={`m${m.id}`}
              name={m.name}
              stroke={metricColor(m, i)}
              strokeWidth={2.5}
              dot={false}
              connectNulls
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
