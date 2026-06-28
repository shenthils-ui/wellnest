import { STATUS_META, nextStatus } from '../lib/constants';
import { CheckIcon, MoonIcon, DashIcon } from './Icons';

const STATUS_ICON = {
  DONE: CheckIcon,
  TIRED: MoonIcon,
  FORGOT: DashIcon,
};

// A large, tappable routine row. Tapping cycles the status with no typing.
export default function ActivityRow({ activity, status, onCycle, dimmed = false }) {
  const meta = status ? STATUS_META[status] : null;
  const Icon = status ? STATUS_ICON[status] : null;

  return (
    <button
      onClick={() => onCycle(nextStatus(status))}
      className={`group flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition
        active:scale-[0.99] ${
          meta
            ? `${meta.rowLight} ${meta.rowDark}`
            : 'border-slate-200 bg-white hover:border-brand-200 dark:border-slate-800 dark:bg-slate-900/60'
        } ${dimmed ? 'opacity-55' : ''}`}
    >
      {/* status indicator */}
      <span
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition ${
          status
            ? `${meta.chipBg} text-white`
            : 'border-2 border-dashed border-slate-300 text-transparent dark:border-slate-600'
        }`}
      >
        {Icon ? <Icon width={18} height={18} /> : <span className="h-2 w-2 rounded-full bg-slate-300" />}
      </span>

      {/* name + badges */}
      <span className="min-w-0 flex-1">
        <span
          className={`block line-clamp-2 font-medium leading-snug ${
            status === 'DONE' ? 'text-slate-700 dark:text-slate-200' : 'text-slate-800 dark:text-slate-100'
          }`}
        >
          {activity.name}
        </span>
        {activity.is_husband_task ? (
          <span className="chip mt-1 bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
            partner
          </span>
        ) : null}
      </span>

      {/* status label */}
      <span className={`flex-shrink-0 text-xs font-medium ${meta ? meta.text : 'text-slate-300 dark:text-slate-600'}`}>
        {meta ? meta.short : 'tap'}
      </span>
    </button>
  );
}
