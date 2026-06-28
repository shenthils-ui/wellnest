import { useState } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { HeartIcon, XIcon } from './Icons';

// A gentle, dismissible nudge to add WellNest to the home screen.
export default function InstallBanner() {
  const { canInstall, isIOS, installed, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('wellnest-install-dismissed') === '1'
  );

  if (installed || dismissed || (!canInstall && !isIOS)) return null;

  const close = () => {
    setDismissed(true);
    localStorage.setItem('wellnest-install-dismissed', '1');
  };

  return (
    <div className="mb-3 flex items-start gap-3 rounded-xl2 bg-brand-600 p-3.5 text-white shadow-soft">
      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/15">
        <HeartIcon width={16} height={16} />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Add WellNest to your home screen</p>
        {isIOS ? (
          <p className="mt-0.5 text-white/85">
            Tap the Share button, then “Add to Home Screen” to open it like an app — it works offline.
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-white/85">Open it like an app, full-screen and offline.</p>
            <button
              onClick={promptInstall}
              className="mt-2 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 active:scale-95"
            >
              Install
            </button>
          </>
        )}
      </div>
      <button onClick={close} aria-label="Dismiss" className="text-white/70 hover:text-white">
        <XIcon width={18} height={18} />
      </button>
    </div>
  );
}
