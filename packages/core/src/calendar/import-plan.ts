/**
 * Turning calendar occurrences into meeting lines somebody can approve.
 *
 * **Nothing here writes**, the same way `ledger/import-plan.ts` does not: a
 * proposal per line with a status attached, so a preview can show what would
 * happen before it happens. An ICS export routinely holds a year of events,
 * most of them already in the notes, and an import that wrote first and
 * explained afterwards would be one nobody dares run a second time.
 *
 * See `packages/nodatrail/docs/design/calendar-import.md`. Four of its rules
 * are the whole shape of this file:
 *
 * - **§D Identity is derived, not stored.** A line's key is built from the day,
 *   the start time and the text, exactly as `statementRowKey` builds one from a
 *   bank row. Nothing is written into a note that was not going to be written
 *   anyway, and a note that has never been imported into is indistinguishable
 *   from one that has.
 * - **§D The importer keeps its own record instead.** The keys it wrote, in
 *   `data.json` rather than in anybody's notes, because deriving the key is
 *   what makes "which of these did I write" otherwise unanswerable.
 * - **§G.6 It never removes a line.** A meeting that has gone from the export
 *   is listed, a task is written for it, and a person deletes it.
 * - **§I.1 An occurrence that starts in the range is imported whole**, so a
 *   holiday running past the end writes days outside it. `days` reports what
 *   would actually be touched rather than the range it was given.
 *
 * **It rests in the core on the format argument**, like the parser beside it
 * and not on the two-consumer test: what a meeting line looks like is a
 * statement about a file in somebody's vault, and the derived key is a
 * statement about that statement. See §F.1.
 *
 * App-free, and clock-free.
 */
import { addDays, formatDayTitle, parseDayTitle } from '../dates/day.js';
import { lastDayOf } from './ics.js';
import { inZone } from './zones.js';
import type { EventOccurrence, Expansion, UnsupportedSeries } from './recurrence.js';

/**
 * A line the vault already holds under a day's schedule heading.
 *
 * Deliberately less than the reader that produces it knows. This module is
 * given the three things a key is derived from and nothing else, so that no
 * part of one plugin's entry model has to be restated here to be compared.
 */
export interface ExistingEntry {
  /** ISO day of the note the line is in. */
  day: string;
  /** `09:00`, or empty for a line with no time. */
  from: string;
  /** The line's text, with the marker, the times and the wikilink brackets already off. */
  text: string;
  /**
   * What the line says was answered, as a `PARTSTAT`.
   *
   * The caller reads it back off whatever the line carries and states it in the
   * file's vocabulary rather than its own, so the comparison below is between
   * two values of one kind. Omitted means the caller does not distinguish
   * answers, and then a changed one is never noticed -- which is what every
   * caller did before this existed.
   */
  partstat?: string;
}

/**
 * One line a previous export of this source offered on a given day.
 *
 * **What the export said, not what the importer wrote.** The two are not the
 * same -- a line already in the note was offered and skipped -- and only the
 * first can be recovered, because the record is the archived file rather than
 * a list kept in the plugin's data. What the weaker claim still guarantees is
 * the one that mattered: a meeting somebody typed by hand was never in any
 * export, so it can never be reported as having gone from one.
 */
export interface PriorLine {
  /** The event it came from. */
  uid: string;
  /** The day it fell on. */
  day: string;
  /** The key derived from the line the export would have written. */
  key: string;
}

/** What one earlier run of this source, over that range, had to offer. */
export interface PriorImport {
  from: string;
  to: string;
  lines: readonly PriorLine[];
}

export interface CalendarImportOptions {
  /** The range, inclusive. An occurrence starting inside it is imported whole. */
  from: string;
  to: string;
  /** Every line the vault holds on the days this could touch. */
  existing: readonly ExistingEntry[];
  /**
   * The IANA zone the vault writes its day notes in, such as `Europe/Zurich`.
   *
   * **An argument rather than something read off the machine**, because this
   * package never asks the runtime anything. It decides what a meeting line
   * says: an `.ics` states a time as an instant, as a wall clock in a named
   * zone, or as floating, and only the last of those can be copied into a note
   * unchanged. See `zones.ts`.
   *
   * Blank converts nothing, which is what every import did before this existed.
   * It is a fallback for a caller that genuinely cannot say, not a default to
   * reach for.
   */
  zone: string;
  /**
   * What earlier exports **of this same source** said, replayed from the files
   * they were read out of.
   *
   * Per source, because two calendars are two records: a meeting absent from
   * the business export is not missing, it is in the private one. Omitted
   * means a first import, where nothing can be reported as gone.
   */
  history?: readonly PriorImport[];
}

