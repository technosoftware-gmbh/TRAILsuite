/**
 * Which part of the day a meeting falls in, and which days are working days.
 *
 * **The bands are back, and this time the data supports them.** They were
 * argued against when the week listed tasks: a task carries `due` or
 * `scheduled` and both are days, so a morning/afternoon split over tasks was
 * drawn furniture. A meeting carries a clock. The same shape that was
 * dishonest about tasks is exactly right about appointments.
 *
 * Times are `HH:MM` strings compared as strings, which works only once they
 * are padded -- `9:00` sorts after `12:00` and would put every early meeting
 * in the afternoon. `parseScheduleLine` accepts `\\d{1,2}:\\d{2}`, so an
 * unpadded hour is a thing somebody really can type, and normalising is not
 * defensive coding but the format doing what it said.
 */
import { parseDayTitle } from 'trail-core';

export type Band = 'morning' | 'lunch' | 'afternoon';

/** `9:00` to `09:00`, so string comparison means what it looks like. Anything unparseable comes back unchanged and sorts wherever it sorts. */
export function normalizeTime(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return value.trim();
  return `${(match[1] ?? '').padStart(2, '0')}:${match[2]}`;
}

/**
 * The band a meeting starting at `from` belongs to.
 *
 * **By when it starts, not by how much of it lands where.** A meeting from
 * 10:00 to 14:00 is a morning meeting that ran long; showing it under
 * Nachmittag because it ended there would put it below things it began before.
 * The band answers "when do I have to be somewhere", and that is the start.
 *
 * **A blank or inverted window needs no special case, and it had one.** The
 * first draft guarded `end <= start` and returned early; breaking that guard on
 * purpose changed no answer, because the ordering below already handles it. If
 * `end < start` then anything at or past `start` is also past `end`, so the
 * lunch branch cannot fire; if either is blank, every real time sorts after it
 * and everything is afternoon. The guard was three conditions restating what
 * the next two lines already say. It is gone; the tests that describe the
 * behaviour stay, because the behaviour is still a promise even when nothing
 * special is done to keep it.
 */
export function bandOf(from: string, lunchStart: string, lunchEnd: string): Band {
  const at = normalizeTime(from);
  const start = normalizeTime(lunchStart);
  const end = normalizeTime(lunchEnd);

  if (at < start) return 'morning';
  return at < end ? 'lunch' : 'afternoon';
}

/**
 * Monday to Friday.
 *
 * Fixed rather than configurable, and that is a limit worth naming: somebody
 * working Sunday to Thursday gets the wrong five days. The setting this serves
 * is a yes/no about the working week, not a description of one, and a full
 * week is one click away for anyone that answer does not fit.
 */
export function isWorkday(iso: string): boolean {
  const date = parseDayTitle(iso);
  if (date === null) return false;
  const weekday = date.getDay();
  return weekday >= 1 && weekday <= 5;
}
