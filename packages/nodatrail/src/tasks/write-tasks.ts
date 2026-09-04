/**
 * Ticking a box, and unticking it.
 *
 * **One line changes and nothing else does.** The core rewrites the raw line
 * with a targeted replacement of the bracket, appends or removes the done date,
 * and leaves the text, the emoji order and any field it does not recognise
 * exactly as they were. This file is the vault half of that: read, replace,
 * write, stamp.
 *
 * The write refuses when the note has moved on under it, which is not a
 * theoretical case: a view holds a task it scanned a moment ago, and the note
 * may have been edited in another tab since.
 */
import { App } from 'obsidian';
import {
  endOfPeriod,
  parseTaskLine,
  replaceTaskLine,
  setTaskDate,
  setTaskStatus,
  type PeriodLevel,
  type TaskStatus,
  withTaskComment,
} from 'trail-core';
import { hostFor } from '../shared/vault-host';
import { touchModified } from '../shared/note-stamps';
import type { NODAtrailSettings } from '../settings/types';
import type { VaultTask } from './read-tasks';

/**
 * Sets one task's state.
 *
 * Returns false when nothing was written, either because the line already said
 * what was wanted or because the note no longer holds the line this task came
 * from. A caller that wants to know which of the two happened should re-read.
 */
export async function setTask(
  app: App,
  settings: NODAtrailSettings,
  task: VaultTask,
  status: TaskStatus,
  today: Date
): Promise<boolean> {
  return write(app, settings, task, replacing(task, setTaskStatus(task, status, today)));
}

/** Ticking the box, which is the one thing a NODAtrail view offers to do to somebody else's line. */
export function completeTask(
  app: App,
  settings: NODAtrailSettings,
  task: VaultTask,
  today: Date
): Promise<boolean> {
  return setTask(app, settings, task, 'done', today);
}

/** And putting it back. */
export function reopenTask(
  app: App,
  settings: NODAtrailSettings,
  task: VaultTask,
  today: Date
): Promise<boolean> {
  return setTask(app, settings, task, 'todo', today);
}

/**
 * Plans a task for a day, without moving its line.
 *
 * **Sets the plan and leaves the deadline.** `placingField` prefers `scheduled`
 * over `due`, so this is what makes a task show up on the day somebody chose,
 * and `isOverdue` still reads `due` alone -- a task replanned past its deadline
 * shows on the day it was planned for and reports itself late, which is both
 * true at once and is the point of keeping two dates.
 *
 * A task with no dates at all gains a plan, because an undated task falls in no
 * period and planning one has to give it somewhere to land.
 *
 * **The line is not moved between notes.** A task written in Monday's note and
 * planned for Friday stays in Monday's note, which is where somebody wrote it
 * down. The plan view places it by date and never by which file it is in, so
 * there is nothing to move and nothing to cut out of a file and splice into
 * another. See `docs/design/day-notes.md`.
 *
 * Returns false when the note has moved on under it, on the same terms as
 * `setTask`: a view holds a task it scanned a moment ago.
 */
export async function planTask(
  app: App,
  settings: NODAtrailSettings,
  task: VaultTask,
  day: Date
): Promise<boolean> {
  return write(app, settings, task, replacing(task, setTaskDate(task, 'scheduled', day)));
}

/**
 * Pushes a task out to a whole period: this week, next month.
 *
 * **Sets the deadline to the last day of the period and clears the plan.** That
 * is what "I cannot do this one this week" means: the week is the new limit and
 * no day has been chosen yet. Leaving the old plan in place would keep the task
 * sitting on a day somebody has just said they cannot do it on, because the
 * plan is what places it.
 *
 * The deadline is the period's last day rather than its first, because that is
 * what a period as a deadline says: finished *by* Sunday, not started on Monday.
 */
export async function deferToPeriod(
  app: App,
  settings: NODAtrailSettings,
  task: VaultTask,
  level: PeriodLevel,
  date: Date
): Promise<boolean> {
  const dated = setTaskDate(task, 'due', endOfPeriod(level, date));
  const parsed = parseTaskLine(dated);
  // Re-parsed rather than edited twice against the original: the first edit
  // moved the text, and `setTaskDate` works from `raw`.
  const cleared = parsed ? setTaskDate(parsed, 'scheduled', null) : dated;
  return write(app, settings, task, replacing(task, cleared));
}

/**
 * Read, apply one edit, write, stamp. Shared by every write above.
 *
 * It takes a transform over the note's whole text rather than a replacement
 * line, which is what lets closing a task tick the box AND write the comment
 * under it in a single read and a single write. Two writes would each re-read
 * the note, and the second would work from line numbers the first had already
 * moved.
 *
 * `tests/plan-and-defer.test.ts` insists there is exactly one `replaceTaskLine`
 * and one `modify` in this file, and it is right to: three copies of this
 * sequence would eventually disagree about the refuse-when-the-note-moved rule,
 * which is what protects a note somebody is editing in another tab.
 */
/**
 * Closes a task and writes why, in one edit.
 *
 * **One read and one write, rather than closing and then commenting.** Two
 * writes to the same note would each re-read it, and the second would be
 * working from line numbers the first had already changed -- which is fine
 * today, when a comment is the same number of lines it replaces, and is a bug
 * waiting for the first case where it is not.
 *
 * The comment goes under the line and the line itself is only ticked, so
 * everything else in the vault that reads that line sees what it always saw.
 * `taskComment()` is how it is read back.
 *
 * An empty comment is not an error: it closes the task and removes any comment
 * that was there, which is what somebody clearing the box means.
 */
export async function closeTaskWithComment(
  app: App,
  settings: NODAtrailSettings,
  task: VaultTask,
  comment: string,
  today: Date,
  status: TaskStatus = 'done'
): Promise<boolean> {
  return write(app, settings, task, (text) =>
    withTaskComment(replacing(task, setTaskStatus(task, status, today))(text), task, comment)
  );
}

async function write(
  app: App,
  settings: NODAtrailSettings,
  task: VaultTask,
  edit: (text: string) => string
): Promise<boolean> {
  const host = hostFor(app);
  const text = await host.vault.read(task.file);

  const next = edit(text);
  if (next === text) return false;

  await host.vault.modify(task.file, next);
  await touchModified(app, settings, task.file);
  return true;
}

/** The ordinary edit: one line replaced, nothing else in the note touched. */
function replacing(task: VaultTask, line: string): (text: string) => string {
  return (text) => replaceTaskLine(text, task, line);
}
