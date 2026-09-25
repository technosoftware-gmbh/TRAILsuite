/**
 * What one entry in a day note is, as the dialog and the readers hold it. Pure.
 *
 * Split out of `add-to-day.ts`, which composes lines in the current language
 * and so reaches Obsidian through the i18n manager. The readers only need the
 * shape, and the interchange export reads day notes outside Obsidian;
 * `add-to-day.ts` re-exports all of this, so nothing that imported it from
 * there had to change.
 */
import type { PriorityLevel } from '@technosoftware/trail-core';
import type { Attendance } from './schedule-line';

export const DAY_ENTRY_KINDS = ['task', 'meeting', 'span', 'note', 'idea'] as const;
export type DayEntryKind = (typeof DAY_ENTRY_KINDS)[number];

/**
 * The kinds a dialog may write over a range of days rather than into one note.
 *
 * **A span is still one line in one day's note, N times over.** There is no
 * multi-day entry in the format and this does not add one: §E.3 of
 * `calendar-import.md` settled that, and the calendar import already expands a
 * holiday into one untimed line per day for the only reason that matters -- it
 * is the only shape under which the week view shows the holiday on the days it
 * covers. What is new is that a person can write one without an `.ics`.
 *
 * **A task is not here, and neither is a meeting.** A task carries `due`, which
 * is a day by construction; a meeting carries a clock, and a meeting that ran
 * for a fortnight is not a meeting. The three that remain are the three whose
 * line says nothing about time at all, which is what makes repeating it over a
 * range honest rather than a claim about each day.
 */
export const SPANNING_KINDS: readonly DayEntryKind[] = ['span', 'note', 'idea'];

/** Whether this kind may be written over a range of days. */
export function spans(kind: DayEntryKind): boolean {
  return SPANNING_KINDS.includes(kind);
}

/** What the dialog collected. Everything past `kind` and `text` is optional per kind. */
export interface DayEntryDraft {
  kind: DayEntryKind;
  text: string;
  /** A project or area title, written as a wikilink. The note it points at says which it is. */
  context: string;
  /** Tasks only. */
  due: string | null;
  /** Tasks only. One of the four named levels, or none. */
  priority: PriorityLevel | null;
  /**
   * Meetings only. `HH:mm` each, either or both blank.
   *
   * A meeting is a span rather than an instant, which is what somebody wants to
   * see when they look at a day: not that a thing started at eleven, but that
   * eleven to twelve is gone. An end with no start is still written, because a
   * deadline is a real thing to record and refusing it would lose it.
   */
  startTime: string;
  endTime: string;
  /**
   * Meetings only. What you answered, which decides the marker the line
   * carries.
   *
   * On the draft rather than worked out from the line each time, because the
   * dialog has to be able to put it back exactly: an entry composed without it
   * would come back marked as accepted, stop reproducing the line it came
   * from, and go read-only -- and a meeting you declined is precisely the one
   * you later want to edit.
   */
  attendance: Attendance;
  /**
   * Meetings and spans. Where it was: one note title, written as a child line.
   *
   * **On a child rather than on the headline**, which is the whole of section D
   * of `day-entry-links.md`. The headline is what the derived import key is
   * built from and what the editing dialog has to reproduce character for
   * character; a second link on it would be a new rule in both. A child costs
   * neither.
   */
  place: string;
  /**
   * Meetings and spans. Who was there: one note title each, one child line
   * each.
   *
   * A line each rather than a list on one line, because that is what makes four
   * at a table read as four things and what lets one of them be removed without
   * re-parsing a comma list.
   */
  persons: string[];
  /** Meetings only. One entry per line, blank lines dropped. */
  notes: string;
  /**
   * Meetings only. One row each, because a Friday meeting produces several and
   * they belong to different projects.
   *
   * A row with no text is dropped, which is what an empty row somebody added
   * and did not fill in means.
   */
  followUps: FollowUp[];
}

/**
 * One thing that follows from a meeting.
 *
 * Its own project, because one meeting covers several: fifteen run in parallel
 * here and every one that moved gets discussed on the Friday. Its own date,
 * because "check this next week" is learned in the meeting and setting it there
 * is one field rather than a Move on Monday.
 */
export interface FollowUp {
  text: string;
  /** A project or area title, written as a wikilink. Empty for a task about nothing in particular. */
  context: string;
  /** ISO day, or empty to take the meeting's own. */
  due: string;
}

export function emptyFollowUp(context = ''): FollowUp {
  // The project carries over from the row above: several follow-ups for one
  // project in a row is the commonest shape a meeting produces.
  return { text: '', context, due: '' };
}

export function emptyDraft(kind: DayEntryKind = 'task'): DayEntryDraft {
  return {
    kind,
    text: '',
    context: '',
    due: null,
    priority: null,
    startTime: '',
    endTime: '',
    attendance: '',
    place: '',
    persons: [],
    notes: '',
    followUps: [],
  };
}

/**
 * A draft the dialog may edit without touching the one it came from.
 *
 * **A spread is not enough, and the difference is a bug nobody could get out
 * of.** `followUps` is an array of objects the row editor mutates in place, so
 * a shallow copy leaves the dialog editing the record's own rows. The record's
 * draft is what `rewrite` re-composes to check the note has not moved under
 * it, so adding a follow-up changed the thing the guard measures against: the
 * note could never match, the entry refused to save, and reloading the view
 * did not help because the next copy shared the same array again.
 *
 * Copied field by field rather than through JSON, which would turn `due: null`
 * into something else on the next field somebody adds.
 */
export function copyDraft(draft: DayEntryDraft): DayEntryDraft {
  // `persons` is an array the list editor splices in place, so it needs the
  // same treatment `followUps` needed and for the same reason.
  return {
    ...draft,
    persons: [...draft.persons],
    followUps: draft.followUps.map((row) => ({ ...row })),
  };
}
