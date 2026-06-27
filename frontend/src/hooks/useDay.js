import { useState, useEffect, useCallback, useRef } from 'react';
import {
  loadDay,
  cacheDay,
  queueSetLog,
  queueSetSymptom,
  queueAddSymptom,
  queueClearSymptom,
  queueDayMeta,
  queueTherapy,
} from '../lib/data';

// Loads a single day and exposes optimistic mutators. Every change updates
// local state instantly, writes through to the offline cache, and queues a
// sync — there is no Save button.
export function useDay(date) {
  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const dayRef = useRef(null);

  useEffect(() => {
    dayRef.current = day;
  }, [day]);

  const reload = useCallback(async () => {
    setLoading(true);
    const { day: d, fromCache: fc } = await loadDay(date);
    setDay(d);
    setFromCache(fc);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadDay(date).then(({ day: d, fromCache: fc }) => {
      if (!active) return;
      setDay(d);
      setFromCache(fc);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [date]);

  // apply an optimistic patch to local state + cache
  const patch = useCallback(
    (mutator) => {
      setDay((prev) => {
        const next = mutator({ ...prev, logs: { ...prev.logs }, symptoms: { ...prev.symptoms }, therapies: [...prev.therapies] });
        cacheDay(date, next);
        return next;
      });
    },
    [date]
  );

  const setLog = useCallback(
    (activity_id, status) => {
      patch((d) => {
        if (status == null) delete d.logs[activity_id];
        else d.logs[activity_id] = status;
        return d;
      });
      queueSetLog(date, activity_id, status);
    },
    [date, patch]
  );

  const setSymptom = useCallback(
    (metric_id, value) => {
      patch((d) => {
        d.symptoms[metric_id] = { avg: value, count: 1, value };
        return d;
      });
      queueSetSymptom(date, metric_id, value);
    },
    [date, patch]
  );

  const addSymptom = useCallback(
    (metric_id, value) => {
      patch((d) => {
        const prev = d.symptoms[metric_id];
        if (prev) {
          const count = (prev.count || 1) + 1;
          const avg = Math.round(((prev.avg * (count - 1) + value) / count) * 10) / 10;
          d.symptoms[metric_id] = { avg, count, value };
        } else {
          d.symptoms[metric_id] = { avg: value, count: 1, value };
        }
        return d;
      });
      queueAddSymptom(date, metric_id, value);
    },
    [date, patch]
  );

  const clearSymptom = useCallback(
    (metric_id) => {
      patch((d) => {
        delete d.symptoms[metric_id];
        return d;
      });
      queueClearSymptom(date, metric_id);
    },
    [date, patch]
  );

  const setMeta = useCallback(
    (notes, cycle_day) => {
      patch((d) => {
        d.notes = notes;
        d.cycle_day = cycle_day;
        return d;
      });
      queueDayMeta(date, notes, cycle_day);
    },
    [date, patch]
  );

  const toggleTherapy = useCallback(
    (therapy_id) => {
      let willBeOn;
      patch((d) => {
        if (d.therapies.includes(therapy_id)) {
          d.therapies = d.therapies.filter((t) => t !== therapy_id);
          willBeOn = false;
        } else {
          d.therapies = [...d.therapies, therapy_id];
          willBeOn = true;
        }
        return d;
      });
      queueTherapy(date, therapy_id, willBeOn);
    },
    [date, patch]
  );

  return {
    day,
    loading,
    fromCache,
    reload,
    setLog,
    setSymptom,
    addSymptom,
    clearSymptom,
    setMeta,
    toggleTherapy,
  };
}
