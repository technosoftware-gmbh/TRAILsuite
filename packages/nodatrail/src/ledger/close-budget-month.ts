/**
 * Closing a month of the budget year, and taking it back.
 *
 * Closing is what turns a month on the rolling year from plan into what
 * happened. It is somebody's decision rather than the calendar's, taken once
 * the month's statements are in, so it is an action that writes
 * `closedThrough` on the year's budget note and nothing else.
 *
 * One month at a time in both directions. Closing jumps no months, because
 * the month after the last closed one is the only one anybody is ever ready
 * to close; reopening takes back the last, because that is the one a late
 * statement belongs to.
 */
import { App, Notice } from 'obsidian';
import { clampClosedThrough, type AccountBudgetRecord } from '@technosoftware/trail-core';
import type { TFile } from 'obsidian';
import { whenIndexed } from '@technosoftware/trail-core/obsidian';
import { t } from '../lang/I18nManager';
import type { NODAtrailSettings } from '../settings/types';
import { monthName } from '../ui/kit/format';

async function writeClosed(
  app: App,
  settings: NODAtrailSettings,
  budget: AccountBudgetRecord<TFile>,
  value: number
): Promise<void> {
  const key = settings.budgetClosedThroughProperty;
  const indexed = whenIndexed(app, { path: budget.file.path });
  await app.fileManager.processFrontMatter(budget.file, (frontmatter: Record<string, unknown>) => {
    // Removed at nothing rather than written as 0, like the note builder:
    // a budget with nothing closed looks the way every budget always did.
    if (value > 0) frontmatter[key] = value;
    else delete frontmatter[key];
  });
  // Resolved once the cache has re-read the note, so a view redrawn after
  // this shows the month it was just told about rather than the one before.
  await indexed;
}

/** Closes the month after the last closed one. */
export async function closeNextBudgetMonth(
  app: App,
  settings: NODAtrailSettings,
  budget: AccountBudgetRecord<TFile>
): Promise<void> {
  const closed = clampClosedThrough(budget.closedThrough);
  if (closed >= 12) {
    new Notice(t('ledger.allMonthsClosed', { year: budget.period ?? '' }));
    return;
  }
  await writeClosed(app, settings, budget, closed + 1);
  new Notice(t('ledger.closedMonth', { month: monthName(closed + 1) }));
}

/** Reopens the last closed month. */
export async function reopenLastBudgetMonth(
  app: App,
  settings: NODAtrailSettings,
  budget: AccountBudgetRecord<TFile>
): Promise<void> {
  const closed = clampClosedThrough(budget.closedThrough);
  if (closed <= 0) {
    new Notice(t('ledger.nothingToReopen', { year: budget.period ?? '' }));
    return;
  }
  await writeClosed(app, settings, budget, closed - 1);
  new Notice(t('ledger.reopenedMonth', { month: monthName(closed) }));
}
