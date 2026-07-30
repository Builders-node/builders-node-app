import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Wrench, X } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { apiRequest } from '../lib/api';
import { useEscapeToClose } from '../lib/useModalA11y';

type Request = {
  id: string;
  category: string;
  title: string;
  description: string;
  status: string;
  adminNote?: string | null;
  photoFileName?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
};

const CATEGORIES = ['General', 'Plumbing', 'Electrical', 'Appliance', 'Furniture', 'Internet', 'Cleaning'];

function statusTone(status: string): 'good' | 'attention' | 'neutral' {
  if (status === 'RESOLVED') return 'good';
  if (status === 'IN_PROGRESS') return 'attention';
  return 'neutral';
}

function statusLabel(status: string): string {
  return status.split('_').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ');
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export function MaintenanceSection({ currentUserId }: { currentUserId: string }) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  // Modal state (form lives here — the card itself is CTA-only).
  const [isOpen, setIsOpen] = useState(false);
  useEscapeToClose(isOpen, () => setIsOpen(false));
  const [category, setCategory] = useState('General');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const data = await apiRequest<Request[]>(`/users/${currentUserId}/maintenance`);
      setRequests(data);
    } catch {
      /* ignore load errors */
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  function resetForm() {
    setCategory('General');
    setTitle('');
    setDescription('');
    setPhoto(null);
    if (fileRef.current) fileRef.current.value = '';
    setError(null);
  }

  function openModal() {
    resetForm();
    setMessage(null);
    setIsOpen(true);
  }

  async function submit() {
    setError(null);
    if (!title.trim() || !description.trim()) {
      setError('Add a title and a description.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { category, title, description };
      if (photo) {
        payload.photoBase64 = await fileToBase64(photo);
        payload.photoFileName = photo.name;
        payload.photoFileType = photo.type;
      }
      await apiRequest(`/users/${currentUserId}/maintenance`, { method: 'POST', body: JSON.stringify(payload) });
      setIsOpen(false);
      resetForm();
      setMessage('Request submitted — our team will take a look.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not submit the request.');
    } finally {
      setSubmitting(false);
    }
  }

  const openCount = requests.filter((r) => r.status !== 'RESOLVED').length;

  return (
    <>
      <section className="compact-section">
        <button className="compact-section__head" onClick={() => setShowList((s) => !s)} aria-expanded={showList}>
          <span className="compact-section__icon"><Wrench size={16} /></span>
          <span className="compact-section__title">Maintenance</span>
          {openCount > 0 ? <span className="compact-section__count">{openCount}</span> : null}
          <span
            className="primary-button compact-button compact-section__cta"
            onClick={(event) => { event.stopPropagation(); openModal(); }}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); openModal(); } }}
          >
            Report
          </span>
        </button>
        {message ? <p className="form-success compact-section__msg">{message}</p> : null}
        {showList && requests.length > 0 ? (
          <div className="maintenance-list compact-section__body">
            {requests.map((r) => (
              <div className="maintenance-item" key={r.id}>
                <div className="maintenance-item__head">
                  <strong>{r.title}</strong>
                  <StatusBadge tone={statusTone(r.status)}>{statusLabel(r.status)}</StatusBadge>
                </div>
                <span className="maintenance-item__meta">{r.category} · {new Date(r.createdAt).toLocaleDateString()}</span>
                <p className="maintenance-item__desc">{r.description}</p>
                {r.adminNote ? <p className="maintenance-item__note">Team: {r.adminNote}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {isOpen ? (
        <div className="modal-overlay" role="presentation" onClick={() => setIsOpen(false)}>
          <form
            className="profile-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Report a maintenance issue"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); void submit(); }}
          >
            <div className="modal-head">
              <div>
                <h2>Report an issue</h2>
                <p>Tell us what's wrong. We'll get on it.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setIsOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="form-grid">
              <label>
                Category
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. AC not cooling" autoFocus /></label>
            </div>
            <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What's wrong, and where in the unit?" rows={4} /></label>
            <label className="maintenance-photo">
              Photo (optional)
              <input ref={fileRef} type="file" accept="image/*" onChange={(event: ChangeEvent<HTMLInputElement>) => setPhoto(event.target.files?.[0] ?? null)} />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
