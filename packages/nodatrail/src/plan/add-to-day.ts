/**
 * Turning what a dialog asked for into the lines a day note gets.
 *
 * Kept apart from the dialog so the shape of an entry is testable without an
 * Obsidian modal, which is the same split `nav-block.ts` made and for the same
 * reason: what goes into somebody's note is worth pinning, and a test that has
 * to open a dialog to check it never gets written.
 *
 * **The kind decides the heading.** Nothing asks which section an entry belongs
 * under, because a task belongs under tasks and a meeting under meetings, and a
 * dialog that asked would be a dialog with one more question in it.
 *
 * A checkbox line is composed by the core, in the Tasks plugin's format. The
 * other three are this plugin's own body convention and carry a marker from
 * settings.
 */
import { composeTaskLine, priorityTask } from '@technosoftware/trail-core';
import { tAll } from '../lang/I18nManager';
import type { NODAtrailSettings } from '../settings/types';
import type { DayEntryDraft, DayEntryKind } from './day-draft';
import type { Attendance } from './schedule-line';
import { dayHeadings } from './day-headings';

export {
  DAY_ENTRY_KINDS,
  SPANNING_KINDS,
  copyDraft,
  emptyDraft,
  emptyFollowUp,
  spans,
  type DayEntryDraft,
  type DayEntryKind,
  type FollowUp,
} from './day-draft';

/**
 * The headings an entry of this kind may be filed under, best first.
 *
 * **A blank setting means the translated default**, not "no heading". A vault
 * that never configures this gets headings in its own language; one that fills
 * the field in owns the words for good.
 *
 * **Several, not one, and this is the important part.** The first is what a new
 * heading is written as. The rest are spellings a note may already carry and
 * that must therefore be recognised: every other language's default. Without
 * that, a vault that switches language looks for `## 🎯 Fokus` in a note holding
 * `## 🎯 Focus`, fails to find it, and writes a second heading beside the
 * first -- quietly, in a note somebody is keeping records in, which is exactly
 * the failure this module is most careful about.
 *
 * A configured heading leads but does not replace the defaults, so filling the
 * setting in also finds the notes written before it was filled in.
 */
export function headingsFor(settings: NODAtrailSettings, kind: DayEntryKind): string[] {
  return dayHeadings(settings, kind, tAll);
}

/** A date the way a task line writes one, or null. */
function dueDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Whether a follow-up somebody typed already names a day of its own. */
function statesADate(text: string): boolean {
  return /[\u{1F4C5}\u{23F3}\u{1F6EB}]\s*\d{4}-\d{2}-\d{2}/u.test(text);
}

/**
 * A run of spaces inside a line, reduced to one.
 *
 * **A line this plugin writes has to be a line it can read back.**
 * `parseScheduleLine` collapses whitespace as it reads, so an entry whose text
 * carries a double space parses to one space, composes back with one space,
 * and no longer matches the line it came from -- which makes the entry
 * read-only the moment it is written. It looked like a bug in the editor and
 * was a bug in the writer.
 *
 * Found through the calendar import, which writes whatever a `SUMMARY` says,
 * and a real Outlook calendar says `PTM  incl. Change Board`. But the dialog
 * had it too: type two spaces in the text field and the entry could not be
 * edited afterwards.
 *
 * Applied to the text a person or a file supplied, never to a wikilink: a note
 * title may legitimately hold two spaces, and rewriting one would break the
 * link rather than tidy it. Markdown renders a run of spaces as one anyway, so
 * nothing visible is lost.
 */
export function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * The marker a meeting line carries, from what was answered.
 *
 * A blank setting falls back to the ordinary meeting marker rather than to no
 * marker at all: clearing `dayMeetingDeclinedMarker` means "do not distinguish
 * these", not "write these as bare bullets".
 */
export function markerFor(settings: NODAtrailSettings, attendance: Attendance): string {
  const chosen =
    attendance === 'tentative'
      ? settings.dayMeetingTentativeMarker
      : attendance === 'unanswered'
        ? settings.dayMeetingUnansweredMarker
        : attendance === 'declined'
          ? settings.dayMeetingDeclinedMarker
          : '';
  return chosen.trim() === '' ? settings.dayMeetingMarker : chosen;
}

/** `- 👥 10:00 text [[Kontext]]`, with every absent part leaving no trace. */
function markedLine(marker: string, parts: readonly string[], indent = ''): string {
  const words = [marker.trim(), ...parts.map((part) => part.trim())].filter((part) => part !== '');
  return `${indent}- ${words.join(' ')}`;
}

/**
 * `11:00-12:00`, `11:00`, `-12:00`, or nothing.
 *
 * Written with no spaces around the dash so the whole span is one word: a
 * reader scanning the line sees where the entry's time ends and its subject
 * begins, and a later parser has one token rather than three.
 */
export function timeSpan(draft: Pick<DayEntryDraft, 'startTime' | 'endTime'>): string {
  const from = draft.startTime.trim();
  const to = draft.endTime.trim();
  if (from && to) return `${from}-${to}`;
  if (from) return from;
  if (to) return `-${to}`;
  return '';
}

/** A wikilink, or nothing at all. */
function contextLink(context: string): string {
  const title = context.trim();
  return title ? `[[${title}]]` : '';
}

