/**
 * Parsing one checkbox line, and editing one without rewriting it.
 *
 * The parse is generous and the write is surgical, and that asymmetry is the
 * whole design. Reading has to cope with whatever somebody typed; writing must
 * not "improve" any of it. So every writer here works on the raw line with a
 * targeted replacement, and no writer ever rebuilds a line out of the parsed
 * fields.
 *
 * App-free, and clock-free: a caller that needs today's date passes it in.
 */
import { formatDayTitle } from '../dates/day.js';
import {
  DATE_MARKERS,
  PRIORITY_MARKERS,
  TASK_PRIORITIES,
  type ParsedTask,
  type TaskDraft,
  type TaskPriority,
  type TaskStatus,
} from './types.js';

/** `  - [ ] ` and its variants, with the bracket content captured verbatim. */
const CHECKBOX = /^(\s*)([-*+]|\d+[.)])\s+\[(.)\]\s?(.*)$/;

/** The bracket alone, for the one edit this module makes. */
const BRACKET = /^(\s*(?:[-*+]|\d+[.)])\s+\[)(.)(\])/;

/** The recurrence emoji, whose length in UTF-16 units is not one. */
const RECURRENCE = '\u{1F501}';

/** An ISO day, for the value after a dated field's emoji. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A tag, deliberately allowing the nesting Obsidian allows. */
const TAG = /(^|\s)#([\p{L}\p{N}_/-]+)/gu;

const WIKILINK = /!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

/**
 * What a bracket character means.
 *
 * Anything not listed reads as `todo`, which is the safe direction: an unknown
 * character is most often a theme's decoration on something still outstanding,
 * and calling it done would take it off a list silently.
 */
function statusFor(char: string): TaskStatus {
  const normalized = char.toLowerCase();
  if (normalized === 'x') return 'done';
  if (normalized === '/') return 'inProgress';
  if (normalized === '-') return 'cancelled';
  return 'todo';
}

/** The character to write for a status. */
export function statusChar(status: TaskStatus): string {
  if (status === 'done') return 'x';
  if (status === 'inProgress') return '/';
  if (status === 'cancelled') return '-';
  return ' ';
}

/** The ISO day following a marker, or null. Non-global so each call starts fresh. */
function dateAfter(text: string, marker: string): string | null {
  const index = text.indexOf(marker);
  if (index === -1) return null;

  const rest = text.slice(index + marker.length).trimStart();
  const candidate = rest.slice(0, 10);
  return ISO_DAY.test(candidate) ? candidate : null;
}

/**
 * The recurrence rule, which runs to the next field marker or the end of the
 * line.
 *
 * Kept as written and never interpreted. `every other week on Tuesday` is the
 * Tasks plugin's language, that plugin computes the next occurrence, and a
 * second implementation of that here would be a second answer to the same
 * question.
 */
function recurrenceAfter(text: string): string | null {
  const index = text.indexOf(RECURRENCE);
  if (index === -1) return null;

  const rest = text.slice(index + RECURRENCE.length);
  const stop = markerPositions(rest).sort((a, b) => a - b)[0] ?? rest.length;
  const rule = rest.slice(0, stop).trim();
  return rule === '' ? null : rule;
}

/** Where every known field marker starts in a string, for finding the end of a free-text field. */
function markerPositions(text: string): number[] {
  return [...Object.values(DATE_MARKERS), ...Object.values(PRIORITY_MARKERS)]
    .map((marker) => text.indexOf(marker))
    .filter((index) => index !== -1);
}

function priorityIn(text: string): TaskPriority | null {
  // Highest first, so a line carrying two markers reports the stronger claim
  // rather than whichever happened to be written first.
  return TASK_PRIORITIES.find((priority) => text.includes(PRIORITY_MARKERS[priority])) ?? null;
}

/**
 * The description with the recognised fields taken off.
 *
 * Tags and links stay. They are part of what the task says, not metadata about
 * it, and a list that showed "Steuererklärung einreichen" without its `#steuern`
 * would be hiding the one word that says which area it belongs to.
 */
function descriptionOf(body: string): string {
  const cut = markerPositions(body).sort((a, b) => a - b)[0];
  const recurrenceAt = body.indexOf(RECURRENCE);
  const first = [cut, recurrenceAt === -1 ? undefined : recurrenceAt]
    .filter((index): index is number => index !== undefined)
    .sort((a, b) => a - b)[0];

  return (first === undefined ? body : body.slice(0, first)).trim();
}

/**
 * One line, parsed, or null when it is not a checkbox at all.
 *
 * Null rather than a task with an empty description: a bullet that is not a
 * checkbox is prose, and a reader that turned every list item in a vault into
 * an outstanding task would be unusable on the first note it met.
 */
export function parseTaskLine(line: string): ParsedTask | null {
  const match = CHECKBOX.exec(line);
  if (!match) return null;

  const body = match[4] ?? '';
  const char = match[3] ?? ' ';

  return {
    raw: line,
    indent: match[1] ?? '',
    marker: match[2] ?? '-',
    statusChar: char,
    status: statusFor(char),
    text: descriptionOf(body),
    priority: priorityIn(body),
    created: dateAfter(body, DATE_MARKERS.created),
    start: dateAfter(body, DATE_MARKERS.start),
    scheduled: dateAfter(body, DATE_MARKERS.scheduled),
    due: dateAfter(body, DATE_MARKERS.due),
    done: dateAfter(body, DATE_MARKERS.done),
    cancelled: dateAfter(body, DATE_MARKERS.cancelled),
    recurrence: recurrenceAfter(body),
    tags: [...body.matchAll(TAG)].map((tag) => tag[2] ?? '').filter((tag) => tag !== ''),
    links: [...body.matchAll(WIKILINK)]
      .map((link) => (link[1] ?? '').split('#')[0]?.split('^')[0]?.trim() ?? '')
      .filter((target) => target !== ''),
  };
}

