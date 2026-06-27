import { useApp } from '../context/AppContext';
import SyncIndicator from './SyncIndicator';
import { HeartIcon, SunIcon, MoonIcon } from './Icons';

// App wordmark + sync status + quick theme toggle, shown on every screen.
export default function Header() {
  const { theme, toggleTheme } = useApp();
  return (
    <header className="no-print safe-top sticky top-0 z-20 -mx-3 mb-1 bg-sand-50/80 px-3 pb-2 pt-3 backdrop-blur dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white shadow-softer">
            <HeartIcon width={17} height={17} />
          </span>
          <span className="text-lg font-semibold tracking-tight text-brand-800 dark:text-brand-200">
            WellNest
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SyncIndicator />
          <button
            onClick={toggleTheme}
            aria-label="Toggle light/dark"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-slate-500 shadow-softer ring-1 ring-black/5 dark:bg-slate-900/70 dark:text-slate-300 dark:ring-white/10"
          >
            {theme === 'dark' ? <SunIcon width={16} height={16} /> : <MoonIcon width={16} height={16} />}
          </button>
        </div>
      </div>
    </header>
  );
}
