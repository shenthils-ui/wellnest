import { useEffect, useMemo, useState } from 'react';
import { getLibrary, createLibraryEntry, updateLibraryEntry, deleteLibraryEntry } from '../lib/data';
import { toImageUrl } from '../lib/imageLink';
import { prettyDate } from '../lib/date';
import Modal from '../components/Modal';
import { PlusIcon, PencilIcon, PhoneIcon, MapPinIcon, LinkIcon, BookIcon } from '../components/Icons';

const CATS = [
  { key: 'provider', label: 'Contacts', emoji: '📇' },
  { key: 'visit', label: 'Visits', emoji: '🩺' },
  { key: 'tip', label: 'Tips', emoji: '💡' },
  { key: 'recipe', label: 'Recipes', emoji: '🥗' },
];
const CAT_LABEL = Object.fromEntries(CATS.map((c) => [c.key, c.label]));
const bodyLabel = { provider: 'Notes', visit: 'What was said', tip: 'Details', recipe: 'Ingredients & steps', other: 'Notes' };

export default function Library() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(undefined); // undefined=closed, obj/null

  const load = async () => {
    setLoading(true);
    const { rows: r, fromCache } = await getLibrary();
    setRows(r);
    setOffline(fromCache);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const shown = useMemo(
    () => (filter === 'all' ? rows : rows.filter((e) => e.category === filter)),
    [rows, filter]
  );

  const onSave = async (body) => {
    if (editing && editing.id) await updateLibraryEntry(editing.id, body);
    else await createLibraryEntry(body);
    setEditing(undefined);
    load();
  };
  const onDelete = async () => {
    if (editing?.id && window.confirm('Delete this entry?')) {
      await deleteLibraryEntry(editing.id);
      setEditing(undefined);
      load();
    }
  };

  return (
    <div className="animate-fade-in space-y-4 pb-4">
      <div className="flex items-center gap-2 px-1">
        <BookIcon width={20} height={20} className="text-brand-600 dark:text-brand-300" />
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Library</h1>
      </div>
      <p className="-mt-2 px-1 text-sm text-slate-500 dark:text-slate-400">
        Keep contacts, visit notes, tips and recipes here — out of the daily screen.
      </p>

      {/* filter chips */}
      <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3">
        {[{ key: 'all', label: 'All' }, ...CATS].map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              filter === c.key
                ? 'bg-brand-600 text-white shadow-softer'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => setEditing({ category: filter === 'all' ? 'tip' : filter })}
        className="btn-ghost w-full"
      >
        <PlusIcon width={18} height={18} /> Add {filter === 'all' ? 'entry' : CAT_LABEL[filter]?.replace(/s$/, '').toLowerCase()}
      </button>

      {offline && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          Showing a saved copy — connect to your home server to add or edit.
        </p>
      )}

      {loading ? (
        <div className="card h-24 animate-pulse" />
      ) : shown.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-400">
          Nothing here yet. Tap “Add” to save a contact, a visit note, a tip or a recipe.
        </div>
      ) : (
        <div className="space-y-2.5">
          {shown.map((e) => (
            <EntryCard key={e.id} e={e} onEdit={() => setEditing(e)} />
          ))}
        </div>
      )}

      {editing !== undefined && (
        <EntryEditor entry={editing} onSave={onSave} onClose={() => setEditing(undefined)} onDelete={editing?.id ? onDelete : undefined} />
      )}
    </div>
  );
}

