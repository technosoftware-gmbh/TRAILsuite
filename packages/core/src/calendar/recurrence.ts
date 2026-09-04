/**
 * Turning a recurring VEVENT into the dates it actually falls on, within a
 * range of days.
 *
 * **Tested, not generated.** Rather than computing the next date from a rule --
 * which is where an RRULE engine grows its long tail of bugs -- this walks the
 * days from `DTSTART` forward and asks each one whether the rule includes it.
 * Walking is slower and it is obviously correct, which is the trade this file
 * makes deliberately: a weekly meeting six years old costs a walk of a couple
 * of thousand days to place in next month, and nobody can feel that.
 *
 * **A rule this cannot honour is reported, never approximated.** `unsupported`
 * comes back on the parsed rule and the caller is expected to say so out loud.
 * Silently dropping a `BYSETPOS` and expanding the rest produces dates that
 * look right and are not, in somebody's calendar, which is the failure this
 * suite treats as worst: discovered weeks later, by being in the wrong place.
 *
 * **The window is applied to occurrences, not to the series.** A standup whose
 * `DTSTART` is in 2024 belongs in a September 2026 window; testing the series'
 * start would import nothing, and it is exactly the recurring meetings a
 * working week is made of. See calendar-import.md §I.4.
 *
 * App-free, and clock-free.
 */
import { addDays, formatDayTitle, parseDayTitle } from '../dates/day.js';
import type { IcsEvent, IcsMoment } from './ics.js';

/** Sunday-first, because that is the index `Date.getDay()` returns. */
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

/** Days walked before giving up. Fifty-five years of a daily rule, which no calendar export contains. */
const WALK_LIMIT = 20000;

/** The parts of an RRULE this expands, plus the ones it found and cannot. */
export interface Rrule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | null;
  interval: number;
  count: number | null;
  /** ISO day. An UNTIL's time is dropped: a day is the resolution everything here works at. */
  until: string | null;
  /** `MO`, `TU`, ... with an optional ordinal for MONTHLY and YEARLY: `2TU`, `-1FR`. */
  byday: readonly string[];
  bymonthday: readonly number[];
  /** 1-12. */
  bymonth: readonly number[];
  /**
   * Parts present in the rule that this module does not implement.
   *
   * Non-empty means the expansion is not trustworthy and the caller must not
   * present it as though it were.
   */
  unsupported: readonly string[];
}

/** The parts understood well enough to expand. Everything else lands in `unsupported`. */
const KNOWN = new Set([
  'FREQ',
  'INTERVAL',
  'COUNT',
  'UNTIL',
  'BYDAY',
  'BYMONTHDAY',
  'BYMONTH',
  'WKST',
]);

export function parseRrule(value: string): Rrule {
  const parts = new Map<string, string>();
  for (const piece of value.split(';')) {
    const at = piece.indexOf('=');
    if (at === -1) continue;
    parts.set(piece.slice(0, at).trim().toUpperCase(), piece.slice(at + 1).trim());
  }

  const freq = parts.get('FREQ')?.toUpperCase() ?? '';
  const numbers = (key: string): number[] =>
    (parts.get(key) ?? '')
      .split(',')
      .map((one) => Number.parseInt(one.trim(), 10))
      .filter((one) => Number.isFinite(one));

  const untilMatch = /^(\d{4})(\d{2})(\d{2})/.exec(parts.get('UNTIL') ?? '');

  return {
    freq:
      freq === 'DAILY' || freq === 'WEEKLY' || freq === 'MONTHLY' || freq === 'YEARLY'
        ? freq
        : null,
    // A zero or negative INTERVAL is not a rule, it is a typo that would make
    // every day match. One is the standard's own default.
    interval: Math.max(1, numbers('INTERVAL')[0] ?? 1),
    count: parts.has('COUNT') ? Math.max(0, numbers('COUNT')[0] ?? 0) : null,
    until: untilMatch ? `${untilMatch[1]}-${untilMatch[2]}-${untilMatch[3]}` : null,
    byday: (parts.get('BYDAY') ?? '')
      .split(',')
      .map((one) => one.trim().toUpperCase())
      .filter((one) => one !== ''),
    bymonthday: numbers('BYMONTHDAY'),
    bymonth: numbers('BYMONTH'),
    // WKST is accepted and ignored: it only changes which week an interval
    // counts from, and this walks days rather than counting weeks.
    unsupported: [...parts.keys()].filter((key) => !KNOWN.has(key)).sort(),
  };
}

