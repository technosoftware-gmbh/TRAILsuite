/**
 * Correcting the meeting lines an earlier import wrote at the wrong clock.
 *
 * Until `zones.ts` landed, the importer copied the digits out of the `.ics`
 * and ignored what the file said about them. A `Z` time is an instant, so a
 * 06:00Z meeting went into a Zurich note as 06:00 when it happened at eight;
 * a `TZID` naming somebody else's zone went in at their clock. Only a floating
 * time was right. In one real export of three thousand events, about a third
 * were wrong, by two hours in summer and one in winter.
 *
 * Fixing the reader does not fix the notes. A corrected line derives a
 * different key, so a re-import reports `changed-upstream`, and §G.6 means the
 * old line stays where it is: the vault would end up holding both, an 06:00
 * and an 08:00, with nothing to say which is which. So the notes are repaired
 * before anything is imported again, and this is what does it.
 *
 * ## What it is allowed to do
 *
 * **It rewrites a time in place and nothing else.** Not a delete, not an
 * append: `replaceLines` over the entry's own span with the same entry
 * recomposed, exactly as `updateAnswers` rewrites a marker. Everything the
 * line carries that the times are not -- the text, the attendance marker, the
 * context, the notes indented under it, the follow-ups -- comes from the
 * record read out of the note, so it survives unchanged.
 *
 * The three guards are `updateAnswers`' three, for the same reasons: the entry
 * is found by day, time and text and only when exactly one matches; it must be
 * `editable`, meaning composing it back reproduces the line character for
 * character; and only the two time fields differ between what was read and
 * what is written.
 *
 * ## The one thing it will not do
 *
 * **A line whose day changes is reported, not moved.** A meeting at 23:00Z
 * happens at one in the morning the next day here, so repairing it means
 * taking a line out of one note and putting it in another, which is a delete
 * however it is dressed. Those are named in the preview and left for a person.
 * In the export that prompted this there were three of them, against eight
 * hundred and seventy that only needed their clock corrected.
 */
import { TFile } from 'obsidian';
import type { App } from 'obsidian';
import {
  calendarOwner,
  expandEvents,
  occurrenceLines,
  parseDayTitle,
  parseIcs,
  splitFrontmatterBlock,
  type EventOccurrence,
  type OccurrenceLine,
} from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { hostFor } from '../shared/vault-host';
import { touchModified } from '../shared/note-stamps';
import { entryLines, headingsFor } from './add-to-day';
import { readCalendarArchive } from './calendar-archive';
import { appendUnderHeading, insertLines, replaceLines } from './day-body';
import { notePathFor } from './paths';
import { findDayEntry, meetingsIn, readDayEntries, type DayEntryRecord } from './read-day';
import { normalizeTime } from './day-bands';
import { vaultZone } from './vault-zone';

export type RepairBlocker =
  /** The day changes, so repairing it would mean moving the line between notes. */
  | 'moves-day'
  /** No line in that note says what the old import would have written. */
  | 'not-found'
  /** Two lines on the day are indistinguishable. */
  | 'ambiguous'
  /** The line says something the dialog cannot compose back. */
  | 'not-editable';

/** One line an earlier import wrote at the wrong clock. */
export interface TimeRepair {
  /** Which archived export it was found in, for a preview that has to be believable. */
  source: string;
  summary: string;
  /** The note the line is in, and what it says now. */
  day: string;
  from: string;
  to: string;
  /** The day and clock it should have been written at. */
  wantedDay: string;
  wantedFrom: string;
  wantedTo: string;
  /** Null when the line can be repaired. */
  blocker: RepairBlocker | null;
}

export interface TimeRepairPlan {
  repairs: TimeRepair[];
  /** Archived files that could not be read at all, named rather than counted. */
  unreadable: string[];
}

export interface TimeRepairResult {
  repaired: number;
  notes: number;
  /** Repairs that no longer qualified when the note was read again. */
  refused: TimeRepair[];
}

/** The repairs a run would actually make. */
export function repairable(plan: TimeRepairPlan): TimeRepair[] {
  return plan.repairs.filter((repair) => repair.blocker === null);
}

/** Whether two readings of the same occurrence disagree about when it is. */
function differs(was: OccurrenceLine, now: OccurrenceLine): boolean {
  return was.day !== now.day || was.from !== now.from || was.to !== now.to;
}

/**
 * Every line the archived exports say was written at the wrong clock.
 *
 * Each file is expanded once and read twice: with no zone, which is what the
 * importer did, and with the vault's, which is what it should have done. A
 * pair that disagrees is a line to look for. **The old reading is the search
 * key** -- what is in the note is what the old importer wrote, and looking for
 * the corrected time would find nothing.
 *
 * An occurrence whose two readings cover a different number of days is
 * reported as moving rather than paired position by position, because there is
 * no honest pairing to make.
 */