function EntryCard({ e, onEdit }) {
  const img = e.image_url ? toImageUrl(e.image_url) : null;
  return (
    <div className="card p-3.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-slate-800 dark:text-brand-300">
              {CAT_LABEL[e.category] || 'Note'}
            </span>
            {e.entry_date && <span className="text-[11px] text-slate-400">{prettyDate(e.entry_date)}</span>}
            {e.pinned ? <span className="text-[11px] text-amber-500">★</span> : null}
          </div>
          <h3 className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{e.title}</h3>
          {e.provider && e.category !== 'provider' && (
            <div className="text-xs text-slate-400">{e.provider}</div>
          )}
        </div>
        <button onClick={onEdit} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-black/5 dark:hover:bg-white/5" aria-label="Edit">
          <PencilIcon width={15} height={15} />
        </button>
      </div>

      {e.body && <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{e.body}</p>}

      {img && (
        <img
          src={img}
          alt={e.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="mt-2 max-h-60 w-full rounded-xl object-cover"
          onError={(ev) => { ev.currentTarget.style.display = 'none'; }}
        />
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {e.contact && (
          <a href={`tel:${e.contact.replace(/\s+/g, '')}`} className="chip-action">
            <PhoneIcon width={13} height={13} /> {e.contact}
          </a>
        )}
        {e.address && (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(e.address)}`} target="_blank" rel="noreferrer" className="chip-action">
            <MapPinIcon width={13} height={13} /> Map
          </a>
        )}
        {e.link && (
          <a href={e.link} target="_blank" rel="noreferrer" className="chip-action">
            <LinkIcon width={13} height={13} /> Open link
          </a>
        )}
      </div>
    </div>
  );
}

function EntryEditor({ entry, onSave, onClose, onDelete }) {
  const isNew = !entry?.id;
  const [category, setCategory] = useState(entry?.category || 'tip');
  const [title, setTitle] = useState(entry?.title || '');
  const [body, setBody] = useState(entry?.body || '');
  const [provider, setProvider] = useState(entry?.provider || '');
  const [contact, setContact] = useState(entry?.contact || '');
  const [address, setAddress] = useState(entry?.address || '');
  const [link, setLink] = useState(entry?.link || '');
  const [imageUrl, setImageUrl] = useState(entry?.image_url || '');
  const [entryDate, setEntryDate] = useState(entry?.entry_date || '');
  const [pinned, setPinned] = useState(!!entry?.pinned);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const showContact = category === 'provider';
  const showProvider = category === 'provider' || category === 'visit';
  const showDate = category === 'visit';
  const showImage = category === 'recipe' || category === 'tip' || category === 'other';

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true); setErr(null);
    try {
      await onSave({
        category, title: title.trim(), body, provider, contact, address, link,
        image_url: imageUrl, entry_date: entryDate || null, pinned,
      });
    } catch {
      setErr('Could not save — are you connected to the home server?');
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isNew ? 'New entry' : 'Edit entry'}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          {onDelete ? <button onClick={onDelete} className="text-sm font-medium text-rose-500">Delete</button> : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-subtle">Cancel</button>
            <button onClick={save} className="btn-primary" disabled={!title.trim() || busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      }
    >
      <div className="space-y-3.5">
        <div>
          <label className="section-title mb-1.5 block">Type</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="section-title mb-1.5 block">{category === 'provider' ? 'Name' : 'Title'}</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
            placeholder={category === 'recipe' ? 'e.g. Beetroot & celery juice' : category === 'provider' ? 'e.g. Dr Mehta' : 'Title'} />
        </div>

        {showDate && (
          <div>
            <label className="section-title mb-1.5 block">Date of visit</label>
            <input type="date" className="input" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
        )}
        {showProvider && (
          <div>
            <label className="section-title mb-1.5 block">Provider / who</label>
            <input className="input" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Doctor · NAET · Hyperbaric · Osteopath" />
          </div>
        )}
        {showContact && (
          <>
            <div>
              <label className="section-title mb-1.5 block">Phone / contact</label>
              <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+1 555 0142" />
            </div>
            <div>
              <label className="section-title mb-1.5 block">Address</label>
              <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Clinic address" />
            </div>
          </>
        )}

        <div>
          <label className="section-title mb-1.5 block">{bodyLabel[category] || 'Notes'}</label>
          <textarea className="input min-h-[96px] resize-y" value={body} onChange={(e) => setBody(e.target.value)}
            placeholder={category === 'recipe' ? 'Ingredients, steps, notes…' : category === 'visit' ? 'What the doctor said, next steps…' : 'Write anything useful…'} />
        </div>

        {showImage && (
          <div>
            <label className="section-title mb-1.5 block">Photo link <span className="font-normal text-slate-400">(optional)</span></label>
            <input className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Paste a Google Drive or image link" />
            <p className="mt-1 text-xs text-slate-400">Upload the photo to Google Drive, share it, and paste the link here.</p>
          </div>
        )}

        <div>
          <label className="section-title mb-1.5 block">Link <span className="font-normal text-slate-400">(optional)</span></label>
          <input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
        </div>

        <label className="flex items-center justify-between rounded-xl bg-white px-3.5 py-3 dark:bg-slate-900">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Pin to top</span>
          <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
        </label>

        {err && <p className="text-sm text-amber-600">{err}</p>}
      </div>
    </Modal>
  );
}