/** `2TU` to `{ ordinal: 2, weekday: 'TU' }`; a bare `TU` has no ordinal. */
function splitByday(token: string): { ordinal: number | null; weekday: string } {
  const match = /^([+-]?\d+)?([A-Z]{2})$/.exec(token);
  if (!match) return { ordinal: null, weekday: '' };
  return {
    ordinal: match[1] === undefined ? null : Number.parseInt(match[1], 10),
    weekday: match[2] ?? '',
  };
}

/** Which occurrence of its weekday a date is within its month, counted from the start and from the end. */
function ordinalsInMonth(date: Date): { fromStart: number; fromEnd: number } {
  const day = date.getDate();
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return { fromStart: Math.floor((day - 1) / 7) + 1, fromEnd: -(Math.floor((last - day) / 7) + 1) };
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/**
 * A date as a count of days from a fixed origin, from the calendar fields alone.
 *
 * Two things this is not, and both were tried:
 *
 * - **Not milliseconds divided by 86_400_000.** That is off by one across a
 *   daylight-saving boundary, the same bug already found in `eachDay()`, and a
 *   rule that skipped or repeated a day twice a year would be the hardest kind
 *   to notice.
 * - **Not a day-by-day walk.** `matches()` is asked about every day the
 *   expansion visits, so a walk in here makes the whole thing quadratic: a
 *   series a few years old took a minute rather than a millisecond, and one
 *   old enough never finished. The test that found it is the truncation case
 *   in recurrence.test.ts, which timed out.
 *
 * Howard Hinnant's civil-days algorithm: integer arithmetic on year, month and
 * day, with March as the first month so a leap day falls at the end of the
 * year and needs no special case. There is no clock anywhere in it.
 */
function dayNumber(date: Date): number {
  const month = date.getMonth() + 1;
  const year = date.getFullYear() - (month <= 2 ? 1 : 0);
  const era = Math.floor(year / 400);
  const yearOfEra = year - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + date.getDate() - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/** Whole days between two dates. Negative when `to` is earlier. */
function daysApart(from: Date, to: Date): number {
  return dayNumber(to) - dayNumber(from);
}

function mondayOf(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

/**
 * Whether the rule places an occurrence on this day.
 *
 * `COUNT` and `UNTIL` are not checked here: they bound the sequence rather
 * than describe a day, and the walk in `ruleDays` applies them.
 */
function matches(rule: Rrule, start: Date, day: Date): boolean {
  if (rule.bymonth.length > 0 && !rule.bymonth.includes(day.getMonth() + 1)) return false;
  if (rule.bymonthday.length > 0 && !rule.bymonthday.includes(day.getDate())) return false;

  const weekday = WEEKDAYS[day.getDay()] ?? '';
  const byday = rule.byday.map(splitByday).filter((one) => one.weekday !== '');

  switch (rule.freq) {
    case 'DAILY': {
      if (byday.length > 0 && !byday.some((one) => one.weekday === weekday)) return false;
      return daysApart(start, day) % rule.interval === 0;
    }
    case 'WEEKLY': {
      // A weekly rule with no BYDAY repeats on the weekday DTSTART fell on.
      const wanted =
        byday.length > 0 ? byday.map((one) => one.weekday) : [WEEKDAYS[start.getDay()] ?? ''];
      if (!wanted.includes(weekday)) return false;
      // Whole weeks from the week DTSTART is in, so an INTERVAL=2 rule naming
      // several BYDAY values keeps its whole week together.
      return Math.floor(daysApart(mondayOf(start), mondayOf(day)) / 7) % rule.interval === 0;
    }
    case 'MONTHLY': {
      if (monthsBetween(start, day) % rule.interval !== 0) return false;
      if (byday.length === 0) {
        return rule.bymonthday.length > 0 || day.getDate() === start.getDate();
      }
      const { fromStart, fromEnd } = ordinalsInMonth(day);
      return byday.some(
        (one) =>
          one.weekday === weekday &&
          (one.ordinal === null || one.ordinal === fromStart || one.ordinal === fromEnd)
      );
    }
    case 'YEARLY': {
      if ((day.getFullYear() - start.getFullYear()) % rule.interval !== 0) return false;
      if (rule.bymonth.length === 0 && day.getMonth() !== start.getMonth()) return false;
      if (byday.length > 0) {
        const { fromStart, fromEnd } = ordinalsInMonth(day);
        return byday.some(
          (one) =>
            one.weekday === weekday &&
            (one.ordinal === null || one.ordinal === fromStart || one.ordinal === fromEnd)
        );
      }
      return rule.bymonthday.length > 0 || day.getDate() === start.getDate();
    }
    default:
      return false;
  }
}

/**
 * The days a rule places an occurrence on, between `from` and `to` inclusive.
 *
 * The walk starts at `DTSTART` rather than at `from`, because `COUNT` is a
 * number of occurrences from the beginning of the series and cannot be
 * evaluated from the middle of one.
 */
export function ruleDays(
  rule: Rrule,
  startDay: string,
  from: string,
  to: string
): { days: string[]; truncated: boolean } {
  const start = parseDayTitle(startDay);
  if (start === null || rule.freq === null) return { days: [], truncated: false };

  const days: string[] = [];
  let seen = 0;
  let cursor = start;

  for (let step = 0; step < WALK_LIMIT; step += 1) {
    const iso = formatDayTitle(cursor);
    if (iso > to) return { days, truncated: false };
    if (rule.until !== null && iso > rule.until) return { days, truncated: false };

    if (matches(rule, start, cursor)) {
      seen += 1;
      if (rule.count !== null && seen > rule.count) return { days, truncated: false };
      if (iso >= from) days.push(iso);
    }
    cursor = addDays(cursor, 1);
  }
  return { days, truncated: true };
}

/**
 * One dated instance of an event, ready to become a line.
 *
 * `EventOccurrence` rather than `Occurrence` because the expense layer already
 * exports that name for an instance of a recurring bill, and the package's
 * surface is flat.
 */
export interface EventOccurrence {
  uid: string;
  /** ISO day the instance starts on. */
  date: string;
  /** Wall clock as the file states it, or null for an all-day instance. */
  time: string | null;
  /**
   * ISO day **this instance** ends on, carrying the series' length rather than
   * its stated end. For an all-day event it is EXCLUSIVE, as the file states
   * it: see `lastDayOf`.
   */
  endDate: string | null;
  /** Wall clock the instance ends at, as stated. Null for an all-day instance. */
  endTime: string | null;
  /** The zone the times are stated in, carried through untouched for the caller to convert. */
  zone: string | null;
  utc: boolean;
  summary: string;
  location: string;
  /**
   * What the calendar's owner answered for **this instance**.
   *
   * `ACCEPTED`, `DECLINED`, `TENTATIVE`, `NEEDS-ACTION`, or empty for an event
   * they were not invited to -- their own blocked time, which is most of a
   * working calendar.
   *
   * Per instance rather than per series, and that is not a nicety. A weekly
   * meeting is one `RRULE` and a scattering of `RECURRENCE-ID` overrides, and
   * the answer lives on whichever of them describes the day: in one real
   * calendar a standing meeting reads NEEDS-ACTION as a series and DECLINED on
   * twelve particular Thursdays. A per-series reading gets those twelve wrong
   * in one direction and, on a series accepted once and since abandoned, all
   * of them wrong in the other.
   */
  partstat: string;
  /** True when a RECURRENCE-ID VEVENT replaced this instance of the series. */
  overridden: boolean;
  /** Rule parts the series carried that this module does not implement. */
  unsupported: readonly string[];
}

/**
 * The end date of one occurrence, which is not the end date the series states.
 *
 * A VEVENT states one DTEND, against its own DTSTART, and every occurrence
 * carries the same **length** rather than the same end. Taking DTEND verbatim
 * hands every instance the first instance's dates, and since those are in the
 * past for everything after the first, each one collapses to a single day: a
 * course running Monday to Friday every fortnight reads as one Monday
 * afternoon, twelve times over.
 *
 * Invisible on the common case, which is why it is worth a function and a
 * comment: almost every recurring event is half an hour long and starts and
 * ends on the same day, where the wrong answer and the right one agree.
 */
function endOfOccurrence(event: IcsEvent, date: string): string | null {
  const first = event.start === null ? null : parseDayTitle(event.start.date);
  const last = event.end === null ? null : parseDayTitle(event.end.date);
  const moved = parseDayTitle(date);
  if (first === null || last === null) return event.end?.date ?? null;
  if (moved === null) return event.end?.date ?? null;
  return formatDayTitle(addDays(moved, daysApart(first, last)));
}

/** What `owner` answered on this VEVENT, or empty when they are not on it. */
function answerOf(event: IcsEvent, owner: string): string {
  if (owner === '') return '';
  const mine = event.attendees.find((attendee) => attendee.address === owner);
  if (!mine) return '';
  // RFC 5545 3.2.12: an ATTENDEE with no PARTSTAT has not answered.
  return mine.partstat === '' ? 'NEEDS-ACTION' : mine.partstat;
}

function occurrenceOf(
  event: IcsEvent,
  date: string,
  start: IcsMoment,
  owner: string
): EventOccurrence {
  return {
    uid: event.uid,
    date,
    time: start.time,
    endDate: endOfOccurrence(event, date),
    endTime: event.end?.time ?? null,
    zone: start.zone,
    utc: start.utc,
    summary: event.summary,
    location: event.location,
    partstat: answerOf(event, owner),
    overridden: false,
    unsupported: [],
  };
}

/** `20260914T090000` or `20260914` to an ISO day, for matching EXDATE and RECURRENCE-ID against occurrences. */
function dayOfIcsValue(value: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(value.trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

/** A series carrying a rule part this module does not implement. */
export interface UnsupportedSeries {
  uid: string;
  summary: string;
  /** The parts found and not implemented, as they were named in the rule. */
  parts: readonly string[];
}

/**
 * What an expansion found: the occurrences, and the two ways it fell short.
 *
 * Both shortfalls sit here rather than on an occurrence, because both describe
 * occurrences that are **absent** and there is nothing absent to hang them on.
 * A series whose rule this cannot honour may expand to nothing at all, and one
 * whose walk gave up certainly does; reported per occurrence, either would
 * disappear exactly when it mattered most.
 */
export interface Expansion {
  occurrences: EventOccurrence[];
  /**
   * Series carrying rule parts this does not implement, whether or not they
   * produced anything. The caller has to say so before presenting the rest.
   */
  unsupported: UnsupportedSeries[];
  /** Series whose walk gave up before it reached the range asked for. */
  truncated: { uid: string; summary: string }[];
}

/**
 * Every occurrence of every event, within the range asked for.
 *
 * Takes the whole list rather than one event because a series and its
 * overrides are separate VEVENTs sharing a UID: the one carrying
 * `RECURRENCE-ID` replaces the instance the rule would have produced on that
 * day, and it can carry a different time, summary or length.
 *
 * **Cancelled events are dropped**, series and instance alike. A `STATUS:
 * CANCELLED` VEVENT carrying a RECURRENCE-ID is how a calendar says "this
 * week's is off", and importing it as a meeting would put back the one thing
 * that definitely is not happening.
 */
export function expandEvents(
  events: readonly IcsEvent[],
  from: string,
  to: string,
  owner = ''
): Expansion {
  const overrides = new Map<string, IcsEvent>();
  for (const event of events) {
    if (event.recurrenceId === null) continue;
    overrides.set(`${event.uid} ${dayOfIcsValue(event.recurrenceId)}`, event);
  }

  const occurrences: EventOccurrence[] = [];
  const unsupported: UnsupportedSeries[] = [];
  const truncated: { uid: string; summary: string }[] = [];

  for (const event of events) {
    if (event.recurrenceId !== null) continue;
    if (event.status === 'CANCELLED') continue;
    const start = event.start;
    if (start === null) continue;

    const rule = event.rrule === '' ? null : parseRrule(event.rrule);
    if (rule !== null && rule.unsupported.length > 0) {
      unsupported.push({ uid: event.uid, summary: event.summary, parts: rule.unsupported });
    }
    const excluded = new Set(event.exdates.map(dayOfIcsValue));

    let days: string[];
    if (rule === null) {
      days = start.date >= from && start.date <= to ? [start.date] : [];
    } else {
      const walked = ruleDays(rule, start.date, from, to);
      if (walked.truncated) truncated.push({ uid: event.uid, summary: event.summary });
      days = walked.days;
    }

    for (const day of days) {
      if (excluded.has(day)) continue;

      const override = overrides.get(`${event.uid} ${day}`);
      if (override) {
        if (override.status === 'CANCELLED') continue;
        const moved = override.start;
        if (moved === null) continue;
        // The override's own attendee list, not the series'. It is where a
        // calendar records that this week's is one you are not going to.
        occurrences.push({
          ...occurrenceOf(override, moved.date, moved, owner),
          overridden: true,
          unsupported: rule?.unsupported ?? [],
        });
        continue;
      }

      occurrences.push({
        ...occurrenceOf(event, day, start, owner),
        unsupported: rule?.unsupported ?? [],
      });
    }
  }

  occurrences.sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`));
  return { occurrences, unsupported, truncated };
}
