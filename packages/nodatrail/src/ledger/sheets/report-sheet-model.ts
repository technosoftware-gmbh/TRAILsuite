/**
 * The chart, profit, balance and statement readings, worded and formatted for
 * paper.
 *
 * The readings in `ledger/readings.ts` decide every figure; this decides how
 * each is said. Figures are in the reporting currency with the currency named
 * once in the header, a foreign account says what it holds and at what rate as
 * the tab does, and an account outside a total for want of a rate is marked.
 *
 * App-free, so a test can hold a ledger up against the page it makes.
 */
import { accountLabel, type Account, type ReportGroup } from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import { day, figure, money } from '../../ui/kit/format';
import { rateFor } from '../../shared/rates';
import type { NODAtrailSettings } from '../../settings/types';
import type { ChartReading, IncomeReading, StatementReading } from '../readings';
import type { BalanceSheet } from '@technosoftware/trail-core';
import type { ReportSheet, ReportSheetRow, ReportSheetSection } from './report-sheet';
import type { StatementSheet } from './statement-sheet';
import type { SheetFooter, SheetStat } from './sheet-frame';
import { creditText } from './sheet-footer';

export interface ReportSheetContext {
  settings: NODAtrailSettings;
  lang: string;
  /** The ISO day the sheet is made on. */
  today: string;
  /** The period's title as the period bar shows it: `2026`, `2026-Q3`, `2026-09`. */
  periodLabel: string;
}

/** A rate as it reads rather than as a float prints: 0.94, not 0.9399999999. */
export function displayRate(rate: number | null): string {
  if (rate === null) return '';
  return String(Number(rate.toFixed(8)));
}

function stat(label: string, amount: number): SheetStat {
  return { label, value: figure(amount), negative: amount < 0 };
}

function groupRows(
  group: ReportGroup,
  settings: NODAtrailSettings,
  depth: number,
  rows: ReportSheetRow[]
): void {
  const home = settings.homeCurrency;
  for (const entry of group.accounts) {
    const currency = entry.account.currency;
    const foreign = currency !== null && currency !== home;
    const held = money(entry.stated, currency);
    rows.push({
      kind: 'account',
      label: accountLabel(entry.account),
      depth,
      detail: !foreign
        ? null
        : entry.inTotal
          ? t('ledger.heldAt', { held, rate: displayRate(rateFor(currency, settings)) })
          : t('ledger.heldNoRate', { held, currency: home }),
      amount: entry.inTotal ? figure(entry.amount) : held,
      negative: (entry.inTotal ? entry.amount : entry.stated) < 0,
      outside: !entry.inTotal,
    });
  }
  for (const child of group.children) {
    rows.push({
      kind: 'group',
      label: child.name,
      depth,
      detail: null,
      amount: figure(child.total),
      negative: child.total < 0,
      outside: false,
    });
    groupRows(child, settings, depth + 1, rows);
  }
}

function reportSection(
  title: string,
  group: ReportGroup,
  settings: NODAtrailSettings
): ReportSheetSection {
  const rows: ReportSheetRow[] = [];
  groupRows(group, settings, 0, rows);
  return {
    title,
    totalLabel: t('sheets.report.total', { section: title }),
    total: figure(group.total),
    negative: group.total < 0,
    rows,
  };
}

function accountsIn(group: ReportGroup): Account[] {
  return [...group.accounts.map((entry) => entry.account), ...group.children.flatMap(accountsIn)];
}

function footer(context: ReportSheetContext, groups: readonly ReportGroup[]): SheetFooter {
  const home = context.settings.homeCurrency;
  const foreign = groups
    .flatMap(accountsIn)
    .some((account) => account.currency !== null && account.currency !== home);
  return {
    truth: t('sheets.truth'),
    currency: foreign ? t('sheets.currencyRule') : null,
    credit: creditText(context.settings, context.today),
  };
}

function currencyMeta(context: ReportSheetContext): string {
  return t('sheets.budget.currency', { currency: context.settings.homeCurrency });
}

export function chartSheetModel(reading: ChartReading, context: ReportSheetContext): ReportSheet {
  const { held, flows } = reading;
  const period = context.periodLabel;
  return {
    lang: context.lang,
    title: t('sheets.chart.title', { period }),
    meta: [
      t('sheets.report.asOf', { day: day(held.on) }),
      t('sheets.report.period', { period }),
      currencyMeta(context),
    ],
    stats: [
      stat(t('ledger.assets'), held.assetTotal),
      stat(t('ledger.liabilities'), held.liabilityTotal),
      stat(t('ledger.net'), held.net),
    ],
    sections: [
      reportSection(t('ledger.assets'), held.assets, context.settings),
      reportSection(t('ledger.liabilities'), held.liabilities, context.settings),
      reportSection(t('ledger.income'), flows.income, context.settings),
      reportSection(t('ledger.expense'), flows.expense, context.settings),
    ],
    notes: [],
    footer: footer(context, [held.assets, held.liabilities, flows.income, flows.expense]),
  };
}

