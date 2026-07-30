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

// Same-day booking that spans <24h → show times; otherwise show a date range.
function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const dateOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  const sameDay = s.toDateString() === e.toDateString();
  const spansLessThanADay = e.getTime() - s.getTime() < 23 * 3600 * 1000;
  if (sameDay && spansLessThanADay) {
    return `${s.toLocaleDateString(undefined, dateOpts)}, ${s.toLocaleTimeString(undefined, timeOpts)} – ${e.toLocaleTimeString(undefined, timeOpts)}`;
  }
  return sameDay
    ? s.toLocaleDateString(undefined, dateOpts)
    : `${s.toLocaleDateString(undefined, dateOpts)} – ${e.toLocaleDateString(undefined, dateOpts)}`;
}

// True if the requested [start,end] overlaps any of the vehicle's active ranges.
function overlaps(vehicle: Vehicle | null, startISO: string, endISO: string): boolean {
  if (!vehicle || !startISO || !endISO) return false;
  const s = new Date(startISO).getTime();
  const e = new Date(endISO).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return false;
  return vehicle.bookedRanges.some((range) => {
    const rs = new Date(range.startDate).getTime();
    const re = new Date(range.endDate).getTime();
    return rs < e && re > s;
  });
}

export function CarsSection({ currentUserId }: { currentUserId: string }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  useEscapeToClose(isOpen, () => setIsOpen(false));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'hours' | 'days'>('days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hourDate, setHourDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const today = useMemo(() => toYMD(new Date()), []);
  const selected = vehicles.find((v) => v.id === selectedId) ?? null;

  // Build the ISO instants the backend will actually receive. In "days" mode
  // we send bare YYYY-MM-DD; in "hours" mode we send full local datetimes and
  // let the browser attach the local offset before converting to ISO.
  const payload = useMemo(() => {
    if (mode === 'days') {
      if (!startDate || !endDate) return null;
      const endInst = new Date(`${endDate}T23:59:59.999Z`).toISOString();
      const startInst = new Date(`${startDate}T00:00:00.000Z`).toISOString();
      return { startISO: startInst, endISO: endInst, startPayload: startDate, endPayload: endDate };
    }
    if (!hourDate || !startTime || !endTime) return null;
    const s = new Date(`${hourDate}T${startTime}`);
    const e = new Date(`${hourDate}T${endTime}`);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
    return { startISO: s.toISOString(), endISO: e.toISOString(), startPayload: s.toISOString(), endPayload: e.toISOString() };
  }, [mode, startDate, endDate, hourDate, startTime, endTime]);

  const conflict = payload ? overlaps(selected, payload.startISO, payload.endISO) : false;

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
    setMode('days');
    setStartDate('');
    setEndDate('');
    setHourDate('');
    setStartTime('');
    setEndTime('');
    setNote('');
    setSelectedId(vehicles[0]?.id ?? null);
    setIsOpen(true);
  }

  async function submit() {
    setError(null);
    if (!selectedId) return setError('Pick a car.');
    if (!payload) {
      return setError(mode === 'days' ? 'Pick both dates.' : 'Pick the date and start / end times.');
    }
    if (new Date(payload.endISO).getTime() <= new Date(payload.startISO).getTime()) {
      return setError(mode === 'days' ? 'End date must be on or after the start date.' : 'End time must be after the start time.');
    }
    if (conflict) return setError('That overlaps another booking. Pick a different slot.');
    setSubmitting(true);
    try {
      await apiRequest(`/users/${currentUserId}/vehicle-bookings`, {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: selectedId,
          startDate: payload.startPayload,
          endDate: payload.endPayload,
          note,
        }),
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

  const activeCount = bookings.filter((b) => b.status !== 'CANCELLED').length;
  const noCars = vehicles.length === 0;

  return (
    <>
      <section className="compact-section">
        <button className="compact-section__head" onClick={() => setShowList((s) => !s)} aria-expanded={showList}>
          <span className="compact-section__icon"><Car size={16} /></span>
          <span className="compact-section__title">Cars</span>
          {activeCount > 0 ? <span className="compact-section__count">{activeCount}</span> : null}
          <span
            className={`primary-button compact-button compact-section__cta${noCars ? ' compact-section__cta--disabled' : ''}`}
            onClick={(event) => { if (noCars) return; event.stopPropagation(); openModal(); }}
            role="button"
            tabIndex={noCars ? -1 : 0}
            aria-disabled={noCars}
            onKeyDown={(event) => { if (!noCars && (event.key === 'Enter' || event.key === ' ')) { event.stopPropagation(); openModal(); } }}
          >
            {noCars ? 'None yet' : 'Rent'}
          </span>
        </button>
        {message ? <p className="form-success compact-section__msg">{message}</p> : null}
        {showList && bookings.length > 0 ? (
          <div className="maintenance-list compact-section__body">
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

            <div className="segmented" role="tablist" aria-label="Booking length">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'hours'}
                className={mode === 'hours' ? 'segmented__opt segmented__opt--active' : 'segmented__opt'}
                onClick={() => setMode('hours')}
              >
                By hours
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'days'}
                className={mode === 'days' ? 'segmented__opt segmented__opt--active' : 'segmented__opt'}
                onClick={() => setMode('days')}
              >
                By days
              </button>
            </div>

            {mode === 'days' ? (
              <div className="form-grid">
                <label>Start date<input type="date" value={startDate} min={today} onChange={(event) => setStartDate(event.target.value)} /></label>
                <label>End date<input type="date" value={endDate} min={startDate || today} onChange={(event) => setEndDate(event.target.value)} /></label>
              </div>
            ) : (
              <>
                <label>Date<input type="date" value={hourDate} min={today} onChange={(event) => setHourDate(event.target.value)} /></label>
                <div className="form-grid">
                  <label>Start time<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
                  <label>End time<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
                </div>
              </>
            )}

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

            <button className="primary-button" type="submit" disabled={submitting || conflict || !selectedId || !payload}>
              {submitting ? 'Booking…' : 'Book car'}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