/** Removes one dated field from a line, marker and value together, leaving the spacing either side sane. */
function withoutDatedField(line: string, marker: string): string {
  const pattern = new RegExp(`\\s*${marker}\\s*\\d{4}-\\d{2}-\\d{2}`, 'u');
  return line.replace(pattern, '');
}

/**
 * The line with a new checkbox state, and the done date kept in step.
 *
 * **The only write this module makes, and it edits `raw` in place.** Ticking a
 * box adds a done date if the line has none; unticking removes the one it has.
 * Nothing else on the line is touched: not the spacing, not the emoji order,
 * not a field this parser does not recognise.
 *
 * A cancelled task gets a cancelled date on the same terms, because the Tasks
 * plugin writes one and a line that lost it on the round trip would have lost
 * information.
 */
export function setTaskStatus(task: ParsedTask, status: TaskStatus, today: Date): string {
  const day = formatDayTitle(today);
  // Only the character between the brackets is replaced. Rebuilding the line
  // from the captured groups would have silently normalised the whitespace
  // after the bracket, which is a change to somebody's file made in passing.
  let line = task.raw.replace(BRACKET, (_whole, before: string, _char: string, after: string) => {
    return `${before}${statusChar(status)}${after}`;
  });

  if (status === 'done') {
    line = withoutDatedField(line, DATE_MARKERS.cancelled);
    if (!dateAfter(line, DATE_MARKERS.done)) {
      line = `${line.trimEnd()} ${DATE_MARKERS.done} ${day}`;
    }
  } else {
    line = withoutDatedField(line, DATE_MARKERS.done);
  }

  if (status === 'cancelled') {
    if (!dateAfter(line, DATE_MARKERS.cancelled)) {
      line = `${line.trimEnd()} ${DATE_MARKERS.cancelled} ${day}`;
    }
  } else if (status !== 'done') {
    line = withoutDatedField(line, DATE_MARKERS.cancelled);
  }

  return line;
}

/**
 * A new checkbox line, from the little a form asks somebody for.
 *
 * The reading side of this file is old; this is the first thing that writes a
 * line rather than editing one, and it belongs here for the reason a note
 * format always does: the format is a statement about a file, and a composer
 * that lived apart from its parser would be a second opinion about the same
 * one. The round trip is the test -- what this writes, `parseTaskLine` reads
 * back unchanged.
 *
 * **The field order is the Tasks plugin's, not ours.** Description first, then
 * the links, then the priority marker, then the dated fields. A line that put
 * its emoji in the middle of the text would still parse here and would look
 * wrong in every other reader of the same vault.
 *
 * A link is written `[[Title]]` with no alias. The alias would be a second
 * place the project's name is spelled, and renaming the project would fix the
 * target and leave the alias saying the old name.
 */
export function composeTaskLine(draft: TaskDraft): string {
  const parts = [`${draft.indent ?? ''}- [ ]`, draft.text.trim()];

  for (const link of draft.links ?? []) {
    const target = link.trim();
    if (target) parts.push(`[[${target}]]`);
  }

  if (draft.priority) parts.push(PRIORITY_MARKERS[draft.priority]);
  if (draft.due) parts.push(`${DATE_MARKERS.due} ${formatDayTitle(draft.due)}`);
  if (draft.scheduled) parts.push(`${DATE_MARKERS.scheduled} ${formatDayTitle(draft.scheduled)}`);

  return parts.join(' ');
}

/**
 * The line with one dated field set, added or removed.
 *
 * **A surgical edit of `raw`, like every other write here.** The field is
 * removed wherever it was and re-appended at the end, which is where the Tasks
 * plugin writes its dated fields anyway; everything else on the line -- the
 * text, the tags, the links, the emoji this parser does not recognise -- is
 * untouched. Rebuilding the line from the parsed fields would normalise
 * somebody's writing every time a task was deferred.
 *
 * `day` of null removes the field, which is how a date is cleared.
 */
export function setTaskDate(
  task: ParsedTask,
  field: 'due' | 'scheduled' | 'start',
  day: Date | null
): string {
  const marker = DATE_MARKERS[field];
  const without = withoutDatedField(task.raw, marker);
  if (day === null) return without;
  return `${without.trimEnd()} ${marker} ${formatDayTitle(day)}`;
}

/** Ticking a box, which is the one thing a NODAtrail view offers to do to somebody else's line. */
export function completeTaskLine(task: ParsedTask, today: Date): string {
  return setTaskStatus(task, 'done', today);
}

/** Unticking it again. */
export function reopenTaskLine(task: ParsedTask): string {
  // The date is irrelevant here: reopening only ever removes a date, and
  // passing a real one would suggest otherwise at every call site.
  return setTaskStatus(task, 'todo', new Date(2000, 0, 1));
}