export function balanceSheetModel(sheet: BalanceSheet, context: ReportSheetContext): ReportSheet {
  return {
    lang: context.lang,
    title: t('sheets.balance.title', { day: day(sheet.on) }),
    meta: [t('sheets.report.period', { period: context.periodLabel }), currencyMeta(context)],
    stats: [
      stat(t('ledger.assets'), sheet.assetTotal),
      stat(t('ledger.liabilities'), sheet.liabilityTotal),
      stat(t('ledger.net'), sheet.net),
    ],
    sections: [
      reportSection(t('ledger.assets'), sheet.assets, context.settings),
      reportSection(t('ledger.liabilities'), sheet.liabilities, context.settings),
    ],
    notes: [],
    footer: footer(context, [sheet.assets, sheet.liabilities]),
  };
}

export function incomeSheetModel(reading: IncomeReading, context: ReportSheetContext): ReportSheet {
  const period = context.periodLabel;
  const common = {
    lang: context.lang,
    meta: [t('sheets.report.period', { period }), currencyMeta(context)],
  };

  if (reading.basis === 'cash') {
    const report = reading.report;
    return {
      ...common,
      title: t('sheets.income.titleCash', { period }),
      stats: [
        stat(t('ledger.expense'), report.expenseTotal),
        stat(t('ledger.basisSettled'), report.settledTotal),
        stat(t('ledger.basisOut'), report.total),
      ],
      sections:
        report.total === 0
          ? []
          : [
              reportSection(t('ledger.expense'), report.expense, context.settings),
              reportSection(t('ledger.basisSettled'), report.settled, context.settings),
            ],
      notes: [
        `${t('ledger.basisCash')}: ${t('ledger.basisCashHint')}`,
        ...(report.total === 0 ? [t('ledger.nothingInPeriod')] : []),
      ],
      footer: footer(context, [report.expense, report.settled]),
    };
  }

  const report = reading.report;
  const empty = report.incomeTotal === 0 && report.expenseTotal === 0;
  return {
    ...common,
    title: t('sheets.income.title', { period }),
    stats: [
      stat(t('ledger.income'), report.incomeTotal),
      stat(t('ledger.expense'), report.expenseTotal),
      stat(t('ledger.result'), report.result),
    ],
    sections: empty
      ? []
      : [
          reportSection(t('ledger.income'), report.income, context.settings),
          reportSection(t('ledger.expense'), report.expense, context.settings),
        ],
    notes: [
      `${t('ledger.basisAccrual')}: ${t('ledger.basisAccrualHint')}`,
      ...(empty ? [t('ledger.nothingInPeriod')] : []),
    ],
    footer: footer(context, [report.income, report.expense]),
  };
}

export function statementSheetModel(
  reading: StatementReading,
  byNumber: ReadonlyMap<number, Account>,
  context: ReportSheetContext
): StatementSheet {
  const { account } = reading;
  const currency = account.currency ?? context.settings.homeCurrency;
  const identity = account.iban ?? account.bankAccount;
  const inward = reading.rows.reduce((sum, row) => sum + Math.max(row.change, 0), 0);
  const outward = reading.rows.reduce((sum, row) => sum + Math.max(-row.change, 0), 0);

  return {
    lang: context.lang,
    title: t('sheets.statement.title', { account: accountLabel(account) }),
    meta: [
      t('sheets.report.period', { period: context.periodLabel }),
      ...(identity ? [identity] : []),
      t('sheets.budget.currency', { currency }),
    ],
    stats: [
      stat(t('ledger.opening'), reading.opening),
      stat(t('sheets.statement.inward'), inward),
      stat(t('sheets.statement.outward'), outward),
      stat(t('sheets.statement.closing'), reading.closing),
    ],
    labels: {
      date: t('ledger.postingDate'),
      text: t('sheets.statement.text'),
      other: t('ledger.bookedTo'),
      inward: t('sheets.statement.inward'),
      outward: t('sheets.statement.outward'),
      balance: t('ledger.balance'),
      opening: t('ledger.opening'),
      closing: t('sheets.statement.closing'),
    },
    opening: figure(reading.opening),
    closing: figure(reading.closing),
    rows: reading.rows.map((row) => {
      const other = row.other === null ? undefined : byNumber.get(row.other);
      return {
        date: day(row.posting.date),
        text: row.posting.text || t('ledger.noText'),
        reference: row.posting.reference,
        other: other ? accountLabel(other) : t('ledger.unassigned'),
        inward: row.change > 0 ? figure(row.change) : '',
        outward: row.change < 0 ? figure(-row.change) : '',
        balance: figure(row.balance),
        negativeBalance: row.balance < 0,
      };
    }),
    empty: reading.rows.length === 0 ? t('ledger.nothingInPeriod') : null,
    footer: {
      truth: t('sheets.truth'),
      currency: null,
      credit: creditText(context.settings, context.today),
    },
  };
}
