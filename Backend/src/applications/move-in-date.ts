/**
 * When an applicant said they're arriving.
 *
 * Two shapes exist. New applications carry it as a real column, sent by the
 * form as YYYY-MM-DD. Everything filed before that only has it inside the
 * flattened `note` blob as an English label ("Move-in: January 1, 2027"), so
 * that's read back rather than left as prose an admin has to retype.
 */

/** The form's own value: a bare calendar day, pinned to UTC midnight. */
export function parseMoveInDate(value?: string | null): Date | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  // A well-formed string can still be an impossible day ("2027-02-31"), and
  // JS rolls those forward silently — reject rather than invent a date.
  if (Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(trimmed)) return null;
  return parsed;
}

/**
 * The label the form wrote into `note`, for applications that predate the
 * column. Deliberately narrow: only the "Move-in:" line, only a date the
 * runtime can parse on its own, and only the date part — a guess here would
 * schedule someone's food for the wrong month.
 */
export function moveInDateFromNote(note?: string | null): Date | null {
  const line = note?.split('\n').find((row) => row.trim().toLowerCase().startsWith('move-in:'));
  if (!line) return null;
  const label = line.slice(line.indexOf(':') + 1).trim();
  if (!label) return null;
  const parsed = new Date(`${label} UTC`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parseMoveInDate(parsed.toISOString().slice(0, 10));
}

/** Structured value first, the old prose only as a fallback. */
export function moveInDateOf(application: { moveInDate?: Date | null; note?: string | null }): Date | null {
  return application.moveInDate ?? moveInDateFromNote(application.note);
}
