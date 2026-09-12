/**
 * An iCalendar file read into events, and nothing else.
 *
 * **Parsing only.** No clock, no timezone conversion, no recurrence expanded:
 * what comes out is what the file said, in the shape the file said it. The
 * awkward parts of ICS are separate problems and they get separate modules --
 * `recurrence.ts` for RRULE, and the caller for turning a wall clock in a
 * named zone into a local one. A parser that also converted would be a parser
 * nobody could test against a fixture.
 *
 * ICS is RFC 5545, a public interchange format rather than this suite's model
 * of one, which is why it is here rather than in the plugin that reads it. See
 * `packages/nodatrail/docs/design/calendar-import.md` §F.1: the two-consumer
 * test was NOT met and the promotion does not rest on it.
 *
 * Three things about the format that are easy to get wrong and are handled
 * here, each with a test:
 *
 * - **Lines are folded.** A long line continues on the next one, marked by a
 *   leading space or tab, and the fold can fall anywhere -- including inside a
 *   word, and including between the bytes of a UTF-8 character when a producer
 *   folds by octet. Unfolding has to happen before anything else looks at a
 *   line.
 * - **Values are escaped.** `\,` `\;` `\n` and `\\` are the four, and a summary
 *   reading `Lunch\, then PMQ` is one property with a comma in it rather than
 *   two values.
 * - **A property carries parameters.** `DTSTART;TZID=Europe/Zurich:20260902T090000`
 *   has a name, one parameter and a value, and a parameter's own value may be
 *   quoted and may contain a colon -- so the split on `:` cannot be the first
 *   one found.
 *
 * App-free, and clock-free.
 */
import { addDays, formatDayTitle, parseDayTitle } from '../dates/day.js';

/**
 * A property's parameters, keyed by their **upper-cased** names.
 *
 * Upper because `parseLine` upper-cases them, and this comment said lower for
 * a while: a reader who believed it wrote `parameters['partstat']`, got an
 * empty string, and shipped an importer that thought nobody had answered any
 * invitation. The code is the truth and the comment now says what it does.
 */
export type IcsParameters = Readonly<Record<string, string>>;

export interface IcsProperty {
  /** Upper-cased, so `dtstart` and `DTSTART` are one thing. */
  name: string;
  parameters: IcsParameters;
  /** Unescaped. */
  value: string;
}

/**
 * A moment as the file states it, which is not always a moment.
 *
 * `date` is always present. `time` is null for an all-day value
 * (`VALUE=DATE`), which is a different thing from midnight and has to stay
 * different: an all-day event has no time, and giving it 00:00 would put it
 * first in a morning it does not belong to.
 *
 * `zone` is the `TZID` parameter when there is one. `utc` is true for a value
 * ending in `Z`. Both null and false means a floating time -- one that is
 * whatever the clock says wherever you are -- which is rarer than it sounds
 * and still legal.
 */
export interface IcsMoment {
  date: string;
  time: string | null;
  zone: string | null;
  utc: boolean;
}

/**
 * One person invited to an event, as the file states them.
 *
 * `address` is lower-cased and stripped of its `mailto:`, because that is the
 * only part two files reliably agree on: the `CN` is a display name in one
 * export and the address again in another.
 *
 * `partstat` is the answer they gave -- `ACCEPTED`, `DECLINED`, `TENTATIVE`,
 * `NEEDS-ACTION` -- and it is the whole reason this property is parsed at all.
 * A calendar knows which of its meetings you are going to; an importer that
 * drops the attendees writes a day that claims you are going to all of them.
 *
 * `role` separates `REQ-PARTICIPANT` from `OPT-PARTICIPANT`, which is a
 * different question from whether you answered and is left to the caller.
 */
export interface IcsAttendee {
  address: string;
  /** Upper-cased. Empty when the file does not say, which RFC 5545 reads as NEEDS-ACTION. */
  partstat: string;
  /** Upper-cased. Empty when the file does not say, which RFC 5545 reads as REQ-PARTICIPANT. */
  role: string;
  /** The display name, verbatim, for a view that wants to name somebody. */
  cn: string;
}

