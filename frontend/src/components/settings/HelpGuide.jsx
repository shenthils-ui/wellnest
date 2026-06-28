// A calm, plain-language guide shown inside the app (Settings → How to use).
// Written for the person using WellNest day-to-day on their phone.

function Step({ n, title, children }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
        {n}
      </span>
      <div className="min-w-0">
        <p className="font-medium text-slate-800 dark:text-slate-100">{title}</p>
        <div className="mt-0.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{children}</div>
      </div>
    </div>
  );
}

function Dot({ className }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full align-middle ${className}`} />;
}

export default function HelpGuide() {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        WellNest is meant to be quick and gentle — a minute a day, mostly tapping. There’s no
        wrong way to use it, and nothing here is a test. Here’s the gist.
      </p>

      {/* daily flow */}
      <div>
        <h4 className="section-title mb-2">Your day, in under a minute</h4>
        <div className="space-y-3">
          <Step n="1" title="Tap each routine item as you go">
            Each tap cycles through four states:
            <div className="mt-1.5 space-y-1">
              <div><Dot className="bg-emerald-500" /> <b>Done</b> — finished it.</div>
              <div><Dot className="bg-amber-500" /> <b>Rested</b> — skipped because you were tired. That’s a valid, healthy choice.</div>
              <div><Dot className="bg-rose-400" /> <b>Missed</b> — it slipped your mind.</div>
              <div><Dot className="bg-slate-300" /> <b>Blank</b> — not recorded yet. Tap once more to clear back to this.</div>
            </div>
            The ring at the top fills in as you go — it’s just a gentle gauge, never a grade.
          </Step>
          <Step n="2" title="Note how you’re feeling">
            Under “How are you feeling?”, tap a number from 1–10 for any of the six measures. Skip
            any you don’t want to answer. Feeling shifted later? Tap a new number to log again — the
            day quietly averages your readings.
          </Step>
          <Step n="3" title="Mark therapies & anything worth remembering">
            Tap a weekly therapy chip if you had one today. Add a short note or a cycle-day number
            if useful. Everything saves on its own — there’s no Save button.
          </Step>
        </div>
      </div>

      {/* changing the routine */}
      <div>
        <h4 className="section-title mb-2">Make it yours — add or change items</h4>
        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Your routine will change over time, and the app changes with it. Open
          <b className="text-slate-700 dark:text-slate-200"> Settings → Manage routine</b>.
        </p>
        <div className="mt-2 rounded-xl bg-brand-50/70 px-3.5 py-3 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
          <p className="font-medium text-brand-700 dark:text-brand-300">Example: add “Oil pulling”</p>
          <ol className="mt-1.5 list-decimal space-y-0.5 pl-4">
            <li>Tap <b>Add activity</b>.</li>
            <li>Name it <i>Oil pulling</i>.</li>
            <li>Set <b>Time of day</b> to <i>Early morning</i>.</li>
            <li>(Optional) pick certain weekdays, mark it partner-prepared, or set a reminder.</li>
            <li>Tap <b>Save</b> — it appears on Today right away.</li>
          </ol>
        </div>
        <ul className="mt-2 space-y-1 text-sm text-slate-500 dark:text-slate-400">
          <li>• <b>Rename or reorder</b> anything with the pencil and the up/down arrows.</li>
          <li>• <b>Retire</b> an item you’ve stopped — it leaves Today but keeps its history, and you can restore it anytime.</li>
          <li>• <b>Symptoms tracked</b> works the same way if you want to measure something new.</li>
        </ul>
      </div>

      {/* history */}
      <div>
        <h4 className="section-title mb-2">Fix or fill in any day</h4>
        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          On <b className="text-slate-700 dark:text-slate-200">History</b>, tap any day on the
          calendar to open and edit it — perfect for catching up on a day you missed, or correcting
          a tap. The colours show how full or how you felt; switch what they represent with the
          chips above the calendar.
        </p>
      </div>

      {/* offline + reminders + backup */}
      <div>
        <h4 className="section-title mb-2">Good to know</h4>
        <ul className="space-y-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          <li>
            <b className="text-slate-700 dark:text-slate-200">Works away from home.</b> If you’re out
            and the home computer isn’t reachable, keep tapping — entries are held on your phone and
            sync the moment you’re back on home Wi-Fi. The little cloud at the top shows the status.
          </li>
          <li>
            <b className="text-slate-700 dark:text-slate-200">Reminders are optional & best-effort.</b>
            Set them per item in Manage routine. Phones don’t always deliver web reminders reliably,
            so treat them as a nudge, not a guarantee.
          </li>
          <li>
            <b className="text-slate-700 dark:text-slate-200">Back up weekly.</b> In
            <b className="text-slate-700 dark:text-slate-200"> Backup &amp; export</b>, save a JSON file
            now and then — that’s your safety net, and it restores everything if needed.
          </li>
          <li>
            <b className="text-slate-700 dark:text-slate-200">Private by design.</b> Everything lives
            on your home computer. No accounts, no cloud, no tracking.
          </li>
        </ul>
      </div>

      <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-center text-sm text-slate-500 dark:bg-slate-800/40">
        Be kind to yourself. A skipped day is information, not a failure. 🌿
      </p>
    </div>
  );
}
