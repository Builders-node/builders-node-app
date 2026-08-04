import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { apiRequest } from '../lib/api';

type RsvpStatus = 'GOING' | 'MAYBE' | 'DECLINED';

type CommunityEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  capacity: number | null;
  goingCount: number;
  spotsLeft: number | null;
  myRsvp: RsvpStatus | null;
};

const RSVP_OPTIONS: Array<{ value: RsvpStatus; label: string }> = [
  { value: 'GOING', label: 'Going' },
  { value: 'MAYBE', label: 'Maybe' },
  { value: 'DECLINED', label: "Can't" },
];

function formatWhen(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const time = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (!endsAt) return time;
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  const endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return sameDay
    ? `${time} – ${endTime}`
    : `${time} → ${end.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${endTime}`;
}

function EventCard({
  event,
  onRsvp,
  busy,
  past,
}: {
  event: CommunityEvent;
  onRsvp: (id: string, status: RsvpStatus) => void;
  busy: boolean;
  past?: boolean;
}) {
  const start = new Date(event.startsAt);
  const full = event.spotsLeft === 0 && event.myRsvp !== 'GOING';

  return (
    <article className={past ? 'event-card event-card--past' : 'event-card'}>
      <div className="event-card__date" aria-hidden="true">
        <span>{start.toLocaleDateString([], { month: 'short' })}</span>
        <strong>{start.getDate()}</strong>
      </div>

      <div className="event-card__body">
        <strong className="event-card__title">{event.title}</strong>
        <div className="event-card__meta">
          <span><CalendarDays size={12} /> {formatWhen(event.startsAt, event.endsAt)}</span>
          {event.location ? <span><MapPin size={12} /> {event.location}</span> : null}
          <span>
            <Users size={12} /> {event.goingCount} going
            {event.spotsLeft !== null ? ` · ${event.spotsLeft} left` : ''}
          </span>
        </div>
        {event.description ? <p className="event-card__desc">{event.description}</p> : null}

        {!past ? (
          <div className="event-rsvp" role="group" aria-label={`RSVP to ${event.title}`}>
            {RSVP_OPTIONS.map((option) => {
              const active = event.myRsvp === option.value;
              // Only GOING is capacity-limited; you can always say maybe/can't.
              const blocked = option.value === 'GOING' && full;
              return (
                <button
                  key={option.value}
                  className={active ? 'event-rsvp__btn event-rsvp__btn--active' : 'event-rsvp__btn'}
                  onClick={() => onRsvp(event.id, option.value)}
                  disabled={busy || blocked}
                  title={blocked ? 'This event is full' : undefined}
                >
                  {option.label}
                </button>
              );
            })}
            {full ? <span className="event-card__full">Full</span> : null}
          </div>
        ) : (
          event.myRsvp === 'GOING' ? <span className="event-card__attended">You attended</span> : null
        )}
      </div>
    </article>
  );
}

export function EventsTab() {
  const [upcoming, setUpcoming] = useState<CommunityEvent[]>([]);
  const [past, setPast] = useState<CommunityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<{ upcoming: CommunityEvent[]; past: CommunityEvent[] }>('/events');
      setUpcoming(data.upcoming);
      setPast(data.past);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load events.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function rsvp(eventId: string, status: RsvpStatus) {
    setBusyId(eventId);
    try {
      const data = await apiRequest<{ upcoming: CommunityEvent[]; past: CommunityEvent[] }>(
        `/events/${eventId}/rsvp`,
        { method: 'POST', body: JSON.stringify({ status }) },
      );
      setUpcoming(data.upcoming);
      setPast(data.past);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your RSVP.');
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) return <section className="panel"><p>Loading events…</p></section>;

  return (
    <>
      {error ? <section className="panel"><p className="form-error">{error}</p></section> : null}

      {upcoming.length === 0 ? (
        <section className="panel empty-state">
          Nothing scheduled right now — check back soon.
        </section>
      ) : (
        <div className="event-list">
          {upcoming.map((event) => (
            <EventCard key={event.id} event={event} onRsvp={rsvp} busy={busyId === event.id} />
          ))}
        </div>
      )}

      {past.length > 0 ? (
        <section className="panel">
          <button className="text-button" onClick={() => setShowPast((open) => !open)} style={{ padding: 0 }}>
            {showPast ? 'Hide' : 'Show'} past events ({past.length})
          </button>
          {showPast ? (
            <div className="event-list" style={{ marginTop: 12 }}>
              {past.map((event) => (
                <EventCard key={event.id} event={event} onRsvp={rsvp} busy={false} past />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