export async function planTimeRepair(
  app: App,
  settings: NODAtrailSettings
): Promise<TimeRepairPlan> {
  const zone = vaultZone();
  const plan: TimeRepairPlan = { repairs: [], unreadable: [] };
  if (!zone.trim()) return plan;

  const seen = new Set<string>();

  for (const archived of readCalendarArchive(app, settings)) {
    const { from, to } = archived.name;
    // Typed rather than inferred: `let` with no annotation makes this `any`,
    // and every read off it after that is unchecked.
    let occurrences: readonly EventOccurrence[];
    try {
      const text = await app.vault.cachedRead(archived.file);
      occurrences = expandEvents(parseIcs(text), from, to, calendarOwner(text)).occurrences;
    } catch {
      plan.unreadable.push(archived.file.basename);
      continue;
    }

    for (const occurrence of occurrences) {
      const before = occurrenceLines(occurrence, '');
      const after = occurrenceLines(occurrence, zone);

      for (const [index, was] of before.entries()) {
        const now = after[index];
        // A span that changed length has no line-for-line pairing, so its first
        // day is reported as moving and the rest is left alone.
        if (!now || before.length !== after.length) {
          plan.repairs.push(
            moved(archived.file.basename, occurrence.summary, was, after[0] ?? was)
          );
          break;
        }
        if (!differs(was, now)) continue;

        // The same occurrence appears in several archived files whenever their
        // ranges overlap, and this vault has four of them. One repair per line.
        // NUL separates the three fields, written as an escape rather than
        // typed in. It cannot occur in a day, a time or a summary, so no
        // combination of the three can collide with another. It was a literal
        // NUL byte, which made this file binary to grep and to every diff and
        // review tool, and an editor that strips control characters would have
        // silently merged occurrences this is meant to keep apart.
        const identity = `${was.day}\u0000${was.from}\u0000${occurrence.summary}`;
        if (seen.has(identity)) continue;
        seen.add(identity);

        plan.repairs.push(
          await verdictFor(app, settings, archived.file.basename, occurrence.summary, was, now)
        );
      }
    }
  }

  plan.repairs.sort((a, b) => (a.day + a.from).localeCompare(b.day + b.from));
  return plan;
}

function moved(
  source: string,
  summary: string,
  was: OccurrenceLine,
  now: OccurrenceLine
): TimeRepair {
  return {
    source,
    summary,
    day: was.day,
    from: was.from,
    to: was.to,
    wantedDay: now.day,
    wantedFrom: now.from,
    wantedTo: now.to,
    blocker: 'moves-day',
  };
}

/** What can be done about one line, given what its note holds now. */
async function verdictFor(
  app: App,
  settings: NODAtrailSettings,
  source: string,
  summary: string,
  was: OccurrenceLine,
  now: OccurrenceLine
): Promise<TimeRepair> {
  const repair: TimeRepair = {
    source,
    summary,
    day: was.day,
    from: was.from,
    to: was.to,
    wantedDay: now.day,
    wantedFrom: now.from,
    wantedTo: now.to,
    blocker: null,
  };

  if (was.day !== now.day) return { ...repair, blocker: 'moves-day' };

  const date = parseDayTitle(was.day);
  const file =
    date === null ? null : app.vault.getAbstractFileByPath(notePathFor(settings, 'day', date));
  if (!(file instanceof TFile)) return { ...repair, blocker: 'not-found' };

  const record = await findDayEntry(app, settings, file, {
    from: was.from,
    to: was.to,
    text: summary,
  });
  // `findDayEntry` answers null both for nothing and for several, and the two
  // are worth telling apart in a preview: one means the line has already been
  // edited or was never written, the other means a person has to choose.
  if (!record) {
    const twice = await ambiguousOn(app, settings, file, was, summary);
    return { ...repair, blocker: twice ? 'ambiguous' : 'not-found' };
  }
  if (!record.editable) return { ...repair, blocker: 'not-editable' };

  return repair;
}

/** Whether more than one line on the day says exactly this. */
async function ambiguousOn(
  app: App,
  settings: NODAtrailSettings,
  file: TFile,
  was: OccurrenceLine,
  summary: string
): Promise<boolean> {
  const { meetings } = await readDayEntries(app, settings, file);
  return (
    meetings.filter(
      (record) =>
        // Meetings only. A span shares the section and is untimed, so without
        // this an all-day meeting would read as ambiguous against a holiday of
        // the same name and be refused a repair it could have had.
        record.kind === 'meeting' &&
        record.draft.startTime === was.from &&
        record.draft.endTime === was.to &&
        record.draft.text === summary
    ).length > 1
  );
}