export interface IcsEvent {
  uid: string;
  summary: string;
  location: string;
  description: string;
  start: IcsMoment | null;
  /** As stated. For an all-day event this is EXCLUSIVE -- see `lastDayOf`. */
  end: IcsMoment | null;
  /** `DURATION`, verbatim, for an event that states one instead of an end. */
  duration: string;
  /** The `RRULE` value, unparsed. `recurrence.ts` reads it. */
  rrule: string;
  /** Every `EXDATE` value, flattened: one date or datetime per entry. */
  exdates: string[];
  /** Set on a VEVENT that overrides one instance of a series. */
  recurrenceId: string | null;
  /** `CANCELLED` events are in the file and are not appointments. */
  status: string;
  /** Everyone invited. Empty for an event nobody was invited to, which is most of one's own calendar. */
  attendees: IcsAttendee[];
  /** Everything else, for a caller that wants a property this shape does not name. */
  properties: readonly IcsProperty[];
}

/**
 * The physical lines of an ICS, unfolded into logical ones.
 *
 * A continuation is a line beginning with a space or a horizontal tab; the
 * marker is removed and the rest joined to the line before with nothing
 * between. CRLF is the standard's line ending and bare LF is what half the
 * world's files actually use, so both are accepted.
 *
 * Exported because folding is the one part of this format that bites a caller
 * doing anything ad hoc with the text.
 */
export function unfoldLines(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
      continue;
    }
    out.push(line);
  }
  return out;
}

/** `\,` `\;` `\n` `\N` and `\\` back to what they stand for. Anything else after a backslash keeps the backslash, since inventing an escape would lose a character. */
function unescapeText(value: string): string {
  let out = '';
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '\\') {
      out += value[index];
      continue;
    }
    const next = value[index + 1];
    if (next === undefined) {
      out += '\\';
      break;
    }
    if (next === 'n' || next === 'N') out += '\n';
    else if (next === ',' || next === ';' || next === '\\') out += next;
    else out += `\\${next}`;
    index += 1;
  }
  return out;
}

/**
 * One logical line into a name, its parameters and its value.
 *
 * **The value starts at the first colon that is not inside a quoted parameter
 * value.** `ATTENDEE;CN="Meier, Stefan":mailto:h@x.ch` has three colons and only
 * the second one ends the parameters. Scanning with a quote flag is the whole
 * of it, and splitting on the first colon instead is the bug this note exists
 * to prevent.
 */
export function parseLine(line: string): IcsProperty | null {
  let quoted = false;
  let colon = -1;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') quoted = !quoted;
    else if (char === ':' && !quoted) {
      colon = index;
      break;
    }
  }
  if (colon === -1) return null;

  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);

  const parts: string[] = [];
  let current = '';
  quoted = false;
  for (const char of head) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ';' && !quoted) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);

  const name = (parts.shift() ?? '').trim().toUpperCase();
  if (name === '') return null;

  const parameters: Record<string, string> = {};
  for (const part of parts) {
    const at = part.indexOf('=');
    if (at === -1) continue;
    parameters[part.slice(0, at).trim().toUpperCase()] = part.slice(at + 1).trim();
  }

  return { name, parameters, value: unescapeText(value) };
}

/**
 * A DATE or DATE-TIME value into the shape the file stated.
 *
 * `20260902` is a date. `20260902T090000` is a floating datetime.
 * `20260902T070000Z` is UTC. The `VALUE=DATE` parameter is honoured over the
 * shape of the string, because a producer that says DATE means DATE.
 *
 * Seconds are dropped: this suite writes `HH:MM` and there is nowhere for them
 * to go. A meeting at 09:00:30 is a meeting at 09:00.
 */
export function parseMoment(property: IcsProperty): IcsMoment | null {
  const raw = property.value.trim();
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(raw);
  if (!match) return null;

  const date = `${match[1]}-${match[2]}-${match[3]}`;
  const dateOnly = property.parameters.VALUE === 'DATE' || match[4] === undefined;

  return {
    date,
    time: dateOnly ? null : `${match[4]}:${match[5]}`,
    zone: property.parameters.TZID ?? null,
    utc: match[7] === 'Z',
  };
}

/**
 * Every VEVENT in the text.
 *
 * Other components -- VTIMEZONE, VALARM, VTODO -- are skipped whole. VALARM
 * matters because it nests inside a VEVENT and carries its own `TRIGGER` and
 * sometimes its own `SUMMARY`, which a flat scan would read as the event's.
 */
export function parseIcs(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: IcsProperty[] | null = null;
  let depth = 0;

  for (const line of unfoldLines(text)) {
    const property = parseLine(line);
    if (property === null) continue;

    if (property.name === 'BEGIN') {
      if (property.value === 'VEVENT' && current === null) {
        current = [];
        continue;
      }
      // Anything opened inside an event is a sub-component; count it so its
      // END does not close the event.
      if (current !== null) depth += 1;
      continue;
    }

    if (property.name === 'END') {
      if (current !== null && depth > 0) {
        depth -= 1;
        continue;
      }
      if (property.value === 'VEVENT' && current !== null) {
        events.push(eventOf(current));
        current = null;
      }
      continue;
    }

    if (current !== null && depth === 0) current.push(property);
  }
  return events;
}