export type CalendarProposalStatus =
  /** Not in the note. Would be written. */
  | 'new'
  /** A line on that day already says this. Nothing to do. */
  | 'already-present'
  /** An earlier export said this one, the line is still here, and the export has changed. */
  | 'changed-upstream'
  /**
   * The line is here and says the right thing, but you have answered
   * differently since it was written.
   */
  | 'answer-changed'
  /** An earlier export said this one and no line of either wording remains. */
  | 'edited-here'
  /** An earlier proposal in this same run would write the identical line. */
  | 'duplicate-in-file'
  /** Its series carries a rule part the expander does not implement. */
  | 'unsupported-rule';

/**
 * The answers a meeting line can tell apart.
 *
 * `ACCEPTED` and "not invited at all" both reduce to nothing, because to
 * somebody reading a day they are one claim: it is on, and you are going. An
 * answer the file does not give is `NEEDS-ACTION`, RFC 5545's own default and
 * what an unopened invitation actually is. Anything else -- `DELEGATED` and the
 * rest -- reduces to nothing rather than to a fifth state this cannot render.
 *
 * The reduction is here rather than in the caller because both sides of the
 * comparison have to use the same one. A caller reducing its own lines and the
 * plan reducing the export would agree until one of them changed, and then
 * every meeting would read as answered differently.
 */
export function answerOf(partstat: string): '' | 'TENTATIVE' | 'NEEDS-ACTION' | 'DECLINED' {
  switch (partstat.trim().toUpperCase()) {
    case 'DECLINED':
      return 'DECLINED';
    case 'TENTATIVE':
      return 'TENTATIVE';
    case 'NEEDS-ACTION':
      return 'NEEDS-ACTION';
    default:
      return '';
  }
}

/** The statuses that would put a line in a note. Everything else is shown and skipped. */
const WRITES = new Set<CalendarProposalStatus>(['new', 'changed-upstream']);

export interface CalendarProposal {
  uid: string;
  /**
   * The day this line belongs in, which is not always the occurrence's own
   * start: a multi-day event gets one proposal per day it covers (§E.3).
   */
  day: string;
  /** `09:00`, or empty. Blank on every day of a span but the first. */
  from: string;
  /** `17:00`, or empty. Blank on every day of a span but the last. */
  to: string;
  summary: string;
  /**
   * Where the file says it is.
   *
   * Carried for the preview to show and **not put on the line**: the note
   * format has no place for it, and inventing one is a change to what gets
   * written into a vault rather than a detail of an importer.
   */
  location: string;
  /**
   * What the calendar's owner answered: `ACCEPTED`, `DECLINED`, `TENTATIVE`,
   * `NEEDS-ACTION`, or empty for their own blocked time.
   *
   * **Not part of the key.** A meeting whose answer changed is the same
   * meeting, and keying on it would offer every declined invitation a second
   * time as though it were new. What follows from that is worth being plain
   * about: an answer given after the line was written does not reach the note
   * by importing again.
   */
  partstat: string;
  key: string;
  status: CalendarProposalStatus;
  /** True for the statuses that would write. Derived from `status`, for a view that filters. */
  writes: boolean;
  /** Which day of how many, for an occurrence covering several. Null for a single day. */
  span: { index: number; count: number } | null;
  /**
   * The line a `changed-upstream` proposal leaves behind.
   *
   * Nothing here removes it -- §G.6 -- so the preview has to name it, or the
   * person is left with two lines and no idea which is which.
   */
  stale: ExistingEntry | null;
  /**
   * The line this proposal would rewrite **in place**, and only its marker.
   *
   * Set on `answer-changed` and nowhere else. It is the one write in this
   * feature that touches a line already in a note, so it is a named field
   * rather than something a caller infers from a status: the day, the time and
   * the text are kept exactly, and a caller that cannot reproduce the line
   * character for character must leave it alone and say so.
   */
  updates: ExistingEntry | null;
  /** Rule parts its series carried that the expander does not implement. */
  unsupported: readonly string[];
}

