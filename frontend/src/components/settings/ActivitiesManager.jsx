import { useEffect, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { apiGet } from '../../lib/net';
import {
  createActivity,
  updateActivity,
  deleteActivity,
  reorderActivities,
} from '../../lib/data';
import ActivityEditor from '../ActivityEditor';
import { TIME_BLOCK_LABEL } from '../../lib/constants';
import { PlusIcon, PencilIcon, BellIcon, ChevronLeft, ChevronRight } from '../Icons';

export default function ActivitiesManager() {
  const { refreshCatalog } = useApp();
  const [all, setAll] = useState([]);
  const [editing, setEditing] = useState(undefined); // undefined=closed, null=new, obj=edit
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    try {
      const rows = await apiGet('/api/activities?includeInactive=1');
      setAll(rows);
      setErr(null);
    } catch {
      setErr('Managing the routine needs your home server.');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const active = all
    .filter((a) => a.active)
    .sort((a, b) => a.display_order - b.display_order || a.id - b.id);
  const retired = all.filter((a) => !a.active);

  const afterChange = async () => {
    await load();
    await refreshCatalog();
  };

  const onSave = async (body) => {
    try {
      if (editing) await updateActivity(editing.id, body);
      else await createActivity(body);
      setEditing(undefined);
      afterChange();
    } catch {
      setErr('Could not save — are you connected to the home server?');
    }
  };

  const onRetire = async () => {
    if (!editing) return;
    await deleteActivity(editing.id); // soft retire
    setEditing(undefined);
    afterChange();
  };

  const restore = async (a) => {
    await updateActivity(a.id, { active: true });
    afterChange();
  };

  // move within the same time block, then persist the full block-grouped order
  const move = async (activity, dir) => {
    const block = active.filter((a) => a.time_block === activity.time_block);
    const idx = block.findIndex((a) => a.id === activity.id);
    const target = idx + dir;
    if (target < 0 || target >= block.length) return;
    [block[idx], block[target]] = [block[target], block[idx]];

    // group all active ids by block, swap in this block's new order, flatten
    const grouped = {};
    for (const a of active) (grouped[a.time_block] || (grouped[a.time_block] = [])).push(a.id);
    grouped[activity.time_block] = block.map((a) => a.id);
    const flat = [];
    const seen = new Set();
    for (const a of active) {
      if (seen.has(a.time_block)) continue;
      seen.add(a.time_block);
      flat.push(...grouped[a.time_block]);
    }

    // optimistic reindex
    const orderIndex = new Map(flat.map((id, i) => [id, i]));
    setAll((prev) =>
      prev.map((a) => (orderIndex.has(a.id) ? { ...a, display_order: orderIndex.get(a.id) } : a))
    );
    try {
      await reorderActivities(flat);
      afterChange();
    } catch {
      load();
    }
  };

  if (err) return <p className="px-1 py-2 text-sm text-amber-600">{err}</p>;

  // group active by block for display
  const blocks = [];
  for (const a of active) {
    let g = blocks.find((b) => b.key === a.time_block);
    if (!g) blocks.push((g = { key: a.time_block, items: [] }));
    g.items.push(a);
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setEditing(null)} className="btn-ghost w-full">
        <PlusIcon width={18} height={18} /> Add activity
      </button>

      {blocks.map((b) => (
        <div key={b.key}>
          <div className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {TIME_BLOCK_LABEL[b.key]}
          </div>
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {b.items.map((a, i) => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="flex flex-col">
                  <button onClick={() => move(a, -1)} disabled={i === 0} className="text-slate-300 disabled:opacity-30 dark:text-slate-600" aria-label="Move up">
                    <ChevronLeft width={16} height={16} className="rotate-90" />
                  </button>
                  <button onClick={() => move(a, 1)} disabled={i === b.items.length - 1} className="text-slate-300 disabled:opacity-30 dark:text-slate-600" aria-label="Move down">
                    <ChevronRight width={16} height={16} className="rotate-90" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{a.name}</span>
                    {a.reminder_enabled ? <BellIcon width={13} height={13} className="flex-shrink-0 text-brand-500" /> : null}
                  </div>
                  <div className="flex gap-1.5">
                    {a.is_husband_task ? <span className="text-[11px] text-brand-600 dark:text-brand-300">partner</span> : null}
                    {a.expected_days ? <span className="text-[11px] text-slate-400">some days</span> : null}
                    {a.reminder_time && a.reminder_enabled ? <span className="text-[11px] text-slate-400">⏰ {a.reminder_time}</span> : null}
                  </div>
                </div>
                <button onClick={() => setEditing(a)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-black/5 dark:hover:bg-white/5" aria-label="Edit">
                  <PencilIcon width={16} height={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {retired.length > 0 && (
        <div>
          <div className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Retired ({retired.length})
          </div>
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {retired.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2.5">
                <span className="truncate text-sm text-slate-500">{a.name}</span>
                <button onClick={() => restore(a)} className="text-sm font-medium text-brand-600 dark:text-brand-300">Restore</button>
              </div>
            ))}
          </div>
          <p className="mt-1 px-1 text-xs text-slate-400">Retired items keep their history.</p>
        </div>
      )}

      {editing !== undefined && (
        <ActivityEditor
          activity={editing}
          onSave={onSave}
          onClose={() => setEditing(undefined)}
          onDelete={editing ? onRetire : undefined}
        />
      )}
    </div>
  );
}
