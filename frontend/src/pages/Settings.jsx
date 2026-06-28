import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet } from '../lib/net';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import RemindersPanel from '../components/settings/RemindersPanel';
import ActivitiesManager from '../components/settings/ActivitiesManager';
import MetricsManager from '../components/settings/MetricsManager';
import TrackersManager from '../components/settings/TrackersManager';
import TherapiesManager from '../components/settings/TherapiesManager';
import BackupPanel from '../components/settings/BackupPanel';
import HelpGuide from '../components/settings/HelpGuide';
import {
  SunIcon, MoonIcon, BellIcon, ListIcon, SparkleIcon, HeartIcon,
  ChevronRight, DownloadIcon, CogIcon, InfoIcon,
} from '../components/Icons';

function Section({ icon: Icon, title, subtitle, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-slate-800 dark:text-brand-300">
          <Icon width={18} height={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-slate-800 dark:text-slate-100">{title}</span>
          {subtitle && <span className="block text-xs text-slate-400">{subtitle}</span>}
        </span>
        <ChevronRight width={18} height={18} className={`text-slate-300 transition ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="border-t border-slate-100 px-4 py-4 dark:border-slate-800">{children}</div>}
    </section>
  );
}

export default function Settings() {
  const { theme, toggleTheme } = useApp();
  const { canInstall, isIOS, installed, promptInstall } = useInstallPrompt();
  const [stats, setStats] = useState(null);
  useEffect(() => { apiGet('/api/stats').then(setStats).catch(() => {}); }, []);

  return (
    <div className="animate-fade-in space-y-3 pb-4">
      <p className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-center text-xs text-brand-700 dark:bg-slate-800/60 dark:text-brand-200">
        🔒 Everything stays on your home computer — no accounts, no cloud, no tracking.
      </p>

      <Section icon={InfoIcon} title="How to use WellNest" subtitle="A quick, gentle guide">
        <HelpGuide />
      </Section>

      {/* appearance */}
      <section className="card flex items-center gap-3 px-4 py-3.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-slate-800 dark:text-brand-300">
          {theme === 'dark' ? <MoonIcon width={18} height={18} /> : <SunIcon width={18} height={18} />}
        </span>
        <span className="flex-1 font-medium text-slate-800 dark:text-slate-100">Appearance</span>
        <button onClick={toggleTheme} className="btn-subtle px-3 py-1.5 text-sm">
          {theme === 'dark' ? 'Dark' : 'Light'}
        </button>
      </section>

      <Section icon={BellIcon} title="Reminders" subtitle="Gentle local notifications">
        <RemindersPanel />
      </Section>

      <Section icon={ListIcon} title="Manage routine" subtitle="Add, rename, reorder, retire activities">
        <ActivitiesManager />
      </Section>

      <Section icon={SparkleIcon} title="Symptoms tracked" subtitle="Customise the 1–10 measures">
        <MetricsManager />
      </Section>

      <Section icon={ListIcon} title="Food & body trackers" subtitle="Ingredients, mood, pain… tap-to-log chips">
        <TrackersManager />
      </Section>

      <Section icon={HeartIcon} title="Weekly therapies">
        <TherapiesManager />
      </Section>

      <Section icon={DownloadIcon} title="Backup & export" subtitle="JSON, CSV, doctor report">
        <BackupPanel />
      </Section>

      <Section icon={CogIcon} title="Install & about">
        <div className="space-y-3 text-sm">
          {installed ? (
            <p className="text-brand-600 dark:text-brand-300">✓ Installed to your home screen.</p>
          ) : canInstall ? (
            <button onClick={promptInstall} className="btn-primary w-full">Add WellNest to home screen</button>
          ) : isIOS ? (
            <p className="text-slate-500">On iPhone/iPad: tap the Share button, then “Add to Home Screen”.</p>
          ) : (
            <p className="text-slate-500">Use your browser’s “Install app” / “Add to Home screen” option to install.</p>
          )}
          <div className="rounded-xl bg-slate-50 px-3.5 py-3 text-xs text-slate-500 dark:bg-slate-800/40">
            <p className="font-medium text-slate-600 dark:text-slate-300">WellNest · v1.0</p>
            {stats && (
              <>
                <p className="mt-1">Database: <span className="break-all font-mono">{stats.dbPath}</span></p>
                <p className="mt-0.5">{stats.activity_logs} day entries · {stats.symptom_entries} symptom readings stored.</p>
              </>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
