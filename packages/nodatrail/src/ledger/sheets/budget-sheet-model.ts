/**
 * The rolling budget year, worded and formatted for the page.
 *
 * `rollingYear` in the core decides every figure; this decides how each is
 * said: expenses and debts as negative figures, the way the household
 * spreadsheet this replaces writes them, a blank where an account had nothing
 * in a month, the words beside an unbudgeted account, and the notes that say
 * what Total, Plan and a projected month mean.
 *
 * App-free, so a test can hold a year up against the page it makes.
 */
import {
  accountLabel,
  roundCents,
  type Account,
  type RollingBalanceGroup,
  type RollingGroup,
  type RollingYear,
} from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import { figure, monthName } from '../../ui/kit/format';
import type { NODAtrailSettings } from '../../settings/types';
import type { BudgetSheet, BudgetSheetBalanceRow, BudgetSheetFlowRow } from './budget-sheet';
import { creditText } from './sheet-footer';

export interface BudgetSheetContext {
  settings: NODAtrailSettings;
  /** The currency every figure on the page is in. */
  currency: string;
  /** The language the words are in. */
  lang: string;
  /** The ISO day the sheet is made on. */
  today: string;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/** A figure, shown with its sign flipped where the page shows the section as outgoing. */
function signed(value: number, sign: 1 | -1): number {
  // `|| 0` because nothing negated is -0, which formats as "-0.00".
  return roundCents(value * sign) || 0;
}

/** Blank for nothing on an account row, so a column shows where money moved; totals always print. */
function cell(value: number | null, blankZero: boolean): string {
  if (value === null) return '';
  if (blankZero && value === 0) return '';
  return figure(value);
}

function flowRows(
  group: RollingGroup,
  sign: 1 | -1,
  depth: number,
  rows: BudgetSheetFlowRow[]
): void {
  for (const entry of group.accounts) {
    const months = entry.forecast.map((value) => signed(value, sign));
    const sums = [entry.forecastTotal, entry.planTotal, entry.variance].map((value) =>
      signed(value, sign)
    );
    const marks: string[] = [];
    if (!entry.budgeted) marks.push(t('sheets.budget.unbudgeted'));
    if (!entry.inTotal) marks.push(t('sheets.budget.noRate'));
    rows.push({
      kind: 'account',
      label: accountLabel(entry.account),
      account: entry.account.number,
      depth,
      marks,
      months: months.map((value) => cell(value, true)),
      total: cell(sums[0] ?? 0, false),
      plan: cell(sums[1] ?? 0, true),
      variance: cell(sums[2] ?? 0, true),
      negative: [...months, ...sums].map((value) => value < 0),
    });
  }

  for (const child of group.children) {
    rows.push(groupFlowRow(child, sign, depth, 'group', child.name));
    flowRows(child, sign, depth + 1, rows);
  }
}

function groupFlowRow(
  group: RollingGroup,
  sign: 1 | -1,
  depth: number,
  kind: 'section' | 'group',
  label: string
): BudgetSheetFlowRow {
  const months = group.forecast.map((value) => signed(value, sign));
  const sums = [group.forecastTotal, group.planTotal, group.variance].map((value) =>
    signed(value, sign)
  );
  return {
    kind,
    label,
    account: null,
    depth,
    marks: group.missing > 0 ? [t('sheets.budget.noRate')] : [],
    months: months.map((value) => cell(value, false)),
    total: cell(sums[0] ?? 0, false),
    plan: cell(sums[1] ?? 0, false),
    variance: cell(sums[2] ?? 0, false),
    negative: [...months, ...sums].map((value) => value < 0),
  };
}

function balanceRows(
  group: RollingBalanceGroup,
  sign: 1 | -1,
  depth: number,
  rows: BudgetSheetBalanceRow[]
): void {
  for (const entry of group.accounts) {
    const opening = signed(entry.opening, sign);
    const months = entry.months.map((value) => (value === null ? null : signed(value, sign)));
    rows.push({
      kind: 'account',
      label: accountLabel(entry.account),
      account: entry.account.number,
      depth,
      marks: entry.inTotal ? [] : [t('sheets.budget.noRate')],
      opening: cell(opening, true),
      months: months.map((value) => cell(value, false)),
      negative: [opening, ...months].map((value) => (value ?? 0) < 0),
    });
  }

  for (const child of group.children) {
    rows.push(groupBalanceRow(child, sign, depth, 'group', child.name));
    balanceRows(child, sign, depth + 1, rows);
  }
}

function groupBalanceRow(
  group: RollingBalanceGroup,
  sign: 1 | -1,
  depth: number,
  kind: 'section' | 'group',
  label: string
): BudgetSheetBalanceRow {
  const opening = signed(group.opening, sign);
  const months = group.months.map((value) => (value === null ? null : signed(value, sign)));
  return {
    kind,
    label,
    account: null,
    depth,
    marks: [],
    opening: cell(opening, false),
    months: months.map((value) => cell(value, false)),
    negative: [opening, ...months].map((value) => (value ?? 0) < 0),
  };
}

/** Every account the page names, for the one question the footer asks of them. */
function accountsOn(year: RollingYear): Account[] {
  const flows = (group: RollingGroup): Account[] => [
    ...group.accounts.map((entry) => entry.account),
    ...group.children.flatMap(flows),
  ];
  const held = (group: RollingBalanceGroup): Account[] => [
    ...group.accounts.map((entry) => entry.account),
    ...group.children.flatMap(held),
  ];
  return [
    ...flows(year.income),
    ...flows(year.expense),
    ...held(year.assets),
    ...held(year.liabilities),
  ];
}

function closedLine(closedThrough: number): string {
  if (closedThrough <= 0) return t('sheets.budget.noneClosed');
  if (closedThrough >= 12) return t('sheets.budget.allClosed');
  return t('sheets.budget.closedThrough', { month: monthName(closedThrough) });
}

export function budgetSheetModel(year: RollingYear, context: BudgetSheetContext): BudgetSheet {
  const flows: BudgetSheetFlowRow[] = [];
  flows.push(groupFlowRow(year.income, 1, 0, 'section', t('sheets.budget.income')));
  flowRows(year.income, 1, 1, flows);
  flows.push(groupFlowRow(year.expense, -1, 0, 'section', t('sheets.budget.expense')));
  flowRows(year.expense, -1, 1, flows);

  const result = year.result;
  const resultSums = [result.forecastTotal, result.planTotal, result.variance];
  flows.push({
    kind: 'result',
    label: t('sheets.budget.result'),
    account: null,
    depth: 0,
    marks: [],
    months: result.forecast.map((value) => cell(value, false)),
    total: cell(resultSums[0] ?? 0, false),
    plan: cell(resultSums[1] ?? 0, false),
    variance: cell(resultSums[2] ?? 0, false),
    negative: [...result.forecast, ...resultSums].map((value) => value < 0),
  });

  const balances: BudgetSheetBalanceRow[] = [];
  const hasBalances =
    year.assets.accounts.length + year.assets.children.length > 0 ||
    year.liabilities.accounts.length + year.liabilities.children.length > 0;
  if (hasBalances) {
    // Net worth on top, as the spreadsheet has it: the one line of this table
    // that carries on past the last closed month.
    balances.push({
      kind: 'net',
      label: t('sheets.budget.netWorth'),
      account: null,
      depth: 0,
      marks: [],
      opening: cell(year.net.opening, false),
      months: year.net.months.map((value) => cell(value, false)),
      negative: [year.net.opening, ...year.net.months].map((value) => value < 0),
    });
    balances.push(groupBalanceRow(year.assets, 1, 0, 'section', t('ledger.assets')));
    balanceRows(year.assets, 1, 1, balances);
    balances.push(groupBalanceRow(year.liabilities, -1, 0, 'section', t('ledger.liabilities')));
    balanceRows(year.liabilities, -1, 1, balances);
  }

  const flowNotes = [t('sheets.budget.totalHint')];
  if (year.strayLines.length > 0) {
    flowNotes.push(t('sheets.budget.strayLines', { numbers: year.strayLines.join(', ') }));
  }

  const foreign = accountsOn(year).some(
    (account) => account.currency !== null && account.currency !== context.currency
  );

  return {
    lang: context.lang,
    title: t('sheets.budget.title', { year: String(year.year) }),
    meta: [
      t('sheets.budget.currency', { currency: context.currency }),
      closedLine(year.closedThrough),
    ],
    monthLabels: MONTHS.map((month) => monthName(month)),
    closedThrough: year.closedThrough,
    labels: {
      flows: t('sheets.budget.flows'),
      balances: t('sheets.budget.balances'),
      opening: t('sheets.budget.opening'),
      total: t('sheets.budget.total'),
      plan: t('sheets.budget.plan'),
      variance: t('sheets.budget.variance'),
      actual: t('sheets.budget.actual'),
      planned: t('sheets.budget.planned'),
    },
    flows,
    balances,
    flowNotes,
    balanceNotes: year.closedThrough < 12 ? [t('sheets.budget.projectedHint')] : [],
    footer: {
      truth: t('sheets.truth'),
      currency: foreign ? t('sheets.currencyRule') : null,
      credit: creditText(context.settings, context.today),
    },
  };
}
