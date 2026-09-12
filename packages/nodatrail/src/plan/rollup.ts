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
import { isInPeriod, isOverdue, type ParsedTask } from '@technosoftware/trail-core';
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
