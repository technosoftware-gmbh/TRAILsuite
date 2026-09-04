/**
 * A month of a budget, measured against the postings.
 *
 * One place, because three surfaces ask the same question: the ledger view's
 * budget tab, the dashboard, and the `nod-budget` block on a period note.
 * Three copies of "find the year's budget, expand its rhythms, compare the
 * month" would be three chances to disagree about a figure somebody is trying
 * to trust.
 */
import { App, TFile } from 'obsidian';
import {
  budgetYearOf,
  measureBudgetMonth,
  type AccountBudgetRecord,
  type BudgetMeasure,
} from 'trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { readBudgets, readLedger } from './read-ledger';

export interface MeasuredMonth {
  budget: AccountBudgetRecord<TFile>;
  measure: BudgetMeasure;
}

/**
 * The budget for a date's year, measured against that date's month.
 *
 * Null when no budget note covers the year, which is a different thing from a
 * budget of nothing and is said differently on screen.
 */
export async function measureMonth(
  app: App,
  settings: NODAtrailSettings,
  date: Date
): Promise<MeasuredMonth | null> {
  const year = date.getFullYear();
  const budget = readBudgets(app, settings).find((note) => budgetYearOf(note) === year);
  if (!budget) return null;

  const ledger = await readLedger(app, settings);
  return {
    budget,
    measure: measureBudgetMonth(
      budget.lines,
      ledger.accounts,
      ledger.postings,
      year,
      date.getMonth() + 1
    ),
  };
}