/** A line an earlier export offered that this one no longer produces. */
export interface MissingLine extends PriorLine {
  /** The text of the line as the vault still holds it, when it is still there. */
  entry: ExistingEntry | null;
}

export interface CalendarImportPlan {
  proposals: CalendarProposal[];
  /**
   * Every day a write would touch, sorted.
   *
   * **Not the range it was given.** A holiday from 28 September imported with
   * a September range writes into October, and a preview that reported the
   * range would be lying about the vault (§I.1).
   */
  days: string[];
  toWrite: number;
  /**
   * Lines already in a note whose marker this run would rewrite, because you
   * answered differently after they were written.
   */
  toUpdate: number;
  alreadyPresent: number;
  /** Proposals a person has to look at: edited here, duplicated, or unsupported. */
  needsAttention: number;
  /**
   * Offered by an earlier export, on a day inside this range, and gone from
   * this one (§G.5). `entry` says whether the vault still holds the line, so
   * one that was never taken up is not presented as something to delete.
   */
  missing: MissingLine[];
  /**
   * The days between the last range imported from this source and this one.
   *
   * Null when they adjoin, when this range starts earlier, or on a first
   * import. A gap loses whatever straddles it, and that is silent otherwise
   * (§I.3).
   */
  gap: { from: string; to: string } | null;
  /** Series whose rules the expander could not honour. Nothing from them is written. */
  unsupported: readonly UnsupportedSeries[];
  /** Series whose expansion gave up before reaching the range. */
  truncated: readonly { uid: string; summary: string }[];
}

/**
 * The text of a key, reduced to what two lines have to share to be the same one.
 *
 * Case and run-of-spaces only. Anything more forgiving -- stripping
 * punctuation, folding umlauts -- starts matching two genuinely different
 * meetings, and the cost of that is a meeting silently not imported, which is
 * the failure nobody notices.
 */
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * A line's identity, derived from the line rather than stored in it.
 *
 * The day, the start time and the text: the three things a person reading the
 * note can see. That is the point -- see §D. It is never written into a note,
 * only into the importer's own record, so it has none of the escaping problems
 * `statementRowKey` had to solve for a journal line.
 */
export function meetingKey(day: string, from: string, text: string): string {
  return `${day}~${clockOf(from)}~${normalize(text)}`;
}

/**
 * `9:00` and `09:00` are one time.
 *
 * A person typing a meeting in writes the hour the way they say it; ICS always
 * pads. Left alone, a line somebody typed as `9:00` never matches the same
 * meeting from the export, and the import offers a duplicate of a line already
 * sitting under it.
 */
function clockOf(time: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return time.trim();
  return `${(match[1] ?? '').padStart(2, '0')}:${match[2] ?? ''}`;
}

/** The ISO days from `first` to `last` inclusive. */
function daysFrom(first: string, last: string): string[] {
  const start = parseDayTitle(first);
  if (start === null || last < first) return [first];

  const out: string[] = [];
  let cursor = start;
  // A span longer than a year is a calendar with something wrong in it, and
  // walking it would put four hundred lines in a vault before anybody could
  // read the preview.
  for (let step = 0; step < 400; step += 1) {
    const iso = formatDayTitle(cursor);
    out.push(iso);
    if (iso >= last) break;
    cursor = addDays(cursor, 1);
  }
  return out;
}

/** One day of an occurrence, as the meeting line it becomes. */
/**
 * One occurrence as the one-to-several lines it becomes, in the vault's zone.
 *
 * **The conversion happens here and only here**, which is what keeps the plan
 * and the replay agreeing: `priorLinesOf` walks the same function, so a line an
 * earlier export offered is keyed off the same clock as the line offered now.
 * Converting in two places would be two chances to convert differently, and the
 * symptom would be every meeting in a re-import reported as new and gone at
 * once.
 *
 * `EventOccurrence` has always described its zone as "carried through untouched
 * for the caller to convert". This is that caller, and for a long time it did
 * not convert: it copied the digits, so a `Z` time landed in a note at UTC and
 * a foreign `TZID` landed at somebody else's clock.
 */
export interface OccurrenceLine {
  day: string;
  /** `09:00`, or empty. Blank on every day of a span but the first. */
  from: string;
  /** `17:00`, or empty. Blank on every day of a span but the last. */
  to: string;
}

