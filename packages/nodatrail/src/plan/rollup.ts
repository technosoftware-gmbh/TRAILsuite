/**
 * What falls inside a period.
 *
 * Pure, and it takes the period as two ISO days rather than as a level and a
 * date, because every caller already has the range and because a function that
 * recomputed it would be a second opinion about where a month ends.
 *
 * **Nothing here is written into a note.** A rollup written into a period note
 * is a rollup that is wrong the next morning.
 */
import {
  byUrgency,
  isInPeriod,
  isOpen,
  isOverdue,
  placingDay,
  type ParsedTask,
} from '@technosoftware/trail-core';
import type { GoalRecord, ProjectRecord } from '../para/board';
import { goalIsAchieved, projectIsCompleted } from '../para/types';

export interface PeriodRange {
  from: string;
  to: string;
}

/** Open tasks whose due or scheduled day falls in the period. */
export function tasksInPeriod<T extends ParsedTask>(tasks: readonly T[], range: PeriodRange): T[] {
  return tasks.filter((task) => isInPeriod(task, range.from, range.to));
}

/**
 * Closed tasks -- done or cancelled -- placed in the period by the same day an
 * open one is placed by.
 *
 * **By the planning day, never by the day it was ticked.** A task written for
 * Monday and finished on Wednesday belongs to Monday: that is where it was
 * planned, that is the day it was part of, and moving it to Wednesday would
 * take it out of the day whose record it is and put it in one it was never on.
 * The done date is in the note and the row opens the note.
 *
 * Cancelled counts with done for the reason a declined meeting is still drawn:
 * a day cleared by calling something off is not a day that was empty, and a
 * list that shows only what survived says it was.
 */
export function closedTasksInPeriod<T extends ParsedTask>(
  tasks: readonly T[],
  range: PeriodRange
): T[] {
  return tasks.filter((task) => !isOpen(task) && inRange(placingDay(task), range));
}

/**
 * The task rows a period's list draws, in the order it draws them.
 *
 * The pure half of the tasks section, kept here rather than in the view for the
 * reason day-buckets.ts is: this suite has no DOM to test, so the decision
 * about *which* rows appear is only checkable while it is still a list.
 *
 * **Closed and open are sorted together rather than appended in a block.** The
 * week draws a declined meeting in its own time slot and not under the day, and
 * a task already done is the same claim about the same hours: it belongs where
 * it was planned, beside what was planned around it. A block at the foot would
 * read as a second list, which is the thing a day view has one of.
 */
export function periodTaskRows<T extends ParsedTask>(
  tasks: readonly T[],
  range: PeriodRange,
  includeClosed = false
): T[] {
  const rows = tasksInPeriod(tasks, range);
  if (includeClosed) rows.push(...closedTasksInPeriod(tasks, range));
  return rows.sort(byUrgency);
}

/**
 * Open tasks already past their day.
 *
 * Not restricted to the period, deliberately: a month note that hid a task
 * three months overdue would be hiding the one thing worth seeing.
 */
export function overdueTasks<T extends ParsedTask>(tasks: readonly T[], today: Date): T[] {
  return tasks.filter((task) => isOverdue(task, today));
}

/** Goals whose deadline falls in the period and which are not reached yet. */
export function goalsDueInPeriod<F>(
  goals: readonly GoalRecord<F>[],
  range: PeriodRange
): GoalRecord<F>[] {
  return goals.filter(
    (goal) => !goal.archived && !goalIsAchieved(goal.note) && inRange(goal.note.deadline, range)
  );
}

/** Projects whose deadline falls in the period and which are not finished. */
export function projectsDueInPeriod<F>(
  projects: readonly ProjectRecord<F>[],
  range: PeriodRange
): ProjectRecord<F>[] {
  return projects.filter(
    (project) =>
      !project.archived &&
      !projectIsCompleted(project.note) &&
      inRange(project.note.deadline, range)
  );
}

/** Anything with a date, placed in the period by it. */
export function inRange(day: string | null, range: PeriodRange): boolean {
  return day !== null && day >= range.from && day <= range.to;
}

export interface PeriodCounts {
  tasks: number;
  overdue: number;
  goals: number;
  projects: number;
  bills: number;
  recurring: number;
}

/** True when a period holds nothing at all, so a view can say so once rather than six times. */
export function isEmptyPeriod(counts: PeriodCounts): boolean {
  return Object.values(counts).every((count) => count === 0);
}
