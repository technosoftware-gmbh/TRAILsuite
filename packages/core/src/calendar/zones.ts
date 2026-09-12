/**
 * Reading a calendar's clock in the zone the vault keeps its day notes in.
 *
 * An `.ics` states a time in one of three ways, and until this existed the
 * importer read all three the same way -- it copied the digits. That is right
 * for exactly one of them.
 *
 * - `20260911T060000Z` is an **instant**, in UTC. Copying the digits writes
 *   `06:00` into a note in Zurich, where it happened at eight. The size of the
 *   error follows daylight saving, so it is two hours in July and one in
 *   January, which is why it does not look like a constant offset and did not
 *   get noticed.
 * - `TZID=America/New_York:20260911T080000` is a wall clock **in that zone**.
 *   Copying the digits writes an eight o'clock meeting that happened at two in
 *   the afternoon here.
 * - `20260911T080000` with no zone and no `Z` is a **floating** time: eight
 *   o'clock wherever you are. Copying the digits is correct, and it is the only
 *   case where it is.
 *
 * A late instant also lands on the wrong **day**: 23:00 UTC on the 11th is one
 * in the morning on the 12th in Zurich, and a meeting written into the 11th's
 * note is in a note nobody will look at for it.
 *
 * ## Why here
 *
 * Zone arithmetic describes the world rather than a product, which is this
 * package's third test for admission, and it decides what a meeting line says,
 * which is the second. It is also the kind of thing that is wrong in a way
 * nobody sees: a meeting two hours early still reads as a meeting.
 *
 * **The zone is always an argument.** Nothing here asks the runtime what zone
 * it is in, for the same reason nothing here calls `new Date()`: a function
 * that consults the machine cannot be tested against the machine it will run
 * on. `Intl` is used for the zone table itself, which is a standard built-in
 * and not a host.
 */
import type { IcsMoment } from './ics.js';

/** The parts of a wall clock, as numbers. */
interface Clock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

/**
 * A formatter per zone, kept.
 *
 * `Intl.DateTimeFormat` is expensive to construct and an import expands
 * thousands of occurrences, each of which asks about a zone twice. The map is
 * keyed by the zone name and never invalidated, because a zone's rules do not
 * change while a plugin is running.
 */
function formatterFor(zone: string): Intl.DateTimeFormat | null {
  const held = FORMATTERS.get(zone);
  if (held) return held;

  try {
    const made = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    FORMATTERS.set(zone, made);
    return made;
  } catch {
    // An unknown zone. `RangeError` from a name a calendar made up is not a
    // reason to fail an import of three thousand events, and the caller's
    // fallback -- leave the clock as the file wrote it -- is exactly the
    // behaviour everything had before this file existed.
    return null;
  }
}

/** The wall clock a zone shows at an instant, or null when the zone is not one. */
function clockAt(zone: string, instant: number): Clock | null {
  const formatter = formatterFor(zone);
  if (!formatter) return null;

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(instant))) parts[part.type] = part.value;

  const clock = {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // `h23` still renders midnight as 24 in some engines, and 24:00 on the 11th
    // is 00:00 on the 12th, which the arithmetic below then gets right anyway
    // because it goes through `Date.UTC`.
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
  return Object.values(clock).some((one) => Number.isNaN(one)) ? null : clock;
}

/** The offset of a zone at an instant, in minutes east of UTC. */
function offsetAt(zone: string, instant: number): number | null {
  const clock = clockAt(zone, instant);
  if (!clock) return null;

  const asUtc = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute);
  // Rounded to the minute: `instant` may carry seconds this never formatted,
  // and an offset is a whole number of minutes in every zone there has ever
  // been.
  return Math.round((asUtc - instant) / 60_000);
}

/**
 * The instant a wall clock in a zone names.
 *
 * Two passes, and the second is not decoration. The first guess reads the
 * clock as if it were UTC and subtracts the offset in force *at that guess*,
 * which is an hour out whenever the guess and the answer fall on opposite
 * sides of a daylight-saving change -- so twice a year, for the hours around
 * it. The second pass measures the offset at the corrected instant and applies
 * it to the original clock.
 *
 * The two boundary cases both resolve to something rather than to nothing.
 * **A clock that does not exist** -- 02:30 on the spring-forward morning --
 * lands on the instant one hour later, the same reading every calendar
 * application gives it. **A clock that happens twice**, on the autumn morning,
 * takes the second of the two, the one on standard time, because that is the
 * offset in force at the corrected instant.
 *
 * That second choice falls out of the arithmetic rather than being argued for,
 * and it is written down because it is the kind of thing somebody would
 * otherwise have to rediscover. It can only be reached by a `TZID` time inside
 * the repeated hour: a `Z` time names an instant and is never ambiguous, and
 * producers that care about the hour use one. An hour out, once a year, for a
 * meeting nobody schedules.
 */
function instantOf(zone: string, clock: Clock): number | null {
  const guess = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute);

  const first = offsetAt(zone, guess);
  if (first === null) return null;

  const second = offsetAt(zone, guess - first * 60_000);
  if (second === null) return null;

  return guess - second * 60_000;
}

/** A `YYYY-MM-DD` and `HH:MM` pair, which is what a meeting line is written from. */
export interface LocalMoment {
  date: string;
  /** Null for a date with no time, which stays one. */
  time: string | null;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * A moment from an `.ics`, as the wall clock of `zone`.
 *
 * Unchanged, deliberately, in three cases:
 *
 * - **A date with no time.** An all-day event is a date, not an instant, and
 *   converting one would move a birthday across midnight.
 * - **A floating time.** It already means "this clock, wherever you are".
 * - **A zone neither side names, or a name `Intl` does not know.** The fallback
 *   is what every import did before this existed, so an unreadable `TZID`
 *   costs one meeting its precision rather than costing the import.
 *
 * `zone` is the vault's, and a blank one means the caller does not know: then
 * everything passes through, which is the same fallback rather than a guess.
 */
export function inZone(moment: IcsMoment, zone: string): LocalMoment {
  const unchanged: LocalMoment = { date: moment.date, time: moment.time };
  if (moment.time === null || !zone.trim()) return unchanged;

  const source = moment.utc ? 'UTC' : (moment.zone ?? '');
  if (!source.trim()) return unchanged;

  const [year, month, day] = moment.date.split('-').map(Number);
  const [hour, minute] = moment.time.split(':').map(Number);
  if ([year, month, day, hour, minute].some((one) => one === undefined || Number.isNaN(one))) {
    return unchanged;
  }

  const instant = instantOf(source, {
    year: year as number,
    month: month as number,
    day: day as number,
    hour: hour as number,
    minute: minute as number,
  });
  if (instant === null) return unchanged;

  const local = clockAt(zone, instant);
  if (!local) return unchanged;

  return {
    date: `${local.year}-${pad2(local.month)}-${pad2(local.day)}`,
    time: `${pad2(local.hour % 24)}:${pad2(local.minute)}`,
  };
}

/** Whether reading this moment in `zone` would move it at all. */
export function movesInZone(moment: IcsMoment, zone: string): boolean {
  const local = inZone(moment, zone);
  return local.date !== moment.date || local.time !== moment.time;
}
