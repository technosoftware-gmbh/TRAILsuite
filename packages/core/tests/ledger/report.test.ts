/**
 * Reporting a period two ways from one set of postings.
 *
 * An income statement says what a month cost; `cashOut` says what left the
 * household's accounts. Both are true at once, and a household carrying a tax
 * assessment over twelve instalments needs both: one to know what the year owes
 * it, the other to know what the bank balance did.
 */
import { describe, expect, it } from 'vitest';
import { cashOut, incomeStatement } from '../../src/ledger/report.js';
import { parseAccount, type AccountProperties } from '../../src/ledger/account.js';
import type { Account, Posting } from '../../src/ledger/types.js';

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

function account(number: number, extra: Record<string, unknown> = {}): Account {
  const parsed = parseAccount({ number, currency: 'CHF', ...extra }, `Konto ${number}`, P);
  if (!parsed) throw new Error('unreadable fixture');
  return parsed;
}

describe('the same month counted as cash out', () => {
  const chart = [
    account(1011, { kind: 'asset' }),
    account(1005, { kind: 'asset' }),
    account(2010, { kind: 'liability' }),
    account(2022, { kind: 'liability' }),
    account(4036, { kind: 'expense' }),
    account(5001, { kind: 'expense' }),
  ];

  const post = (date: string, debit: number, credit: number, amount: number): Posting => ({
    date,
    debit,
    credit,
    amount,
    currency: 'CHF',
    text: '',
    reference: null,
    counterAmount: null,
    counterCurrency: null,
    line: 1,
    entryLine: 1,
    splitOf: null,
    importKey: null,
  });

  // The real January: a tax assessment carried on 2022 and paid by instalment,
  // a card purchase carried on 2010 and part-settled, and one invoice paid
  // outright.
  const POSTINGS = [
    post('2026-01-01', 5001, 2022, 28413.6),
    post('2026-01-01', 4036, 2010, 2323.55),
    post('2026-01-23', 2022, 1011, 2500),
    post('2026-01-23', 2010, 1011, 1500),
    post('2026-01-26', 4036, 1011, 643.3),
    post('2026-01-26', 1005, 1011, 400),
  ];

  it('counts an expense when its payment left an account', () => {
    const cash = cashOut(chart, POSTINGS, '2026-01-01', '2026-01-31');
    expect(cash.expenseTotal).toBe(643.3);
  });

  it('counts money paid against a debt, which touches no expense account', () => {
    const cash = cashOut(chart, POSTINGS, '2026-01-01', '2026-01-31');
    expect(cash.settledTotal).toBe(4000);
    expect(cash.total).toBe(4643.3);
  });

  it('leaves out what was incurred and not paid', () => {
    // The whole point. Accrual says the month cost 31'380.45; cash says 4'643.30
    // went out, and both are true.
    const accrual = incomeStatement(chart, POSTINGS, '2026-01-01', '2026-01-31');
    expect(accrual.expenseTotal).toBe(31380.45);
    expect(cashOut(chart, POSTINGS, '2026-01-01', '2026-01-31').total).toBe(4643.3);
  });

  it('does not count a transfer between two accounts the household holds', () => {
    // 400.00 moved from 1011 to 1005. Nothing was spent.
    const cash = cashOut(chart, POSTINGS, '2026-01-01', '2026-01-31');
    expect(cash.total).toBe(4643.3);
  });

  it('stays inside the period', () => {
    const later = [...POSTINGS, post('2026-02-03', 4036, 1011, 999)];
    expect(cashOut(chart, later, '2026-01-01', '2026-01-31').total).toBe(4643.3);
    expect(cashOut(chart, later, '2026-02-01', '2026-02-28').total).toBe(999);
  });
});
