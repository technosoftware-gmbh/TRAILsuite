/**
 * What each ledger tab reads, asked the way the tab and its printed sheet
 * both ask.
 *
 * The readings exist so that the screen and the paper cannot disagree, which
 * makes the options inside them the thing worth pinning: an untouched account
 * is left out of every report (this replaced a source-reading test that
 * counted `hideEmpty: true` in the view, which the move to readings would have
 * silently satisfied or silently broken), a balance sheet is about the last
 * day of the period, and a statement is bounded by the period.
 */
import { describe, expect, it } from 'vitest';
import { flattenReport, parseAccount, type AccountProperties } from '@technosoftware/trail-core';
import {
  balanceReading,
  chartReading,
  incomeReading,
  statementAccount,
  statementReading,
} from '../src/ledger/readings';
import { CHART, postings } from './budget-sheet-fixture';

const P: AccountProperties = {
  numberProperty: 'number',
  kindProperty: 'kind',
  groupProperty: 'group',
  currencyProperty: 'currency',
  openingProperty: 'opening',
  openingDateProperty: 'openingDate',
  closedProperty: 'closed',
  ibanProperty: 'iban',
  bankAccountProperty: 'bankAccount',
  personProperty: 'person',
};

const untouched = (number: number, kind: string) => {
  const account = parseAccount({ number, kind, currency: 'CHF' }, `${number} Nie benutzt`, P);
  if (!account) throw new Error('unreadable fixture');
  return account;
};

const ledger = {
  accounts: [...CHART, untouched(1099, 'asset'), untouched(6999, 'expense')],
  postings: postings(),
};
const SAME = (amount: number) => amount;
const Q2 = { from: '2026-04-01', to: '2026-06-30' };

const numbers = (group: Parameters<typeof flattenReport>[0]) =>
  flattenReport(group).map((entry) => entry.account.number);

describe('an account nothing ever touched', () => {
  it('is on no report', () => {
    const chart = chartReading(ledger, Q2, SAME);
    const held = balanceReading(ledger, Q2, SAME);
    const accrual = incomeReading(ledger, Q2, 'accrual', SAME);
    const cash = incomeReading(ledger, Q2, 'cash', SAME);

    expect(numbers(chart.held.assets)).not.toContain(1099);
    expect(numbers(chart.flows.expense)).not.toContain(6999);
    expect(numbers(held.assets)).not.toContain(1099);
    if (accrual.basis !== 'accrual' || cash.basis !== 'cash') throw new Error('wrong basis');
    expect(numbers(accrual.report.expense)).not.toContain(6999);
    expect(numbers(cash.report.expense)).not.toContain(6999);
  });
});

describe('the balance sheet', () => {
  it('is about the last day of the period', () => {
    expect(balanceReading(ledger, Q2, SAME).on).toBe('2026-06-30');
  });

  it('is what the chart shows as held', () => {
    expect(chartReading(ledger, Q2, SAME).held).toEqual(balanceReading(ledger, Q2, SAME));
  });
});

describe('a statement', () => {
  const reserve = statementAccount(ledger.accounts, 1030);

  it('is about the account asked for, or else the first asset', () => {
    expect(reserve?.number).toBe(1030);
    expect(statementAccount(ledger.accounts, 424242)?.kind).toBe('asset');
    expect(statementAccount([], null)).toBeNull();
  });

  it('holds only the period, opening on the day before it and closing on its last', () => {
    if (!reserve) throw new Error('no reserve');
    const reading = statementReading(ledger, reserve, Q2);
    expect(
      reading.rows.every((row) => row.posting.date >= Q2.from && row.posting.date <= Q2.to)
    ).toBe(true);
    // April, May and June each put 850 in; June took out one mortgage interest
    // payment and added the interest earned.
    expect(reading.rows).toHaveLength(5);
    const moved = reading.rows.reduce((sum, row) => sum + row.change, 0);
    expect(Math.round((reading.opening + moved) * 100) / 100).toBe(reading.closing);
    expect(reading.rows[reading.rows.length - 1]?.balance).toBe(reading.closing);
  });
});
