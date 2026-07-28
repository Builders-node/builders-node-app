import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Wrench } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { apiRequest } from '../lib/api';

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
  const [category, setCategory] = useState('General');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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

  async function submit() {
    setError(null);
    setMessage(null);
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
      setTitle('');
      setDescription('');
      setCategory('General');
      setPhoto(null);
      if (fileRef.current) fileRef.current.value = '';
      setMessage('Request submitted — our team will take a look.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not submit the request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel form-panel">
      <div className="admin-panel__head">
        <div>
          <span className="section-label">Your unit</span>
          <h2>Maintenance</h2>
          <p className="setup-card-copy">Report an issue with your unit — a broken appliance, plumbing, internet, anything.</p>
        </div>
        <Wrench size={20} />
      </div>

      <div className="form-grid">
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. AC not cooling" /></label>
      </div>
      <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What's wrong, and where in the unit?" rows={3} /></label>
      <label className="maintenance-photo">
        Photo (optional)
        <input ref={fileRef} type="file" accept="image/*" onChange={(event: ChangeEvent<HTMLInputElement>) => setPhoto(event.target.files?.[0] ?? null)} />
      </label>
      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <button className="primary-button" disabled={submitting} onClick={() => void submit()}>
        {submitting ? 'Submitting…' : 'Submit request'}
      </button>

      {requests.length > 0 ? (
        <div className="maintenance-list">
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
  );
}
