/**
 * What a task row says beside its text: where it came from, and how urgent it is.
 *
 * Four lists draw task rows -- the plan view's period, the period block, the
 * tasks block and a project's tasks in the PARA view -- and each of them used
 * to put the source note's basename under the title and nothing about
 * priority. In a vault whose tasks live in day notes that basename is
 * `2026-09-15`, which put an ISO date on the same row as the locale's
 * "15. September 2026", and a task marked high read exactly like one marked
 * low. Both answers live here once, so the four lists cannot drift apart again.
 *
 * Pure apart from `t()` and the display locale, so the decisions are testable
 * without a DOM.
 */
import { parseDayTitle, taskPriorityLevel, type TaskPriority } from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import { day } from './format';

/**
 * The line under a task's title: the note it is written in.
 *
 * **A day note is named by its date, so its name is drawn as a date**, in the
 * reader's conventions like every other date on the row. And when that date is
 * the one the row already shows at its end, the subtitle is dropped rather
 * than saying the same day twice: a task written in today's note for today is
 * the ordinary case, and a row that repeats it is noise. A task written on
 * Monday and planned for Friday keeps its Monday, because that is the one thing
 * the subtitle tells you that the row does not.
 *
 * Any other note keeps its name as written.
 */
export function taskSourceLabel(basename: string, placingDay: string | null): string | undefined {
  const date = parseDayTitle(basename);
  if (!date) return basename;
  if (placingDay !== null && basename.trim() === placingDay) return undefined;
  return day(basename.trim());
}

export interface PriorityChip {
  text: string;
  tone: 'warn' | 'muted' | undefined;
}

/**
 * The chip a task's priority is drawn as, or null for a task that states none.
 *
 * The word and a colour together, never the colour alone: a red that only
 * means something to somebody who can tell red apart is not a label. Critical
 * and high take the warning tone, because those are the ones a day's list has
 * to catch an eye with; medium stays neutral and low is muted. The four words
 * are the ones the task editor's dropdown offers, so what a row says is what
 * the form will show when it is opened. A task marked `lowest` reads as low,
 * for the reason `taskPriorityLevel` gives.
 */
export function taskPriorityChip(priority: TaskPriority | null): PriorityChip | null {
  const level = taskPriorityLevel(priority);
  if (level === null) return null;
  const tone =
    level === 'critical' || level === 'high' ? 'warn' : level === 'low' ? 'muted' : undefined;
  return { text: t(`priority.${level}`), tone };
}
