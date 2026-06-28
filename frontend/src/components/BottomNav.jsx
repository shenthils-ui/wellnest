import { NavLink } from 'react-router-dom';
import { HomeIcon, CalendarIcon, ChartIcon, CogIcon } from './Icons';

const tabs = [
  { to: '/', label: 'Today', Icon: HomeIcon, end: true },
  { to: '/history', label: 'History', Icon: CalendarIcon },
  { to: '/insights', label: 'Insights', Icon: ChartIcon },
  { to: '/settings', label: 'Settings', Icon: CogIcon },
];

export default function BottomNav() {
  return (
    <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {tabs.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
                isActive
                  ? 'text-brand-600 dark:text-brand-300'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`rounded-full px-3 py-1 transition ${
                    isActive ? 'bg-brand-100 dark:bg-brand-900/40' : ''
                  }`}
                >
                  <Icon width={22} height={22} />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