/**
 * Whether this kind of entry may carry a place and the people who were there.
 *
 * **A meeting and a span, and not the other three.** A task is a thing to do
 * rather than a thing that happened; a note and an idea are one line each and
 * a child under them would be a second line saying something the line itself
 * could have said.
 *
 * The span was ruled out once, on the note that a span "is a fortnight away and
 * has no room". That was right about a holiday and wrong about a week in a
 * hotel, which has a place and the people who came. See J.8 of
 * `docs/design/day-entry-links.md`.
 */
export function carriesPlace(kind: DayEntryKind): boolean {
  return kind === 'meeting' || kind === 'span';
}

/**
 * The place and person lines under an entry, in that order.
 *
 * **The order is part of the format**, because the round-trip rule compares
 * composed lines to the lines in the note one by one. Place first, then the
 * people in the order they were named: what a reader wants first is where, and
 * a person moved up or down in the list is a change somebody made on purpose.
 *
 * A blank marker writes nothing at all rather than an unmarked child, because
 * an unmarked child cannot be told from a note. That is the same reading a
 * blank `dayIdeaMarker` already gets.
 */
export function childLines(settings: NODAtrailSettings, draft: DayEntryDraft): string[] {
  if (!carriesPlace(draft.kind)) return [];

  const lines: string[] = [];
  const place = draft.place.trim();
  if (place && settings.dayPlaceMarker.trim()) {
    lines.push(markedLine(settings.dayPlaceMarker, [contextLink(place)], '    '));
  }

  if (settings.dayPersonMarker.trim()) {
    for (const person of draft.persons) {
      const title = person.trim();
      if (title) lines.push(markedLine(settings.dayPersonMarker, [contextLink(title)], '    '));
    }
  }
  return lines;
}

/**
 * The lines this entry becomes, in the order they go into the note.
 *
 * A meeting is several lines and that is the point of capturing one as a unit:
 * what was said and what follows are written as its children in the same
 * breath, so nothing has to parse the note back later to work out which meeting
 * a note belonged under.
 *
 * Empty when there is nothing to say. A caller that wrote an entry with no text
 * would be putting an empty bullet in somebody's records.
 *
 * **`day` is passed on capture and omitted everywhere else.** It is what an
 * undated task or follow-up is dated with, and dating one is the difference
 * between an entry that appears in the views and one that falls in no period at
 * all. Composing an entry that is already in a note -- to check it round-trips,
 * or to rewrite it after an edit -- passes nothing, so an old undated follow-up
 * still reproduces exactly and stays editable, and nothing already written is
 * dated behind somebody's back.
 */
export function entryLines(
  settings: NODAtrailSettings,
  draft: DayEntryDraft,
  day?: string
): string[] {
  const text = collapseSpaces(draft.text);
  if (!text) return [];

  const link = contextLink(draft.context);

  if (draft.kind === 'task') {
    return [
      composeTaskLine({
        text,
        links: link ? [draft.context.trim()] : [],
        // The four named levels write four of the Tasks plugin's five markers,
        // so a task marked Hoch sorts where the plan view already sorts by
        // urgency rather than carrying a claim only this plugin understands.
        priority: draft.priority ? priorityTask(draft.priority) : null,
        // **An entry in a day's note is that day's unless it says otherwise.**
        // A task with no date falls in no period at all: `placingDay` returns
        // null and every view filters by date, so an undated task written here
        // would be invisible the moment it was saved, which is not what
        // somebody adding it to today meant.
        //
        // Only on capture. `day` is omitted when an existing entry is composed
        // back -- see the note on the parameter -- so nothing is dated twice
        // and nothing already in a note is dated behind somebody's back.
        due: dueDate(draft.due) ?? dueDate(day ?? null),
      }),
    ];
  }

  if (draft.kind === 'meeting') {
    const lines = [
      markedLine(markerFor(settings, draft.attendance), [timeSpan(draft), text, link]),
      ...childLines(settings, draft),
    ];
    for (const note of splitLines(draft.notes)) {
      lines.push(markedLine(settings.dayNoteMarker, [collapseSpaces(note)], '    '));
    }
    for (const followUp of draft.followUps) {
      const text = collapseSpaces(followUp.text);
      if (!text) continue;
      const context = followUp.context.trim();
      lines.push(
        composeTaskLine({
          text,
          links: context ? [context] : [],
          indent: '    ',
          // The same rule as a task, and it matters more here: a follow-up is
          // written in a box rather than on a form with a date field, so
          // without this every one of them would be invisible in every view.
          //
          // **Text that already names a day wins over the row's date field.**
          // `childTasks()` lifts a trailing due date into the row, so a date
          // still sitting in the text is either one somebody typed there or
          // one on a line holding two of them. Appending another marker would
          // leave one line saying two different things, after which it would
          // never round-trip again and its meeting would silently stop being
          // editable. Otherwise: the row's day, or the meeting's, because a
          // follow-up with neither falls in no period at all.
          due: statesADate(text) ? null : (dueDate(followUp.due) ?? dueDate(day ?? null)),
        })
      );
    }
    return lines;
  }

  // Three kinds, one shape, and the marker is the whole of the difference --
  // the same arrangement `note` and `idea` have always had, with one more in
  // it. A span carries no time: writing one would be claiming the holiday
  // starts at nine.
  const marker =
    draft.kind === 'span'
      ? settings.daySpanMarker
      : draft.kind === 'idea'
        ? settings.dayIdeaMarker
        : settings.dayNoteMarker;
  return [markedLine(marker, [text, link]), ...childLines(settings, draft)];
}

/** A box of several lines as the entries it holds, blanks dropped. */
export function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}
