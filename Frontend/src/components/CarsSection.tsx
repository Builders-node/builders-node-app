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

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/[/.]+$/, '');

/** The bookable window. Slots start on the hour; the last one ends at DAY_END. */
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 22;
/** One member can hold a car for at most this long — mirrored on the server. */
const MAX_HOURS = 3;
/** How far ahead the day strip runs. */
const DAYS_AHEAD = 14;

function toYMD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Local Date for a given day + hour. Local, not UTC — members pick wall-clock times. */
function atHour(ymd: string, hour: number): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
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

export function CarsSection({ currentUserId }: { currentUserId: string }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  useEscapeToClose(isOpen, () => setIsOpen(false));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [day, setDay] = useState(() => toYMD(new Date()));
  const [startHour, setStartHour] = useState<number | null>(null);
  const [hours, setHours] = useState(1);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selected = vehicles.find((v) => v.id === selectedId) ?? null;

  /** The next fortnight, for the day strip. */
  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, []);

  /**
   * Every hour of the chosen day, marked free / taken / past. This is the whole
   * point of the calendar: you can see when the car is out before you pick.
   */
  const slots = useMemo(() => {
    const ranges = (selected?.bookedRanges ?? []).map((r) => ({
      start: new Date(r.startDate).getTime(),
      end: new Date(r.endDate).getTime(),
    }));
    const now = Date.now();
    const out: Array<{ hour: number; taken: boolean; past: boolean }> = [];
    for (let hour = DAY_START_HOUR; hour < DAY_END_HOUR; hour += 1) {
      const s = atHour(day, hour).getTime();
      const e = atHour(day, hour + 1).getTime();
      out.push({
        hour,
        taken: ranges.some((r) => r.start < e && r.end > s),
        past: s < now,
      });
    }
    return out;
  }, [selected, day]);

  /** Durations that fit in the free run after `startHour`, capped at MAX_HOURS. */
  const allowedHours = useMemo(() => {
    if (startHour === null) return [];
    const allowed: number[] = [];
    for (let n = 1; n <= MAX_HOURS; n += 1) {
      if (startHour + n > DAY_END_HOUR) break;
      const covered = slots.filter((s) => s.hour >= startHour && s.hour < startHour + n);
      if (covered.length !== n || covered.some((s) => s.taken || s.past)) break;
      allowed.push(n);
    }
    return allowed;
  }, [startHour, slots]);

  // Picking a new start (or a new day/car) can invalidate the chosen duration.
  useEffect(() => {
    if (allowedHours.length > 0 && !allowedHours.includes(hours)) setHours(allowedHours[0]);
  }, [allowedHours, hours]);

  const payload = useMemo(() => {
    if (startHour === null || allowedHours.length === 0) return null;
    return {
      startISO: atHour(day, startHour).toISOString(),
      endISO: atHour(day, startHour + hours).toISOString(),
    };
  }, [day, startHour, hours, allowedHours]);

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
    setDay(toYMD(new Date()));
    setStartHour(null);
    setHours(1);
    setNote('');
    setSelectedId(vehicles[0]?.id ?? null);
    setIsOpen(true);
  }

  async function submit() {
    setError(null);
    if (!selectedId) return setError('Pick a car.');
    if (!payload) return setError('Pick a free time slot.');
    setSubmitting(true);
    try {
      await apiRequest(`/users/${currentUserId}/vehicle-bookings`, {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: selectedId,
          startDate: payload.startISO,
          endDate: payload.endISO,
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
                <p>Pick a car, then a free slot — up to {MAX_HOURS} hours.</p>
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
                    onChange={() => { setSelectedId(v.id); setStartHour(null); }}
                  />
                  <span className="car-option__media">
                    {v.hasPhoto ? (
                      <img src={`${API_BASE}/public/vehicles/${v.id}/photo`} alt="" />
                    ) : (
                      <span className="car-option__thumb"><Car size={26} /></span>
                    )}
                  </span>
                  <span className="car-option__body">
                    <strong>{v.name}</strong>
                    {v.description ? <span>{v.description}</span> : null}
                  </span>
                </label>
              ))}
            </div>

            {/* Day strip */}
            <div className="cal-days" role="tablist" aria-label="Pick a day">
              {days.map((d) => {
                const ymd = toYMD(d);
                const active = ymd === day;
                return (
                  <button
                    key={ymd}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={active ? 'cal-day cal-day--active' : 'cal-day'}
                    onClick={() => { setDay(ymd); setStartHour(null); }}
                  >
                    <span className="cal-day__dow">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                    <span className="cal-day__num">{d.getDate()}</span>
                  </button>
                );
              })}
            </div>

            {/* Hour grid for the chosen day. Taken slots say who has it, so the
                answer to "when is it free?" is on screen instead of guessed. */}
            <div className="cal-slots" role="group" aria-label="Pick a start time">
              {slots.map((slot) => {
                const disabled = slot.taken || slot.past;
                const active = startHour === slot.hour;
                const covered =
                  startHour !== null && slot.hour > startHour && slot.hour < startHour + hours;
                return (
                  <button
                    key={slot.hour}
                    type="button"
                    disabled={disabled}
                    aria-pressed={active}
                    className={[
                      'cal-slot',
                      slot.taken ? 'cal-slot--taken' : '',
                      slot.past && !slot.taken ? 'cal-slot--past' : '',
                      active ? 'cal-slot--active' : '',
                      covered ? 'cal-slot--covered' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => setStartHour(slot.hour)}
                  >
                    <span className="cal-slot__time">{formatHour(slot.hour)}</span>
                    {slot.taken ? <span className="cal-slot__tag">Booked</span> : null}
                  </button>
                );
              })}
            </div>

            {slots.every((s) => s.taken || s.past) ? (
              <p className="form-hint">Nothing free left on this day — try another.</p>
            ) : null}

            {startHour !== null && allowedHours.length > 0 ? (
              <div className="cal-duration">
                <span className="cal-duration__label">How long?</span>
                <div className="segmented">
                  {allowedHours.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={hours === n ? 'segmented__opt segmented__opt--active' : 'segmented__opt'}
                      onClick={() => setHours(n)}
                    >
                      {n}h
                    </button>
                  ))}
                </div>
                <span className="cal-duration__range">
                  {formatHour(startHour)} – {formatHour(startHour + hours)}
                </span>
              </div>
            ) : null}

            {error ? <p className="form-error">{error}</p> : null}

            <label>Note (optional)<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Anything the team should know…" /></label>

            <button className="primary-button" type="submit" disabled={submitting || !selectedId || !payload}>
              {submitting ? 'Booking…' : 'Book car'}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
