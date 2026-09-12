/**
 * The four levels a person picks from, and how each is written down.
 *
 * **One vocabulary, two formats.** A PARA note records a number, because that
 * number is also what orders areas in a view; a task records the Obsidian Tasks
 * plugin's emoji, because a task line is that plugin's format and not this
 * suite's. Naming the levels once is what keeps a project called "Hoch" and a
 * task called "Hoch" meaning the same thing.
 *
 * **Four, where the task format has five.** The plugin's five run from `lowest`
 * to `highest`; these write four of them and leave `lowest` alone. That is the
 * asymmetry worth stating: what a form *offers* may be narrower than what a
 * format *holds*, and reading has to stay wide even where writing is narrow --
 * so `taskPriorityLevel` still answers for a task somebody else marked
 * `lowest`, and answers `low`.
 *
 * `null` is not a fifth level. It is the absence of a claim, and it sorts after
 * everything that states one, on the same reasoning the task parser already
 * uses: saying nothing is a weaker claim than saying low.
 */
import type { TaskPriority } from '../tasks/types.js';

export const PRIORITY_LEVELS = ['critical', 'high', 'medium', 'low'] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

/**
 * The number a PARA note records, lowest first.
 *
 * 1 to 4, so a note already carrying 5 or more keeps sorting after the named
 * ones and keeps working -- which is what lets this arrive without rewriting
 * anybody's notes.
 */
const NUMBERS: Readonly<Record<PriorityLevel, number>> = Object.freeze({
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
});

/** The task priority each level is written as. */
const TASK: Readonly<Record<PriorityLevel, TaskPriority>> = Object.freeze({
  critical: 'highest',
  high: 'high',
  medium: 'medium',
  low: 'low',
});

export function priorityNumber(level: PriorityLevel): number {
  return NUMBERS[level];
}

export function priorityTask(level: PriorityLevel): TaskPriority {
  return TASK[level];
}

/**
 * Which level a stored number is, or null.
 *
 * Null for a number outside 1 to 4, which is a note ordered by hand rather than
 * one with no priority: the form shows it as the number it is and leaves it
 * alone until somebody picks a level.
 */
export function priorityLevelOf(value: number | null): PriorityLevel | null {
  return PRIORITY_LEVELS.find((level) => NUMBERS[level] === value) ?? null;
}

/**
 * Which level a task priority is, or null.
 *
 * `lowest` reads as `low`, because a form that offers four has to say something
 * about a line that used the fifth, and the nearest true thing is better than
 * an empty box that would erase the marker on the next save.
 */
export function taskPriorityLevel(priority: TaskPriority | null): PriorityLevel | null {
  if (priority === null) return null;
  if (priority === 'lowest') return 'low';
  return PRIORITY_LEVELS.find((level) => TASK[level] === priority) ?? null;
}
