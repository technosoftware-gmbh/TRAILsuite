/**
 * What a checkbox line in a note says.
 *
 * The format is the Obsidian Tasks plugin's, which is to say it is not this
 * suite's format at all. That is exactly why the parser is here rather than in
 * a view: a format nobody in this repository controls, already written into
 * hundreds of thousands of vaults, is the strongest possible case of "a note
 * format is an agreement about a file rather than one plugin's model of it".
 * A second parser written inside whatever renders a task list would drift
 * against a spec it cannot change.
 *
 * App-free.
 */

/**
 * The four checkbox states, as their characters.
 *
 * `todo` and `done` are the two Obsidian itself knows. `inProgress` and
 * `cancelled` are conventions the Tasks plugin reads and countless themes
 * render, and a parser that folded them into `todo` would put a cancelled item
 * back on somebody's list.
 */
export const TASK_STATUSES = ['todo', 'done', 'inProgress', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/**
 * The five priorities, in the order they sort.
 *
 * A task with none is not a sixth priority. It is the absence of a claim, and
 * it sorts after `low` rather than between `medium` and `low`, because somebody
 * who marked a task low meant it to outrank the ones they said nothing about.
 */
export const TASK_PRIORITIES = ['highest', 'high', 'medium', 'low', 'lowest'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** The emoji each priority is written with. */
export const PRIORITY_MARKERS: Readonly<Record<TaskPriority, string>> = Object.freeze({
  highest: '\u{1F53A}',
  high: '\u{23EB}',
  medium: '\u{1F53C}',
  low: '\u{1F53D}',
  lowest: '\u{23EC}',
});

/** The emoji each dated field is written with. */
export const DATE_MARKERS = Object.freeze({
  created: '\u{2795}',
  start: '\u{1F6EB}',
  scheduled: '\u{23F3}',
  due: '\u{1F4C5}',
  done: '\u{2705}',
  cancelled: '\u{274C}',
});

/**
 * One checkbox line, parsed.
 *
 * `raw` is the line exactly as it was found, and it is not decoration: every
 * write in this module is a surgical edit of `raw` rather than a re-render from
 * the fields below. A task line carries emoji, tags, links and free text this
 * package has no opinion about, and re-rendering one would quietly normalise
 * somebody's writing every time they ticked a box.
 */
export interface ParsedTask {
  raw: string;
  /** The whitespace the line is indented by, kept so a nested task stays nested. */
  indent: string;
  /** `-`, `*`, `+`, `1.` or `1)`, verbatim. */
  marker: string;
  /** The character between the brackets, verbatim, so an unrecognised one survives a round trip. */
  statusChar: string;
  status: TaskStatus;
  /** The description with every field this parser recognises removed. Tags and links stay: they are part of what a task says. */
  text: string;
  priority: TaskPriority | null;
  /** ISO days. Null where the line states none. */
  created: string | null;
  start: string | null;
  scheduled: string | null;
  due: string | null;
  done: string | null;
  cancelled: string | null;
  /** The recurrence rule as written, never interpreted. Recurrence belongs to the Tasks plugin and this suite does not compete with it. */
  recurrence: string | null;
  tags: string[];
  /** Wikilink targets named anywhere on the line, which is how a task says what it is about. */
  links: string[];
}

/**
 * The little a form asks for when somebody adds a task.
 *
 * Deliberately a small subset of `ParsedTask`. A composer that offered every
 * field the parser reads would be offering a recurrence rule and a cancelled
 * date to somebody typing one line into a dialog, and recurrence in particular
 * belongs to the Tasks plugin rather than to this suite.
 *
 * Everything optional is optional because leaving it out has to mean the line
 * says nothing about it, rather than the line saying "none".
 */
export interface TaskDraft {
  /** What the task says. Trimmed on the way in; the rest of the line is built around it. */
  text: string;
  /** Whitespace to indent by, for a task written under something else. */
  indent?: string;
  priority?: TaskPriority | null;
  due?: Date | null;
  scheduled?: Date | null;
  /** Note titles, written as `[[Title]]`. This is how a task says what it is about. */
  links?: readonly string[];
}

/** A parsed task and where it was found, which is what a view needs to open it. */
export interface TaskLocation {
  /** Zero-based, so it can index straight into a split body. */
  line: number;
}

export type LocatedTask = ParsedTask & TaskLocation;