export function occurrenceLines(occurrence: EventOccurrence, zone: string): OccurrenceLine[] {
  const start = inZone(
    { date: occurrence.date, time: occurrence.time, zone: occurrence.zone, utc: occurrence.utc },
    zone
  );
  // The end takes the start's zone. One `VEVENT` states one, and a `DTEND` in a
  // zone its own `DTSTART` does not use is a file saying something no calendar
  // application offers to write.
  const stop =
    occurrence.endDate === null
      ? null
      : inZone(
          {
            date: occurrence.endDate,
            time: occurrence.endTime,
            zone: occurrence.zone,
            utc: occurrence.utc,
          },
          zone
        );

  const end = lastDayOf(
    { date: start.date, time: start.time, zone: null, utc: false },
    stop === null ? null : { date: stop.date, time: stop.time, zone: null, utc: false }
  );

  const days = daysFrom(start.date, end);
  const from = start.time ?? '';
  const to = stop?.time ?? '';

  // A span carries its start time on the first day and its end time on the
  // last, and nothing in between -- which is the `-12:00` form the meeting
  // line already understands, rather than a shape invented here.
  return days.map((day, index) => ({
    day,
    from: index === 0 ? from : '',
    to: index === days.length - 1 ? to : '',
  }));
}

/**
 * The lines an earlier export of these occurrences would have offered.
 *
 * The replay's half of the contract, and it exists so the two halves cannot
 * drift: the same `occurrenceLines` splits a multi-day event, the same `meetingKey`
 * names each day, and the same dedupe applies. A caller that derived prior keys
 * itself would agree with the plan until the day one of those three changed,
 * and then it would report every multi-day event as gone.
 */
