/**
 * The import writing an order's number into the posting it makes.
 *
 * Matching is only half of it. The number has to land in the posting's own
 * text, because that is what every later reader sees: the journal, the month on
 * screen, and the check that asks whether one order has been paid for twice.
 * Kept in a field of the plan it would live exactly as long as the dialog.
 */
import { describe, expect, it } from 'vitest';
import { planImport } from '../../src/ledger/import-plan.js';
import type { OrderForMatching } from '../../src/ledger/order-match.js';
import type { BankStatementRow } from '../../src/ledger/statement.js';
import type { Account, Posting } from '../../src/ledger/types.js';

const ACCOUNTS: Account[] = [
  {
    number: 1013,
    title: 'Revolut',
    kind: 'asset',
    group: '',
    currency: 'CHF',
    opening: 0,
    openingDate: null,
    iban: null,
    bankAccount: null,
    closed: null,
    personTitle: null,
  },
  {
    number: 4000,
    title: 'Essen',
    kind: 'expense',
    group: '',
    currency: 'CHF',
    opening: 0,
    openingDate: null,
    iban: null,
    bankAccount: null,
    closed: null,
    personTitle: null,
  },
];

const RULES = [{ match: 'Tom Tasty', account: 4000, source: null }];

const ORDERS: OrderForMatching[] = [
  {
    title: '2026-04-03-26303',
    orderNumber: '26303',
    companyTitle: 'TomTasty AG',
    orderDate: '2026-04-03',
    price: 97.85,
    priceCurrency: 'CHF',
  },
  {
    title: '2026-04-10-26728',
    orderNumber: '26728',
    companyTitle: 'TomTasty AG',
    orderDate: '2026-04-10',
    price: 97.85,
    priceCurrency: 'CHF',
  },
];

function row(overrides: Partial<BankStatementRow> = {}): BankStatementRow {
  return {
    line: 2,
    date: '2026-04-04',
    valueDate: '2026-04-03',
    text: 'Tom Tasty',
    rawText: 'Kartenbezahlung Tom Tasty',
    amount: -97.85,
    currency: 'CHF',
    balance: 701.98,
    reference: '',
    batchCount: null,
    transfer: null,
    status: 'ABGESCHLOSSEN',
    accepted: true,
    ...overrides,
  };
}

const base = { intoAccount: 1013, accounts: ACCOUNTS, rules: RULES, orders: ORDERS };

describe('importing a card charge for an order the vault holds', () => {
  it('writes the order number into the posting', () => {
    const plan = planImport([row()], { ...base, existing: [] });
    expect(plan.proposals[0]?.status).toBe('ready');
    expect(plan.proposals[0]?.posting?.text).toBe('Tom Tasty #26303');
  });

  it('carries the match so a preview can show it before writing', () => {
    const plan = planImport([row()], { ...base, existing: [] });
    expect(plan.proposals[0]?.order?.order.title).toBe('2026-04-03-26303');
  });

  it('changes nothing when the vault holds no orders', () => {
    const plan = planImport([row()], { ...base, orders: [], existing: [] });
    expect(plan.proposals[0]?.posting?.text).toBe('Tom Tasty');
  });

  it('gives two charges two different orders, not the same one twice', () => {
    // Two identical weekly orders, two identical charges. The second charge
    // must not take the order the first one just took.
    const second = row({ line: 3, date: '2026-04-11', valueDate: '2026-04-10' });
    const plan = planImport([row(), second], { ...base, existing: [] });
    expect(plan.proposals.map((p) => p.posting?.text)).toEqual([
      'Tom Tasty #26303',
      'Tom Tasty #26728',
    ]);
  });

  it('will not re-use an order the ledger already paid for', () => {
    const already: Posting[] = [
      {
        date: '2026-04-04',
        debit: 4000,
        credit: 1013,
        amount: 97.85,
        currency: 'CHF',
        text: 'TomTasty #26303',
        reference: null,
        counterAmount: null,
        counterCurrency: null,
        line: 9,
        entryLine: 9,
        splitOf: null,
        importKey: 'entered-by-hand',
      },
    ];
    const plan = planImport([row()], { ...base, existing: already });
    // The charge is still imported -- it is real money -- but it does not get
    // to claim an order that is already accounted for.
    expect(plan.proposals[0]?.status).toBe('ready');
    expect(plan.proposals[0]?.order).toBeNull();
    expect(plan.proposals[0]?.posting?.text).toBe('Tom Tasty');
  });

  it('leaves the text alone when the statement already prints the number', () => {
    // `rawText` is set alongside `text`, which is what a real card export
    // looks like. It used to say `Kartenbezahlung Tom Tasty` while `text` said
    // `TomTasty`, and the rule matched the vendor's name only in the raw half
    // -- so this test passed on a coincidence that had nothing to do with what
    // it is about, and stopped passing the moment rule matching read the
    // counterparty alone.
    const printed = row({
      text: 'Tom Tasty Bestellung #26303',
      rawText: 'Tom Tasty Bestellung #26303',
    });
    const plan = planImport([printed], { ...base, existing: [] });
    expect(plan.proposals[0]?.posting?.text).toBe('Tom Tasty Bestellung #26303');
  });
});
