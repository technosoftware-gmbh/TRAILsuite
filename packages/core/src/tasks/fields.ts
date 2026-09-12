/**
 * Reading a task line back into the few fields a form can hold, and building it
 * again from them.
 *
 * **The inverse of `composeTaskLine`, and only of that.** The parser beside it
 * is generous, because it has to cope with whatever somebody typed; this is
 * narrow on purpose. It undoes one ordering -- text, then the project link,
 * then the priority marker, then the due date -- and it refuses everything else
 * rather than guessing.
 *
 * **Refusing is done by composing, not by inspecting.** `taskFieldsOf()` puts
 * the fields back together and compares the result with the line they came
 * from: equal means the form holds everything the line says, different means
 * the line carries something with no field behind it -- a recurrence, a second
 * date, a marker this suite does not write -- so the line is not offered for
 * editing at all. No rule here recognises any of those by name, which is what
 * keeps it honest as the composer grows.
 *
 * That is the same rule a day entry is held to in NODAtrail, and it is the only
 * thing standing between a dialog and somebody's wording. A form that edited a
 * line it could not reproduce would drop the part it has no box for, and a
 * vault is where that is discovered months later.
 *
 * App-free and clock-free: strings in, strings out.
 */
import { parseDayTitle } from '../dates/day.js';
import { composeTaskLine } from './line.js';
import { priorityTask, taskPriorityLevel, type PriorityLevel } from '../priority/priority.js';
import { DATE_MARKERS, type ParsedTask } from './types.js';

/** A due date at the very end of a line, which is where `composeTaskLine` puts one. */
const TRAILING_DUE = new RegExp(`\\s+${DATE_MARKERS.due}\\s+(\\d{4}-\\d{2}-\\d{2})$`, 'u');

/** One wikilink at the very end, which is where `composeTaskLine` puts the project. */
const TRAILING_LINK = /\s+\[\[([^[\]]+)\]\]$/;

/** Any day a line names for itself: due, scheduled or start. */
const NAMES_A_DAY = new RegExp(
  `[${DATE_MARKERS.due}${DATE_MARKERS.scheduled}${DATE_MARKERS.start}]\\s*\\d{4}-\\d{2}-\\d{2}`,
  'u'
);

/** The three fields a line carries besides its box: what it says, what it is about, when it is due. */
export interface TaskLineFields {
  text: string;
  /** One wikilink target, or empty. */
  context: string;
  /** ISO day, or empty. */
  due: string;
}

/** The same, plus the priority a full task form offers. */
export interface EditableTaskFields extends TaskLineFields {
  priority: PriorityLevel | null;
}

/**
 * The project link at the end of a description, lifted out of it.
 *
 * For a description a parse has already stripped of dates and markers, where
 * whatever link remains at the end is the one `composeTaskLine` wrote. A link
 * anywhere else stays in the text, because moving it to the end is not this
 * function's business and would not compose back.
 */
export function splitTaskLink(description: string): { text: string; context: string } {
  const linked = TRAILING_LINK.exec(description);
  if (!linked) return { text: description.trim(), context: '' };
  return {
    text: description.slice(0, linked.index).trim(),
    context: (linked[1] ?? '').trim(),
  };
}

/**
 * A raw description split into text, project and due date.
 *
 * For a line nothing has parsed yet: the date is lifted first because it was
 * written last. `NODAtrail`'s meeting follow-ups arrive this way, as the
 * remainder of a checkbox line and nothing else.
 */
export function splitTaskFields(description: string): TaskLineFields {
  let text = description;
  let due = '';

  const dated = TRAILING_DUE.exec(text);
  // Only when the rest of the line names no other day. A line carrying a
  // scheduled date as well as a due one has one field here and two dates to
  // hold, so it keeps both in the text rather than coming back holding one of
  // them and losing the other on the way out.
  if (dated && !NAMES_A_DAY.test(text.slice(0, dated.index))) {
    due = dated[1] ?? '';
    text = text.slice(0, dated.index);
  }

  const { text: rest, context } = splitTaskLink(text);
  return { text: rest, context, due };
}

/** The line these fields make, indented as the task was. */
export function composeTaskFields(task: ParsedTask, fields: EditableTaskFields): string {
  return composeTaskLine({
    indent: task.indent,
    text: fields.text,
    links: fields.context.trim() ? [fields.context.trim()] : [],
    priority: fields.priority ? priorityTask(fields.priority) : null,
    due: parseDayTitle(fields.due),
  });
}

/**
 * What a form may edit on this task, or null when it may not edit it at all.
 *
 * Null is the answer for every line the four fields cannot put back exactly: a
 * recurrence, a scheduled or start date, a done marker, a list marker other
 * than `-`, a box that is not empty. The caller shows no edit action rather
 * than an editor that would quietly rewrite the line into something smaller.
 */
export function taskFieldsOf(task: ParsedTask): EditableTaskFields | null {
  const { text, context } = splitTaskLink(task.text);
  const fields: EditableTaskFields = {
    text,
    context,
    due: task.due ?? '',
    priority: taskPriorityLevel(task.priority),
  };
  return composeTaskFields(task, fields) === task.raw ? fields : null;
}
