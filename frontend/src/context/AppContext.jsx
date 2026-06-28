import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { loadCatalog } from '../lib/data';
import { subscribeSync, startSync } from '../lib/sync';
import { startReminderScheduler } from '../lib/reminders';

const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}

function initialTheme() {
  const saved = localStorage.getItem('wellnest-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function AppProvider({ children }) {
  const [catalog, setCatalog] = useState({ activities: [], metrics: [], therapies: [], trackers: [] });
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogOffline, setCatalogOffline] = useState(false);
  const [theme, setThemeState] = useState(initialTheme);
  const [sync, setSync] = useState({ online: true, reachable: true, syncing: false, pending: 0, lastSyncAt: null });

  const refreshCatalog = useCallback(async () => {
    const { catalog: c, fromCache } = await loadCatalog();
    setCatalog(c);
    setCatalogOffline(fromCache);
    setCatalogLoaded(true);
    return c;
  }, []);

  // keep a live reference to activities for the reminder scheduler
  const catalogRef = useRef(catalog);
  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);

  useEffect(() => {
    refreshCatalog();
    startSync();
    const unsub = subscribeSync(setSync);
    const stopReminders = startReminderScheduler(() => catalogRef.current.activities);
    return () => {
      unsub();
      stopReminders && stopReminders();
    };
  }, [refreshCatalog]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('wellnest-theme', theme);
  }, [theme]);

  const toggleTheme = () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));

  const value = {
    catalog,
    catalogLoaded,
    catalogOffline,
    refreshCatalog,
    theme,
    setTheme: setThemeState,
    toggleTheme,
    sync,
    // convenience lookups
    activityById: (id) => catalog.activities.find((a) => a.id === id),
    metricById: (id) => catalog.metrics.find((m) => m.id === id),
    therapyById: (id) => catalog.therapies.find((t) => t.id === id),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
