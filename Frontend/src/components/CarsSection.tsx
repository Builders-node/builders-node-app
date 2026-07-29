import { useEffect, useMemo, useState } from 'react';
import { Car, X } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { apiRequest } from '../lib/api';
import { useEscapeToClose } from '../lib/useModalA11y';

type Vehicle = {
  id: string;
  name: string;
  description?: string | null;
  hasPhoto: boolean;
  bookedRanges: Array<{ startDate: string; endDate: string }>;
};

type Booking = {
  id: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  status: string;
  vehicle: { id: string; name: string };
};

function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return s.toDateString() === e.toDateString()
    ? s.toLocaleDateString(undefined, opts)
    : `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

// True if the requested [start,end] overlaps any of the vehicle's active ranges.
function overlaps(vehicle: Vehicle | null, start: string, end: string): boolean {
  if (!vehicle || !start || !end) return false;
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  return vehicle.bookedRanges.some((range) => {
    const rs = new Date(range.startDate).getTime();
    const re = new Date(range.endDate).getTime();
    return rs <= e && re >= s;
  });
}

export function CarsSection({ currentUserId }: { currentUserId: string }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  useEscapeToClose(isOpen, () => setIsOpen(false));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const today = useMemo(() => toYMD(new Date()), []);
  const selected = vehicles.find((v) => v.id === selectedId) ?? null;
  const conflict = overlaps(selected, startDate, endDate);

  async function load() {
    try {
      const [vs, bs] = await Promise.all([
        apiRequest<Vehicle[]>('/vehicles'),
        apiRequest<Booking[]>(`/users/${currentUserId}/vehicle-bookings`),
      ]);
      setVehicles(vs);
      setBookings(bs);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  function openModal() {
    setError(null);
    setMessage(null);
    setStartDate('');
    setEndDate('');
    setNote('');
    setSelectedId(vehicles[0]?.id ?? null);
    setIsOpen(true);
  }

  async function submit() {
    setError(null);
    if (!selectedId) return setError('Pick a car.');
    if (!startDate || !endDate) return setError('Pick both dates.');
    if (endDate < startDate) return setError('End date must be on or after the start date.');
    if (conflict) return setError('Those dates overlap another booking. Pick a different range.');
    setSubmitting(true);
    try {
      await apiRequest(`/users/${currentUserId}/vehicle-bookings`, {
        method: 'POST',
        body: JSON.stringify({ vehicleId: selectedId, startDate, endDate, note }),
      });
      setIsOpen(false);
      setMessage('Booked! Enjoy the ride.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not book — try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(bookingId: string) {
    try {
      await apiRequest(`/users/${currentUserId}/vehicle-bookings/${bookingId}`, { method: 'DELETE' });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not cancel.');
    }
  }

  return (
    <>
      <section className="panel form-panel">
        <div className="admin-panel__head">
          <div>
            <span className="section-label">Community</span>
            <h2>Cars</h2>
            <p className="setup-card-copy">Rent a community car for a day or a week — free for members.</p>
          </div>
          <Car size={20} />
        </div>
        {message ? <p className="form-success">{message}</p> : null}
        <button className="primary-button" onClick={openModal} disabled={vehicles.length === 0}>
          {vehicles.length === 0 ? 'No cars available yet' : 'Rent a car'}
        </button>

        {bookings.length > 0 ? (
          <div className="maintenance-list">
            {bookings.map((b) => (
              <div className="maintenance-item" key={b.id}>
                <div className="maintenance-item__head">
                  <strong>{b.vehicle.name}</strong>
                  <StatusBadge tone={b.status === 'CANCELLED' ? 'neutral' : 'good'}>
                    {b.status === 'CANCELLED' ? 'Cancelled' : 'Booked'}
                  </StatusBadge>
                </div>
                <span className="maintenance-item__meta">{formatRange(b.startDate, b.endDate)}</span>
                {b.status !== 'CANCELLED' ? (
                  <button className="ghost-button compact-button" onClick={() => void cancel(b.id)} style={{ alignSelf: 'flex-start', marginTop: 6 }}>
                    Cancel
                  </button>
                ) : null}
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
            aria-label="Rent a car"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); void submit(); }}
          >
            <div className="modal-head">
              <div>
                <h2>Rent a car</h2>
                <p>Pick a car and the dates you need it.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setIsOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="car-picker">
              {vehicles.map((v) => (
                <label key={v.id} className={selectedId === v.id ? 'car-option car-option--active' : 'car-option'}>
                  <input
                    type="radio"
                    name="vehicle"
                    value={v.id}
                    checked={selectedId === v.id}
                    onChange={() => setSelectedId(v.id)}
                  />
                  {v.hasPhoto ? (
                    <img src={`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'}/vehicles/${v.id}/photo`} alt={v.name} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="car-option__thumb"><Car size={22} /></div>
                  )}
                  <div className="car-option__body">
                    <strong>{v.name}</strong>
                    {v.description ? <span>{v.description}</span> : null}
                  </div>
                </label>
              ))}
            </div>

            <div className="form-grid">
              <label>Start date<input type="date" value={startDate} min={today} onChange={(event) => setStartDate(event.target.value)} /></label>
              <label>End date<input type="date" value={endDate} min={startDate || today} onChange={(event) => setEndDate(event.target.value)} /></label>
            </div>

            {selected && selected.bookedRanges.length > 0 ? (
              <div className="car-booked">
                <strong>Already booked</strong>
                <ul>
                  {selected.bookedRanges.map((r, idx) => (
                    <li key={idx}>{formatRange(r.startDate, r.endDate)}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {conflict ? <p className="form-error">Those dates overlap another booking.</p> : null}
            {error ? <p className="form-error">{error}</p> : null}

            <label>Note (optional)<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Anything the team should know…" /></label>

            <button className="primary-button" type="submit" disabled={submitting || conflict || !selectedId || !startDate || !endDate}>
              {submitting ? 'Booking…' : 'Book car'}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
