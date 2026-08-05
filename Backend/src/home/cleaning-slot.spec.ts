import { nextOccurrence, WEEKDAY_NAMES } from './home.service';

/**
 * The weekly slot is stored as weekday + time; the date it lands on is worked
 * out on read. These pin the edges — same-day before/after the slot, wrap-around
 * past Sunday, and the fact that the time means the residence's clock (UTC-6),
 * not the caller's.
 */

/** 15:00 UTC on the given date = 09:00 at the residence. */
const at = (iso: string) => new Date(iso);
const residenceHour = (d: Date) => new Date(d.getTime() - 6 * 3600_000).getUTCHours();

describe('nextOccurrence', () => {
  it('lands on the chosen weekday', () => {
    // Wednesday 2026-08-05, 12:00 UTC (06:00 residence).
    const next = nextOccurrence(1 /* Monday */, '09:00', at('2026-08-05T12:00:00Z'));
    expect(new Date(next.getTime() - 6 * 3600_000).getUTCDay()).toBe(1);
    expect(WEEKDAY_NAMES[1]).toBe('Monday');
  });

  it('uses the residence clock, not UTC', () => {
    const next = nextOccurrence(1, '09:00', at('2026-08-05T12:00:00Z'));
    expect(residenceHour(next)).toBe(9);
    // 09:00 at UTC-6 is 15:00 UTC.
    expect(next.toISOString()).toContain('T15:00:00');
  });

  it('keeps today when the slot is still ahead', () => {
    // Wednesday 06:00 residence (12:00 UTC), slot Wednesday 09:00 → today.
    const next = nextOccurrence(3 /* Wednesday */, '09:00', at('2026-08-05T12:00:00Z'));
    expect(next.toISOString().slice(0, 10)).toBe('2026-08-05');
  });

  it('rolls to next week when today’s slot has already passed', () => {
    // Wednesday 20:00 UTC = 14:00 residence, slot Wednesday 09:00 → gone.
    const next = nextOccurrence(3, '09:00', at('2026-08-05T20:00:00Z'));
    expect(next.toISOString().slice(0, 10)).toBe('2026-08-12');
  });

  it('treats the slot as passed at exactly the slot time', () => {
    // Exactly 09:00 residence on the chosen day — the cleaner is at the door,
    // so the *next* one is a week out.
    const next = nextOccurrence(3, '09:00', at('2026-08-05T15:00:00Z'));
    expect(next.toISOString().slice(0, 10)).toBe('2026-08-12');
  });

  it('wraps around the end of the week', () => {
    // Friday, asking for Monday.
    const next = nextOccurrence(1, '11:00', at('2026-08-07T12:00:00Z'));
    expect(next.toISOString().slice(0, 10)).toBe('2026-08-10');
  });

  it('handles Sunday, which is weekday 0', () => {
    const next = nextOccurrence(0, '13:00', at('2026-08-05T12:00:00Z'));
    expect(new Date(next.getTime() - 6 * 3600_000).getUTCDay()).toBe(0);
    expect(next.toISOString().slice(0, 10)).toBe('2026-08-09');
  });

  it('always returns a future instant', () => {
    const now = at('2026-08-05T12:00:00Z');
    for (let weekday = 0; weekday < 7; weekday += 1) {
      for (const slot of ['09:00', '13:00', '17:00']) {
        expect(nextOccurrence(weekday, slot, now).getTime()).toBeGreaterThan(now.getTime());
      }
    }
  });
});
