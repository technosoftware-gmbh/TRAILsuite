/**
 * The budget a year opens on, when the year before it is still being planned.
 *
 * A household plans next year in November, before December is closed. The
 * rolling year then opens on the previous budget's projected December rather
 * than the balances booked so far, which would leave out everything still to
 * be paid and received this year. The core decides what that means; this only
 * finds the note, so the view and the printed sheet find the same one.
 *
 * App-free.
 */
import {
  budgetYearOf,
  type ParsedAccountBudget,
  type PreviousBudgetYear,
} from '@technosoftware/trail-core';

export function previousBudgetYear(
  budgets: readonly ParsedAccountBudget[],
  year: number
): PreviousBudgetYear | undefined {
  const before = budgets.find((note) => budgetYearOf(note) === year - 1);
  if (!before) return undefined;
  return { lines: before.lines, closedThrough: before.closedThrough, via: before.via };
}