function first(properties: readonly IcsProperty[], name: string): IcsProperty | undefined {
  return properties.find((property) => property.name === name);
}

function text(properties: readonly IcsProperty[], name: string): string {
  return first(properties, name)?.value.trim() ?? '';
}

function eventOf(properties: readonly IcsProperty[]): IcsEvent {
  const start = first(properties, 'DTSTART');
  const end = first(properties, 'DTEND');

  return {
    uid: text(properties, 'UID'),
    summary: text(properties, 'SUMMARY'),
    location: text(properties, 'LOCATION'),
    description: text(properties, 'DESCRIPTION'),
    start: start ? parseMoment(start) : null,
    end: end ? parseMoment(end) : null,
    duration: text(properties, 'DURATION'),
    rrule: text(properties, 'RRULE'),
    // One EXDATE property may hold several dates, and a file may carry several
    // EXDATE properties. Both spellings are in the wild, so both are flattened.
    exdates: properties
      .filter((property) => property.name === 'EXDATE')
      .flatMap((property) => property.value.split(',').map((one) => one.trim()))
      .filter((one) => one !== ''),
    recurrenceId: first(properties, 'RECURRENCE-ID')?.value.trim() ?? null,
    status: text(properties, 'STATUS').toUpperCase(),
    attendees: properties
      .filter((property) => property.name === 'ATTENDEE')
      .map((property) => attendeeOf(property)),
    properties,
  };
}

/** `mailto:a@b.ch` to `a@b.ch`, lower-cased. Anything else is taken as written. */
function addressOf(value: string): string {
  return value
    .trim()
    .replace(/^mailto:/i, '')
    .toLowerCase();
}

function attendeeOf(property: IcsProperty): IcsAttendee {
  return {
    address: addressOf(property.value),
    partstat: (property.parameters['PARTSTAT'] ?? '').trim().toUpperCase(),
    role: (property.parameters['ROLE'] ?? '').trim().toUpperCase(),
    cn: (property.parameters['CN'] ?? '').trim(),
  };
}

/**
 * Whose calendar this is, according to the file.
 *
 * `X-WR-CALNAME` is not in RFC 5545 -- it is an Apple extension that Google
 * and most others emit anyway -- and a Google export puts the account's own
 * address in it. That is what lets the importer pick your `ATTENDEE` line out
 * of the thirty on a meeting without anybody configuring an address by hand,
 * and being asked for your own email address by a program reading your own
 * calendar is a poor way to start.
 *
 * Empty when the file does not say, or says something that is not an address:
 * a calendar named "Work" tells us nothing about who owns it, and guessing
 * from the attendee lists would pick whoever happens to appear most.
 */
export function calendarOwner(text: string): string {
  for (const line of unfoldLines(text)) {
    const property = parseLine(line);
    if (property?.name !== 'X-WR-CALNAME') continue;
    const value = addressOf(property.value);
    return value.includes('@') ? value : '';
  }
  return '';
}

/**
 * The last day an event actually covers, which is not what `DTEND` says.
 *
 * Two corrections, and both add a spurious day to somebody's week when they
 * are missed:
 *
 * - **An all-day end is exclusive.** `DTEND;VALUE=DATE:20260915` means the
 *   event ends on the 14th. RFC 5545 §3.8.2.2. Getting this wrong puts a
 *   holiday on the day somebody comes back to work.
 * - **A timed end at exactly midnight belongs to the day before.** A meeting
 *   running 22:00 to 00:00 states a DTEND on the following date, and a line
 *   in that day's note would announce a meeting on a morning nothing happens.
 *
 * A stated end earlier than the start is ignored rather than repaired: it
 *  means the file is wrong about something, and shortening the event to a day
 *  is the reading that invents the least.
 */
export function lastDayOf(start: IcsMoment, end: IcsMoment | null): string {
  if (end === null || end.date <= start.date) return start.date;

  const allDay = start.time === null;
  if (!allDay && end.time !== '00:00') return end.date;

  const date = parseDayTitle(end.date);
  if (date === null) return start.date;
  const back = formatDayTitle(addDays(date, -1));
  return back < start.date ? start.date : back;
}
