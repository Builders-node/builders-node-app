/**
 * Formatting for dates that are calendar days rather than moments.
 *
 * Move-in dates, meal start dates and invoice due dates are stored at UTC
 * midnight — the server pins them there on purpose, so "15 January" means the
 * 15th everywhere and not an instant that lands differently per reader.
 *
 * Rendering one of those with a plain `toLocaleDateString()` re-interprets it in
 * the viewer's zone, which subtracts a day for anyone west of UTC. Próspera is
 * UTC−6, so this was wrong for the people the product is actually for: an admin
 * setting deliveries for the 15th showed the member "January 14".
 *
 * Use these for anything the backend treats as a day. For real timestamps —
 * when a message was sent, when a booking starts — local time is correct and
 * these are the wrong tool.
 */

type DayInput = string | Date | null | undefined;

function toDate(value: DayInput): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Short form — "15 Jan 2027". Empty string when there's no date. */
export function formatCalendarDay(value: DayInput, fallback = ''): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Long form — "15 January". Used where the year is already obvious. */
export function formatCalendarDayLong(value: DayInput, fallback = ''): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', timeZone: 'UTC' });
}
