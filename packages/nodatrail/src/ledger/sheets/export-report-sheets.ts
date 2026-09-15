/**
 * Turns the chart, profit, balance or statement tab into a printed sheet on
 * disk, with the period, basis and account the tab has on screen.
 *
 * The App-bound half: it reads the ledger, asks the same reading the tab
 * draws, and hands the worded model to a pure builder. Written into
 * `{financeFolder}/{exportsSubfolder}` and opened in a new tab, replacing an
 * earlier export of the same thing.
 */
import { Notice } from 'obsidian';
import type { App } from 'obsidian';
import { accountLabel } from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import type { NODAtrailSettings } from '../../settings/types';
import { toHome } from '../../shared/rates';
import { writeSheet } from '../../shared/write-sheet';
import { readLedger } from '../read-ledger';
import {
  balanceReading,
  chartReading,
  incomeReading,
  statementAccount,
  statementReading,
  type Period,
} from '../readings';
import { sheetLanguage } from './export-budget-sheet';
import { buildReportSheetHtml } from './report-sheet';
import {
  balanceSheetModel,
  chartSheetModel,
  incomeSheetModel,
  statementSheetModel,
  type ReportSheetContext,
} from './report-sheet-model';
import { buildStatementSheetHtml } from './statement-sheet';
import { ledgerSheetPath } from './sheet-path';

export interface ReportSheetRequest {
  tab: 'accounts' | 'statement' | 'income' | 'balance';
  period: Period;
  periodLabel: string;
  basis: 'accrual' | 'cash';
  account: number | null;
  today: string;
}

export async function exportReportSheet(
  app: App,
  settings: NODAtrailSettings,
  request: ReportSheetRequest
): Promise<void> {
  const ledger = await readLedger(app, settings);
  const convert = (amount: number, currency: string | null) => toHome(amount, currency, settings);
  const context: ReportSheetContext = {
    settings,
    lang: sheetLanguage(),
    today: request.today,
    periodLabel: request.periodLabel,
  };

  let name: string;
  let html: string;
  switch (request.tab) {
    case 'accounts': {
      const model = chartSheetModel(chartReading(ledger, request.period, convert), context);
      name = model.title;
      html = buildReportSheetHtml(model);
      break;
    }
    case 'balance': {
      const model = balanceSheetModel(balanceReading(ledger, request.period, convert), context);
      name = t('sheets.balance.fileName', { day: request.period.to });
      html = buildReportSheetHtml(model);
      break;
    }
    case 'income': {
      const model = incomeSheetModel(
        incomeReading(ledger, request.period, request.basis, convert),
        context
      );
      name = model.title;
      html = buildReportSheetHtml(model);
      break;
    }
    case 'statement': {
      const account = statementAccount(ledger.accounts, request.account);
      if (!account) {
        new Notice(t('ledger.noAccounts'));
        return;
      }
      const model = statementSheetModel(
        statementReading(ledger, account, request.period),
        ledger.byNumber,
        context
      );
      name = t('sheets.statement.fileName', {
        account: accountLabel(account),
        period: request.periodLabel,
      });
      html = buildStatementSheetHtml(model);
      break;
    }
  }

  await writeSheet(app, ledgerSheetPath(settings, name), html);
}
