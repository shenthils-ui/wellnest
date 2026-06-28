import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  getOverview,
  getActivityInsights,
  getSymptomInsights,
  getTherapyLogs,
} from '../lib/data';
import { todayISO, addDays, prettyDate } from '../lib/date';
import SymptomTrendChart from '../components/SymptomTrendChart';
import { PrinterIcon, ChevronLeft } from '../components/Icons';

// A clean, print-friendly summary for medical appointments. Ctrl/Cmd-P → PDF.
export default function DoctorReport() {
  const { catalog } = useApp();
  const navigate = useNavigate();
  const to0 = todayISO();
  const [from, setFrom] = useState(addDays(to0, -29));
  const [to, setTo] = useState(to0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(false);
    Promise.all([
      getOverview(from, to),
      getActivityInsights(from, to),
      getSymptomInsights(from, to),
      getTherapyLogs(from, to),
    ])
      .then(([ov, act, sym, ther]) => {
        if (!live) return;
        setData({ ov, act: act.activities || [], sym: sym.metrics || [], ther });
        setLoading(false);
      })
      .catch(() => { if (live) { setError(true); setLoading(false); } });
    return () => { live = false; };
  }, [from, to]);

  const therapyCounts = useMemo(() => {
    const m = {};
    (data?.ther || []).forEach((r) => { m[r.therapy_id] = (m[r.therapy_id] || 0) + 1; });
    return m;
  }, [data]);

  const allMetricIds = useMemo(() => new Set((data?.sym || []).map((m) => m.id)), [data]);

  return (
    <div className="min-h-full bg-white text-slate-800 dark:bg-white dark:text-slate-800">
      {/* toolbar (not printed) */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-white px-4 py-3">
        <button onClick={() => navigate('/settings')} className="flex items-center gap-1 text-sm font-medium text-slate-600">
          <ChevronLeft width={18} height={18} /> Back
        </button>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border px-2 py-1" />
          <span className="text-slate-400">→</span>
          <input type="date" value={to} min={from} max={to0} onChange={(e) => setTo(e.target.value)} className="rounded-lg border px-2 py-1" />
        </div>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white">
          <PrinterIcon width={16} height={16} /> Print
        </button>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-6">
        {/* header */}
        <div className="mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold text-brand-700">WellNest — Health Summary</h1>
          <p className="mt-1 text-sm text-slate-500">
            {prettyDate(from)} – {prettyDate(to)} · generated {prettyDate(to0)}
          </p>
        </div>

        {error ? (
          <p className="text-slate-500">This report needs your home server. Open it on the PC, or while connected to the same Wi-Fi.</p>
        ) : loading ? (
          <p className="text-slate-400">Preparing report…</p>
        ) : (
          <div className="space-y-7">
            {/* overview */}
            <section>
              <h2 className="mb-2 text-lg font-semibold">Overview</h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <Stat label="Days logged" value={data.ov.daysLogged} />
                <Stat label="Avg. routine completion" value={data.ov.avgCompletion != null ? `${data.ov.avgCompletion}%` : '–'} />
                <Stat label="Activities tracked" value={data.act.filter((a) => a.expected > 0).length} />
              </div>
            </section>

            {/* symptom summary */}
            <section>
              <h2 className="mb-2 text-lg font-semibold">Symptom averages (1–10)</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-1.5">Symptom</th>
                    <th className="py-1.5 text-center">Average</th>
                    <th className="py-1.5 text-center">Range</th>
                    <th className="py-1.5 text-center">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sym.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100">
                      <td className="py-1.5">{m.name} <span className="text-xs text-slate-400">({m.good_direction === 'low' ? 'lower better' : 'higher better'})</span></td>
                      <td className="py-1.5 text-center font-semibold">{m.average ?? '–'}</td>
                      <td className="py-1.5 text-center text-slate-500">{m.min != null ? `${m.min}–${m.max}` : '–'}</td>
                      <td className="py-1.5 text-center text-slate-500">{m.daysLogged}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* trend chart */}
            <section className="break-inside-avoid">
              <h2 className="mb-2 text-lg font-semibold">Symptom trends</h2>
              <SymptomTrendChart metrics={data.sym} selectedIds={allMetricIds} />
            </section>

            {/* adherence */}
            <section>
              <h2 className="mb-2 text-lg font-semibold">Routine adherence</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-1.5">Activity</th>
                    <th className="py-1.5 text-center">Done</th>
                    <th className="py-1.5 text-center">Tired</th>
                    <th className="py-1.5 text-center">Missed</th>
                    <th className="py-1.5 text-center">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.act.filter((a) => a.expected > 0).map((a) => (
                    <tr key={a.id} className="border-b border-slate-100">
                      <td className="py-1.5">{a.name}</td>
                      <td className="py-1.5 text-center">{a.done}</td>
                      <td className="py-1.5 text-center">{a.tired}</td>
                      <td className="py-1.5 text-center">{a.forgot}</td>
                      <td className="py-1.5 text-center font-semibold">{a.completionPct ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* therapies */}
            {catalog.therapies.length > 0 && (
              <section>
                <h2 className="mb-2 text-lg font-semibold">Therapies completed</h2>
                <ul className="grid grid-cols-2 gap-2 text-sm">
                  {catalog.therapies.map((t) => (
                    <li key={t.id} className="flex justify-between border-b border-slate-100 py-1">
                      <span>{t.name}</span>
                      <span className="font-semibold">{therapyCounts[t.id] || 0}×</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="border-t pt-3 text-xs text-slate-400">
              Generated by WellNest. Symptom values are self-reported on a 1–10 scale and averaged per day.
              Any associations shown elsewhere in the app are observational, not medical conclusions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-3">
      <div className="text-2xl font-bold text-brand-700">{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
    </div>
  );
}