/**
 * The one entry in a body that says this, or null for none and null for several.
 *
 * `findDayEntry`'s rule, applied to text this function is holding rather than
 * to a file. The writer needs it that way: it makes several repairs to one note
 * before writing any of them, and a reader that went back to disk between them
 * would hand out positions from a body two edits old. That is not theoretical
 * -- it deleted a meeting and duplicated its neighbour the first time this was
 * run against two repairs in one note.
 */
function findIn(
  body: string,
  settings: NODAtrailSettings,
  wanted: { from: string; to: string; text: string }
): DayEntryRecord | null {
  const matches = meetingsIn(body, settings).filter(
    (record) =>
      record.draft.startTime === wanted.from &&
      record.draft.endTime === wanted.to &&
      record.draft.text === wanted.text
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

/**
 * The body with one entry rewritten and moved to where its new time belongs.
 *
 * **Because the repair is what put it out of order.** `replaceLines` rewrites
 * in place, which is exactly what protects the notes indented under a meeting,
 * and it means a line corrected from 07:00 to 09:00 keeps the slot 07:00
 * earned. Eleven lines in one real vault ended up sitting between 09:30 and
 * 10:00, and a day that lists them out of order is a day nobody trusts.
 *
 * So this is the narrowest possible reordering: **only the entry the repair
 * moved, and only among the timed entries under its own heading.** Everything
 * somebody arranged by hand stays arranged, an entry with no time keeps its
 * place because it has nowhere to sort to, and `appendUnderHeading`'s rule that
 * a write must not tidy a note in passing still holds -- this is not tidying, it
 * is putting back what this same run displaced.
 *
 * Lift, then look, then put down. The entry comes out first and the positions
 * are read again afterwards, because removing it moves everything below it and
 * a destination measured against the old body would be one line out.
 */
function reseat(
  body: string,
  settings: NODAtrailSettings,
  record: DayEntryRecord,
  lines: readonly string[],
  wantedFrom: string
): string {
  const lifted = replaceLines(body, record.from, record.to, []);
  const wanted = normalizeTime(wantedFrom);

  // The first entry that starts later than this one now does. An entry with no
  // time is never that, and needs no test of its own to say so: its start is
  // blank, and blank is greater than nothing. So `Zuhause` at the top of a day
  // is not a boundary to sort against and does not move.
  const after = meetingsIn(lifted, settings).find(
    (one) => normalizeTime(one.draft.startTime) > wanted
  );

  // No later entry means the end of the section, which `appendUnderHeading`
  // already knows how to find -- and it puts the entry back under the same
  // heading even if lifting it emptied the section entirely.
  if (!after) return appendUnderHeading(lifted, headingsFor(settings, 'meeting'), lines);

  return insertLines(lifted, after.from, lines);
}

/**
 * Rewrites the clock on each repairable line, and refuses anything that has
 * changed since the preview.
 *
 * The verdict is taken again here, for the reason every write in this feature
 * takes it again: a `DayEntryRecord` carries line numbers into the body, and a
 * preview can sit on screen for as long as somebody reads it. One read and one
 * write per note, with the note's repairs applied bottom-up so a rewrite never
 * moves the one still to be made -- a recomposed entry is the same number of
 * lines, but that is a property of the composer rather than a promise, and
 * relying on it would be relying on it silently.
 */
export async function writeTimeRepair(
  app: App,
  settings: NODAtrailSettings,
  repairs: readonly TimeRepair[]
): Promise<TimeRepairResult> {
  const result: TimeRepairResult = { repaired: 0, notes: 0, refused: [] };
  const host = hostFor(app);

  const byDay = new Map<string, TimeRepair[]>();
  for (const repair of repairs) {
    if (repair.blocker !== null) continue;
    const held = byDay.get(repair.day);
    if (held) held.push(repair);
    else byDay.set(repair.day, [repair]);
  }

  for (const [day, wanted] of byDay) {
    const date = parseDayTitle(day);
    const file =
      date === null ? null : app.vault.getAbstractFileByPath(notePathFor(settings, 'day', date));
    if (!(file instanceof TFile)) {
      for (const repair of wanted) result.refused.push(repair);
      continue;
    }

    const { header, body } = splitFrontmatterBlock(await host.vault.read(file));
    let next = body;
    let done = 0;

    for (const repair of wanted) {
      const record = findIn(next, settings, {
        from: repair.from,
        to: repair.to,
        text: repair.summary,
      });
      if (!record?.editable) {
        result.refused.push(repair);
        continue;
      }

      next = reseat(
        next,
        settings,
        record,
        entryLines(settings, {
          ...record.draft,
          startTime: repair.wantedFrom,
          endTime: repair.wantedTo,
        }),
        repair.wantedFrom
      );
      done += 1;
    }
    if (done === 0) continue;

    await host.vault.modify(file, `${header}${next}`);
    await touchModified(app, settings, file);
    result.repaired += done;
    result.notes += 1;
  }

  return result;
}
