import { useState } from 'react';
import Modal from './Modal';
import { TIME_BLOCKS } from '../lib/constants';

// Weekdays shown Monday-first for scheduling; stored as JS numbers (0=Sun).
const WD = [
  { n: 1, l: 'M' }, { n: 2, l: 'T' }, { n: 3, l: 'W' }, { n: 4, l: 'T' },
  { n: 5, l: 'F' }, { n: 6, l: 'S' }, { n: 0, l: 'S' },
];

function parseDays(csv) {
  if (!csv) return [];
  return String(csv).split(',').map(Number).filter((n) => n >= 0 && n <= 6);
}

export default function ActivityEditor({ activity, onSave, onClose, onDelete }) {
  const isNew = !activity;
  const [name, setName] = useState(activity?.name || '');
  const [timeBlock, setTimeBlock] = useState(activity?.time_block || 'MID_MORNING');
  const [husband, setHusband] = useState(!!activity?.is_husband_task);
  const [days, setDays] = useState(parseDays(activity?.expected_days));
  const [remOn, setRemOn] = useState(!!activity?.reminder_enabled);
  const [remTime, setRemTime] = useState(activity?.reminder_time || '08:00');

  const toggleDay = (n) => setDays((d) => (d.includes(n) ? d.filter((x) => x !== n) : [...d, n]));

  const save = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      time_block: timeBlock,
      is_husband_task: husband,
      expected_days: days.length ? days.slice().sort().join(',') : null,
      reminder_enabled: remOn,
      reminder_time: remOn ? remTime : null,
    });
  };

  return (
    <Modal
      title={isNew ? 'New activity' : 'Edit activity'}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          {!isNew && onDelete ? (
            <button onClick={onDelete} className="text-sm font-medium text-rose-500">
              Retire
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-subtle">Cancel</button>
            <button onClick={save} className="btn-primary" disabled={!name.trim()}>Save</button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="section-title mb-1.5 block">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Green juice" autoFocus />
        </div>

        <div>
          <label className="section-title mb-1.5 block">Time of day</label>
          <select className="input" value={timeBlock} onChange={(e) => setTimeBlock(e.target.value)}>
            {TIME_BLOCKS.map((b) => (
              <option key={b.key} value={b.key}>{b.label}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center justify-between rounded-xl bg-white px-3.5 py-3 dark:bg-slate-900">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Partner-prepared task</span>
          <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={husband} onChange={(e) => setHusband(e.target.checked)} />
        </label>

        <div>
          <label className="section-title mb-1.5 block">Expected on</label>
          <div className="flex gap-1.5">
            {WD.map((d) => {
              const on = days.includes(d.n);
              return (
                <button
                  key={d.n}
                  onClick={() => toggleDay(d.n)}
                  className={`flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition ${
                    on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {d.l}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">Leave all unselected for every day.</p>
        </div>

        <div className="rounded-xl bg-white px-3.5 py-3 dark:bg-slate-900">
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Reminder</span>
            <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={remOn} onChange={(e) => setRemOn(e.target.checked)} />
          </label>
          {remOn && (
            <div className="mt-3 flex items-center gap-2">
              <input type="time" className="input w-36" value={remTime} onChange={(e) => setRemTime(e.target.value)} />
              <span className="text-xs text-slate-400">best-effort, see note below</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
