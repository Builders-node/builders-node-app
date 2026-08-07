import { ConfigService } from '@nestjs/config';
import { ApplicationsService } from './applications.service';
import { moveInDateFromNote, moveInDateOf, parseMoveInDate } from './move-in-date';

/**
 * The arrival date an applicant gave. Meal deliveries are scheduled from it, so
 * a wrong answer here means food at an empty apartment — a wrong month is worse
 * than no answer, and every path below prefers null over a guess.
 */
describe('parseMoveInDate', () => {
  it('reads the form value as a calendar day at UTC midnight', () => {
    expect(parseMoveInDate('2027-01-01')?.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('ignores anything that is not a bare date', () => {
    for (const value of ['', '  ', undefined, null, 'January 2027', '2027-01-01T10:00:00Z', '01/01/2027']) {
      expect(parseMoveInDate(value)).toBeNull();
    }
  });

  it('rejects a well-formed date that does not exist', () => {
    // JS rolls 2027-02-31 forward to March, which would move someone's food a
    // month without anyone noticing.
    expect(parseMoveInDate('2027-02-31')).toBeNull();
  });
});

describe('moveInDateFromNote — applications filed before the column existed', () => {
  const note = ['Move-in: January 1, 2027', 'Stay: 1 month', 'Plan: Private room'].join('\n');

  it('reads the label the form wrote', () => {
    expect(moveInDateFromNote(note)?.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('is not confused by the other lines', () => {
    expect(moveInDateFromNote(['Stay: 1 month', 'Plan: Private room'].join('\n'))).toBeNull();
  });

  it('gives up on a label it cannot parse rather than guessing', () => {
    expect(moveInDateFromNote('Move-in: sometime in the spring')).toBeNull();
    expect(moveInDateFromNote('Move-in:')).toBeNull();
  });

  it('handles a missing note', () => {
    expect(moveInDateFromNote(null)).toBeNull();
    expect(moveInDateFromNote(undefined)).toBeNull();
  });
});

describe('moveInDateOf', () => {
  it('prefers the column over the prose', () => {
    const picked = moveInDateOf({
      moveInDate: new Date('2027-05-01T00:00:00.000Z'),
      note: 'Move-in: January 1, 2027',
    });
    expect(picked?.toISOString()).toBe('2027-05-01T00:00:00.000Z');
  });

  it('falls back to the note when the column is empty', () => {
    expect(moveInDateOf({ moveInDate: null, note: 'Move-in: January 1, 2027' })?.toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    );
  });

  it('returns null when neither is usable', () => {
    expect(moveInDateOf({ moveInDate: null, note: 'Stay: 1 month' })).toBeNull();
  });
});

/** The other half: what the apply form sends actually reaches the column. */
describe('ApplicationsService.apply — move-in date', () => {
  function makeService() {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      application: { create: jest.fn().mockResolvedValue({ id: 'app-1', email: 'ada@builders.test' }) },
    };
    const service = new ApplicationsService(
      prisma as never,
      new ConfigService(),
      {} as never,
      {} as never,
      { notify: async () => {}, notifyAdmins: async () => {} } as never,
    );
    return { service, prisma };
  }

  const base = { fullName: 'Ada Lovelace', email: 'ada@builders.test' };

  it('stores the date the applicant picked', async () => {
    const { service, prisma } = makeService();
    await service.apply({ ...base, moveInDate: '2027-01-01' });
    expect(prisma.application.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ moveInDate: new Date('2027-01-01T00:00:00.000Z') }) }),
    );
  });

  it('accepts an application without one rather than rejecting it', async () => {
    // This comes from a public form; a missing or odd value must not cost
    // someone their application. The note still records what they chose.
    const { service, prisma } = makeService();
    await service.apply({ ...base, moveInDate: 'whenever' });
    expect(prisma.application.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ moveInDate: null }) }),
    );
  });
});
