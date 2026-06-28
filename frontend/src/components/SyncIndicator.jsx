import { useApp } from '../context/AppContext';
import { drain } from '../lib/sync';
import { CloudIcon, CloudOffIcon, RefreshIcon } from './Icons';

// Small, unobtrusive status pill. Tap to force a sync.
export default function SyncIndicator() {
  const { sync } = useApp();
  const { online, reachable, syncing, pending } = sync;

  let state, label, cls, Icon;
  if (syncing) {
    state = 'syncing';
    label = 'Syncing…';
    cls = 'text-brand-600 dark:text-brand-300';
    Icon = RefreshIcon;
  } else if (!online || !reachable) {
    state = 'offline';
    label = pending > 0 ? `Offline · ${pending} to sync` : 'Offline';
    cls = 'text-amber-600 dark:text-amber-400';
    Icon = CloudOffIcon;
  } else if (pending > 0) {
    state = 'pending';
    label = `${pending} to sync`;
    cls = 'text-amber-600 dark:text-amber-400';
    Icon = CloudIcon;
  } else {
    state = 'synced';
    label = 'Saved';
    cls = 'text-brand-600 dark:text-brand-400';
    Icon = CloudIcon;
  }

  return (
    <button
      onClick={() => drain()}
      title={
        state === 'synced'
          ? 'All changes saved on your home server'
          : 'Tap to try syncing now'
      }
      className={`inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium
                  shadow-softer ring-1 ring-black/5 backdrop-blur dark:bg-slate-900/70 dark:ring-white/10 ${cls}`}
    >
      <Icon width={15} height={15} className={syncing ? 'animate-spin' : ''} />
      <span>{label}</span>
    </button>
  );
}