export function priorLinesOf(occurrences: readonly EventOccurrence[], zone: string): PriorLine[] {
  const seen = new Set<string>();
  const out: PriorLine[] = [];

  for (const occurrence of occurrences) {
    for (const line of occurrenceLines(occurrence, zone)) {
      const identity = `${occurrence.uid} ${line.day}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      out.push({
        uid: occurrence.uid,
        day: line.day,
        key: meetingKey(line.day, line.from, occurrence.summary),
      });
    }
  }
  return out;
}

/**
 * What an import would do, line by line.
 *
 * The statuses are decided in one order, and it is the order that makes them
 * mean anything:
 *
 * 1. **A series with a rule we cannot honour is stopped first**, whatever else
 *    is true of it. Its dates may be both wrong and incomplete, so "already
 *    present" would be a claim about a day we are not sure of.
 * 2. **A line already saying this is already present.** Whether we wrote it or
 *    somebody typed it makes no difference: it is there.
 * 3. **Then the record decides.** If it says we wrote this occurrence and our
 *    line is still there, the export has changed since -- `changed-upstream`.
 *    If our line has gone, somebody removed or rewrote it, and re-importing
 *    would undo that -- `edited-here`, skipped.
 * 4. **Otherwise new.**
 */
export function planCalendarImport(
  expansion: Expansion,
  options: CalendarImportOptions
): CalendarImportPlan {
  const { from, to, existing, history = [] } = options;

  const present = new Map<string, ExistingEntry>();
  for (const entry of existing) {
    const key = meetingKey(entry.day, entry.from, entry.text);
    if (!present.has(key)) present.set(key, entry);
  }

  // The most recent thing said about each occurrence, across every earlier
  // export. Later runs win: an export that corrected an event is what the note
  // was last offered.
  const wrote = new Map<string, PriorLine>();
  for (const range of history) {
    for (const line of range.lines) wrote.set(`${line.uid} ${line.day}`, line);
  }

  const unsupportedUids = new Set(expansion.unsupported.map((series) => series.uid));
  const proposals: CalendarProposal[] = [];
  const proposedKeys = new Set<string>();
  const seenLines = new Set<string>();

  for (const occurrence of expansion.occurrences) {
    const lines = occurrenceLines(occurrence, options.zone);

    lines.forEach((line, index) => {
      // One occurrence covering a day twice is a series repeating faster than
      // its own length -- a ten-day event on a weekly rule. Rare, legal, and
      // two identical lines in one note either way.
      const identity = `${occurrence.uid} ${line.day}`;
      if (seenLines.has(identity)) return;
      seenLines.add(identity);

      const key = meetingKey(line.day, line.from, occurrence.summary);
      const written = wrote.get(identity);
      const staleEntry = written && written.key !== key ? (present.get(written.key) ?? null) : null;

      const here = present.get(key);
      let status: CalendarProposalStatus;
      let stale: ExistingEntry | null = null;
      let updates: ExistingEntry | null = null;
      if (unsupportedUids.has(occurrence.uid)) {
        status = 'unsupported-rule';
      } else if (here) {
        // The line is here. The only thing that can still be wrong about it is
        // what it says you answered, which the key deliberately ignores -- see
        // `partstat` on the proposal. Comparing it here is what makes an answer
        // given after the import reach the note at all.
        if (
          here.partstat !== undefined &&
          answerOf(here.partstat) !== answerOf(occurrence.partstat)
        ) {
          status = 'answer-changed';
          updates = here;
        } else {
          status = 'already-present';
        }
      } else if (proposedKeys.has(key)) {
        status = 'duplicate-in-file';
      } else if (written === undefined) {
        status = 'new';
      } else if (staleEntry !== null) {
        status = 'changed-upstream';
        stale = staleEntry;
      } else {
        status = 'edited-here';
      }

      const writes = WRITES.has(status);
      if (writes) proposedKeys.add(key);

      proposals.push({
        uid: occurrence.uid,
        day: line.day,
        from: line.from,
        to: line.to,
        summary: occurrence.summary,
        location: occurrence.location,
        partstat: occurrence.partstat,
        key,
        status,
        writes,
        span: lines.length > 1 ? { index: index + 1, count: lines.length } : null,
        stale,
        updates,
        unsupported: occurrence.unsupported,
      });
    });
  }

  // What this export still produces, so the earlier one can be asked what it
  // does not. Keyed by occurrence rather than by key, because an event whose
  // text changed is changed, not gone.
  const stillHere = new Set(proposals.map((one) => `${one.uid} ${one.day}`));
  const missing: MissingLine[] = [];
  for (const line of wrote.values()) {
    // **Only days inside this range.** Import September and then October, and
    // every September line is absent from the October export -- not because
    // anything was cancelled but because it was never looked for. §I.2, and it
    // is the same failure as flagging a hand-typed meeting by another route.
    //
    // Note this is the occurrence's day, not the range the earlier import ran
    // under. It is the stronger test and it subsumes the weaker one: an
    // occurrence is only ever offered by a run whose range contains its start.
    if (line.day < from || line.day > to) continue;
    if (stillHere.has(`${line.uid} ${line.day}`)) continue;
    missing.push({ ...line, entry: present.get(line.key) ?? null });
  }

  // Days a line would be added to. A rewritten marker touches a note too, so
  // it is counted here as well: the preview's promise is that it names every
  // day the import will write in, and an in-place edit is a write.
  const days = [
    ...new Set(
      proposals.filter((one) => one.writes || one.status === 'answer-changed').map((one) => one.day)
    ),
  ].sort();

  return {
    proposals,
    days,
    toWrite: proposals.filter((one) => one.writes).length,
    /** Lines already right, and lines whose marker this run would correct. */
    toUpdate: proposals.filter((one) => one.status === 'answer-changed').length,
    alreadyPresent: proposals.filter((one) => one.status === 'already-present').length,
    // An answer this run would correct is work the import does, not work it is
    // asking somebody else to do.
    needsAttention: proposals.filter(
      (one) => !one.writes && one.status !== 'already-present' && one.status !== 'answer-changed'
    ).length,
    missing,
    gap: gapBefore(from, history),
    unsupported: expansion.unsupported,
    truncated: expansion.truncated,
  };
}

/**
 * The days between the last range read from this source and this one.
 *
 * Only forwards. Importing an earlier range than the last one is a backfill,
 * and warning about the ground between them would be warning about the range
 * the person just chose to fill.
 */
function gapBefore(
  from: string,
  history: readonly PriorImport[]
): { from: string; to: string } | null {
  let latest = '';
  for (const range of history) if (range.to > latest) latest = range.to;
  // No separate guard for an empty history, nor for "this range starts before
  // the last one". `parseDayTitle('')` covers the first and the emptiness
  // check at the end covers the second: a backfill puts the last day before
  // the first, and so does an adjoining range. Breaking either guard changed
  // no answer, which is what it means for one to be decoration.
  const after = parseDayTitle(latest);
  const before = parseDayTitle(from);
  if (after === null || before === null) return null;

  const first = formatDayTitle(addDays(after, 1));
  const last = formatDayTitle(addDays(before, -1));
  return first > last ? null : { from: first, to: last };
}
