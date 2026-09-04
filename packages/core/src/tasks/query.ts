/**
 * Asking questions of a list of tasks.
 *
 * Every question that involves today takes today as an argument. Nothing here
 * reads a clock, which is what lets the whole module be tested on a fixed date
 * rather than on the day the suite happens to run.
 *
 * App-free.
 */
import { formatDayTitle } from '../dates/day.js';
import { TASK_PRIORITIES, type ParsedTask, type TaskPriority } from './types.js';

/** Outstanding: neither finished nor abandoned. */
export function isOpen(task: Pick<ParsedTask, 'status'>): boolean {
  return task.status === 'todo' || task.status === 'inProgress';
}

/**
 * Past its due date and still open.
 *
 * A task with no due date is never overdue. It is undated, which is a different
 * thing from late, and a list that mixed the two would make the real deadlines
 * impossible to see.
 */
export function isOverdue(task: Pick<ParsedTask, 'status' | 'due'>, today: Date): boolean {
  if (!isOpen(task) || !task.due) return false;
  return task.due < formatDayTitle(today);
}

/** Due today or in the next `days` days, and still open. Today counts, which is what makes `days: 0` mean "today". */
export function isDueWithin(
  task: Pick<ParsedTask, 'status' | 'due'>,
  today: Date,
  days: number
): boolean {
  if (!isOpen(task) || !task.due) return false;

  const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  const from = formatDayTitle(today);
  return task.due >= from && task.due <= formatDayTitle(horizon);
}

/**
 * Which of a task's dates decides the period it falls in.
 *
 * **Scheduled wins over due**, and the two say different things: `due` is when
 * a task must be finished and `scheduled` is the day somebody decided to do it.
 * A task shows up where it is *planned*, and its deadline is what makes it
 * overdue -- see `isOverdue`, which reads `due` and nothing else.
 *
 * That is what lets a deadline survive being replanned. A task that must be
 * done this week is due Sunday; pulling it onto Tuesday sets a plan and leaves
 * the deadline where it was; pushing it to Thursday changes the plan again. Had
 * `due` won, every one of those moves would have rewritten the deadline, and
 * after the first move nothing would remember that the week was ever the real
 * limit.
 *
 * **It used to be the other way round.** That was a convention rather than a
 * decision -- it arrived with the initial import and nothing recorded a reason
 * -- and only a task carrying *both* dates can tell the difference, of which
 * there were none in the vault this was built for when it changed.
 *
 * Null means the task falls in no period at all rather than in every one: a
 * task nobody has dated is not work for this week that somebody forgot to say
 * so about.
 *
 * Split out of `isInPeriod` because a second caller needs the same answer for a
 * different question -- replanning a task has to move the date that places it,
 * or the task does not move -- and two expressions of one rule would eventually
 * disagree about which date that is. `isInPeriod` is written in terms of this
 * so they cannot.
 */
export function placingField(
  task: Pick<ParsedTask, 'due' | 'scheduled'>
): 'due' | 'scheduled' | null {
  if (task.scheduled !== null) return 'scheduled';
  if (task.due !== null) return 'due';
  return null;
}

/** The day that places a task, or null. */
export function placingDay(task: Pick<ParsedTask, 'due' | 'scheduled'>): string | null {
  const field = placingField(task);
  return field === null ? null : task[field];
}

/** Open, and dated inside a closed range on the day that places it. */
export function isInPeriod(
  task: Pick<ParsedTask, 'status' | 'due' | 'scheduled'>,
  fromIso: string,
  toIso: string
): boolean {
  if (!isOpen(task)) return false;

  const day = placingDay(task);
  return day !== null && day >= fromIso && day <= toIso;
}

/** Rank for sorting. An unstated priority sorts after `low`, because saying nothing is a weaker claim than saying low. */
export function priorityRank(priority: TaskPriority | null): number {
  const index = priority === null ? -1 : TASK_PRIORITIES.indexOf(priority);
  return index === -1 ? TASK_PRIORITIES.length : index;
}

/**
 * The order a list of things to do should be read in: soonest first, then by
 * priority, then alphabetically so the order never wobbles between renders.
 *
 * An undated task sorts after every dated one. It is not urgent by default and
 * it is not unimportant either, so it goes below the ones that state a day.
 */
export function byUrgency(a: ParsedTask, b: ParsedTask): number {
  const dueA = a.due ?? '￿';
  const dueB = b.due ?? '￿';
  if (dueA !== dueB) return dueA < dueB ? -1 : 1;

  const rank = priorityRank(a.priority) - priorityRank(b.priority);
  if (rank !== 0) return rank;

  return a.text.localeCompare(b.text);
}

export interface TaskCounts {
  total: number;
  open: number;
  done: number;
  overdue: number;
}

/** What a rollup row says about a set of tasks. Cancelled tasks count in `total` and nowhere else: they happened, and they are not work. */
export function countTasks(tasks: readonly ParsedTask[], today: Date): TaskCounts {
  return {
    total: tasks.length,
    open: tasks.filter(isOpen).length,
    done: tasks.filter((task) => task.status === 'done').length,
    overdue: tasks.filter((task) => isOverdue(task, today)).length,
  };
}
