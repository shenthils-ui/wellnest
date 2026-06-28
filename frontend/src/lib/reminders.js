// Best-effort local reminders via the Notifications API. These fire reliably
// only while the app has been opened recently (foreground / kept warm); true
// background scheduling is not dependable across phones, so this is a gentle
// nudge, not a guarantee — the UI says as much.

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationsState() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

async function fire(title, body) {
  const opts = { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: body, silent: false };
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg && reg.showNotification) {
      await reg.showNotification(title, opts);
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    // eslint-disable-next-line no-new
    new Notification(title, opts);
  } catch {
    /* notifications unavailable */
  }
}

function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let timer = null;

// getActivities: () => current activities array (so edits are picked up live).
export function startReminderScheduler(getActivities) {
  if (timer) clearInterval(timer);
  const check = () => {
    if (notificationsState() !== 'granted') return;
    const now = new Date();
    const cur = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const date = localISO(now);
    for (const a of getActivities() || []) {
      if (!a.active || !a.reminder_enabled || !a.reminder_time) continue;
      if (a.reminder_time !== cur) continue;
      const key = `wellnest-rem:${a.id}:${date}`;
      if (localStorage.getItem(key)) continue;
      localStorage.setItem(key, '1');
      fire('WellNest', `Time for: ${a.name}`);
    }
  };
  timer = setInterval(check, 30000);
  check();
  return () => timer && clearInterval(timer);
}

export async function sendTestNotification() {
  const perm = await requestNotificationPermission();
  if (perm !== 'granted') return perm;
  await fire('WellNest', 'Reminders are working 🌿');
  return 'granted';
}
