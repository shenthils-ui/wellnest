// Stable, calm colours per symptom for charts and legends.
const BY_KEY = {
  energy: '#4d8a6e',
  sleep: '#6366f1',
  mood_am: '#0ea5e9',
  pain: '#e16a6a',
  mood_pm: '#f59e0b',
  stress: '#a855f7',
};
const FALLBACK = ['#4d8a6e', '#6366f1', '#0ea5e9', '#e16a6a', '#f59e0b', '#a855f7', '#14b8a6', '#ec4899'];

export function metricColor(metric, index = 0) {
  if (metric?.key && BY_KEY[metric.key]) return BY_KEY[metric.key];
  return FALLBACK[index % FALLBACK.length];
}
