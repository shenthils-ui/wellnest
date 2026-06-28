import { useState } from 'react';
import {
  notificationsState,
  requestNotificationPermission,
  sendTestNotification,
} from '../../lib/reminders';
import { BellIcon } from '../Icons';

export default function RemindersPanel() {
  const [state, setState] = useState(notificationsState());
  const [test, setTest] = useState(null);

  const enable = async () => setState(await requestNotificationPermission());
  const doTest = async () => {
    const r = await sendTestNotification();
    setState(notificationsState());
    setTest(r === 'granted' ? 'Sent — check your notifications.' : 'Permission needed to send.');
  };

  return (
    <div className="space-y-3">
      {state === 'unsupported' ? (
        <p className="text-sm text-slate-500">This browser doesn’t support notifications.</p>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-xl bg-white px-3.5 py-3 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <BellIcon width={18} height={18} className="text-brand-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {state === 'granted' ? 'Reminders are enabled' : 'Reminders are off'}
              </span>
            </div>
            {state === 'granted' ? (
              <button onClick={doTest} className="text-sm font-medium text-brand-600 dark:text-brand-300">Send test</button>
            ) : (
              <button onClick={enable} className="btn-primary px-3 py-1.5 text-sm">Enable</button>
            )}
          </div>
          {test && <p className="px-1 text-xs text-brand-600 dark:text-brand-300">{test}</p>}
          {state === 'denied' && (
            <p className="px-1 text-xs text-amber-600">
              Notifications are blocked for this site. Allow them in your browser/phone settings, then return here.
            </p>
          )}
          <p className="px-1 text-xs text-slate-400">
            Set a time on any activity (Manage routine → edit → Reminder). Reminders are best-effort:
            they’re most reliable when WellNest has been opened recently, and phone behaviour varies by
            device. They’re a gentle nudge, not a guarantee.
          </p>
        </>
      )}
    </div>
  );
}
