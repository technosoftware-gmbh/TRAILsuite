/**
 * Turns a year's budget note and the ledger into a printed sheet on disk.
 *
 * The App-bound half: it finds the budget for the year, reads the ledger,
 * asks the core for the rolling year, and hands the worded model to the pure
 * builder. Written into `{financeFolder}/{exportsSubfolder}` and opened in a
 * new tab, replacing an earlier export of the same year.
 */
import { App, Notice } from 'obsidian';
import { budgetYearOf, rollingYear } from '@technosoftware/trail-core';
import { I18nManager, t } from '../../lang/I18nManager';
import type { NODAtrailSettings } from '../../settings/types';
import { toHome } from '../../shared/rates';
import { writeSheet } from '../../shared/write-sheet';
import { previousBudgetYear } from '../previous-budget';
import { readBudgets, readLedger } from '../read-ledger';
import { buildBudgetSheetHtml } from './budget-sheet';
import { budgetSheetModel } from './budget-sheet-model';
import { ledgerSheetPath } from './sheet-path';

/** The language the plugin is speaking, for the document's `lang`. */
export function sheetLanguage(): string {
  try {
    return I18nManager.getInstance().getCurrentLocale();
  } catch {
    return 'en';
  }
}

export async function exportBudgetSheet(
  app: App,
  settings: NODAtrailSettings,
  year: number,
  today: string
): Promise<void> {
  const budgets = readBudgets(app, settings);
  const budget = budgets.find((note) => budgetYearOf(note) === year);
  if (!budget) {
    new Notice(t('ledger.noBudgetForYear', { year: String(year) }));
    return;
  }

  const ledger = await readLedger(app, settings);
  const currency = budget.currency ?? settings.homeCurrency;
  const data = rollingYear(
    budget.lines,
    ledger.accounts,
    ledger.postings,
    year,
    budget.closedThrough,
    {
      convert: (amount, from) => toHome(amount, from, settings),
      via: budget.via,
      previous: previousBudgetYear(budgets, year),
    }
  );

  const html = buildBudgetSheetHtml(
    budgetSheetModel(data, { settings, currency, lang: sheetLanguage(), today })
  );
  await writeSheet(
    app,
    ledgerSheetPath(settings, t('sheets.budget.fileName', { year: String(year) })),
    html
  );
}
