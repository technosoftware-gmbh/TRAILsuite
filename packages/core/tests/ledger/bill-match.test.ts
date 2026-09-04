/**
 * Matching a statement row to the invoice it pays.
 *
 * Every row text here is copied from the real Kontoauszug this was written
 * against, boilerplate and all, because the whole difficulty is in what banks
 * actually print rather than in what a matcher would like them to print.
 */
import { describe, expect, it } from 'vitest';
import {
  matchBillForRow,
  matchPaidBill,
  mentionsCompany,
  postingsCovering,
  type BillForMatching,
} from '../../src/ledger/bill-match.js';
import type { Posting } from '../../src/ledger/types.js';
import type { BankStatementRow } from '../../src/ledger/statement.js';

function row(overrides: Partial<BankStatementRow> = {}): BankStatementRow {
  return {
    line: 2,
    date: '2026-08-14',
    valueDate: '2026-08-14',
    text: 'AQUILANA VERSICHERUNGEN',
    rawText: ' Belastung e-banking / Ref.-Nr. 1563958107 AQUILANA VERSICHERUNGEN ',
    amount: -30.35,
    currency: 'CHF',
    balance: -1735.11,
    reference: '1563958107',
    batchCount: null,
    transfer: null,
    status: null,
    accepted: true,
    ...overrides,
  };
}

function bill(overrides: Partial<BillForMatching> = {}): BillForMatching {
  return {
    title: '20260801_Aquilana_1040269824',
    companyTitle: 'Aquilana',
    amount: 30.35,
    currency: 'CHF',
    account: 4031,
    lines: [],
    issueDate: '2026-08-01',
    dueDate: '2026-08-31',
    paidDate: null,
    paidFrom: null,
    ...overrides,
  };
}

describe('mentionsCompany', () => {
  it('finds a note called what a person calls it inside the bank shouting', () => {
    expect(
      mentionsCompany('Belastung e-banking / Ref.-Nr. 1561138148 SWISSCOM (SCHWEIZ) AG', 'Swisscom')
    ).toBe(true);
  });

  it('ignores the legal form, which every second vendor shares', () => {
    // Matching on "AG" would pair a phone bill with a bank.
    expect(mentionsCompany('CORNER BANCA SA CORNERCARD', 'Riverty GmbH')).toBe(false);
    expect(mentionsCompany('SWISSCOM (SCHWEIZ) AG', 'Migros AG')).toBe(false);
  });

  it('ignores the country, for the same reason', () => {
    expect(mentionsCompany('SWISSCOM (SCHWEIZ) AG', 'Schweiz Tourismus')).toBe(false);
  });

  it('matches on any word of the name, not only the first', () => {
    // The note may be called Galaxus where the bank prints the whole firm.
    expect(mentionsCompany('DIGITEC GALAXUS AG', 'Galaxus')).toBe(true);
  });

  it('says no when the company has no name worth matching on', () => {
    expect(mentionsCompany('DIGITEC GALAXUS AG', 'AG')).toBe(false);
    expect(mentionsCompany('DIGITEC GALAXUS AG', '')).toBe(false);
  });
});

describe('matchBillForRow', () => {
  it('matches on the amount and the vendor', () => {
    const match = matchBillForRow(row(), [bill()]);
    expect(match?.bill.title).toBe('20260801_Aquilana_1040269824');
    expect(match?.alsoFits).toEqual([]);
  });

  it('tells two bills from one vendor on one day apart by the amount', () => {
    // Both of these are real: 27.07.2026 carried AQUILANA 750.95 and AQUILANA 2.10.
    const july = { issueDate: '2026-07-01', dueDate: '2026-07-31' };
    const big = bill({ title: 'big', amount: 750.95, ...july });
    const small = bill({ title: 'small', amount: 2.1, ...july });
    const paid = row({ date: '2026-07-27', amount: -2.1 });
    expect(matchBillForRow(paid, [big, small])?.bill.title).toBe('small');
  });

  it('does not match a bill that is already paid', () => {
    expect(matchBillForRow(row(), [bill({ paidDate: '2026-08-10' })])).toBeNull();
  });

  it('does not match a different vendor for the same amount', () => {
    expect(matchBillForRow(row(), [bill({ companyTitle: 'Swisscom' })])).toBeNull();
  });

  it('does not match money arriving, which never settles an invoice', () => {
    expect(matchBillForRow(row({ amount: 30.35 }), [bill()])).toBeNull();
  });

  it('does not match a payment dated before the invoice was written', () => {
    // Last month's payment to the same insurer for the same figure is last
    // month's bill, not this one.
    expect(
      matchBillForRow(row({ date: '2026-07-02' }), [bill({ issueDate: '2026-08-01' })])
    ).toBeNull();
  });

  it('forgives a few days, because a bank books when the money moves', () => {
    expect(
      matchBillForRow(row({ date: '2026-07-30' }), [bill({ issueDate: '2026-08-01' })])
    ).not.toBeNull();
  });

  it('reports the ones it could equally have been rather than choosing quietly', () => {
    // A monthly subscription: same vendor, same figure, two months open.
    const july = bill({ title: 'july', issueDate: '2026-07-01', dueDate: '2026-07-31' });
    const august = bill({ title: 'august' });
    const match = matchBillForRow(row(), [august, july]);

    expect(match?.bill.title).toBe('july');
    expect(match?.alsoFits.map((other) => other.title)).toEqual(['august']);
  });

  it('still matches a bill nobody has classified, so the account can be asked for once', () => {
    const match = matchBillForRow(row(), [bill({ account: null })]);
    expect(match?.bill.account).toBeNull();
  });

  it('does not match across currencies', () => {
    expect(matchBillForRow(row(), [bill({ currency: 'EUR' })])).toBeNull();
  });
});

describe('matchPaidBill', () => {
  const settled = bill({ paidDate: '2026-08-14', paidFrom: 1011 });

  it('recognises a payment the mark-paid dialog already posted from this account', () => {
    // Otherwise importing the statement afterwards books it a second time and
    // nothing in the file could ever know.
    expect(matchPaidBill(row(), [settled], 1011)?.title).toBe(settled.title);
  });

  it('says nothing about a bill paid from some other account', () => {
    expect(matchPaidBill(row(), [settled], 1021)).toBeNull();
  });

  it('says nothing about a bill nothing has settled', () => {
    expect(matchPaidBill(row(), [bill()], 1011)).toBeNull();
  });

  it('does not let a payment made by hand in one month excuse the next one', () => {
    // Same subscription, same figure, a month apart: two payments, not one.
    expect(matchPaidBill(row({ date: '2026-09-14' }), [settled], 1011)).toBeNull();
  });
});

describe('postingsCovering', () => {
  const posting = (over: Partial<Posting> = {}): Posting => ({
    date: '2026-01-23',
    debit: 4023,
    credit: 1011,
    amount: 870.85,
    currency: 'CHF',
    text: 'RCI FINANCE SA',
    reference: null,
    counterAmount: null,
    counterCurrency: null,
    line: 1,
    entryLine: 1,
    splitOf: null,
    importKey: null,
    ...over,
  });

  const leg = { account: 4023, amount: 870.85 };
  const ISSUED = '2026-01-01';

  it('finds a batched payment made a week before the paid date', () => {
    // The failure this was rewritten for. The batch posted on the 23rd, the
    // paid date defaulted to the due date on the 31st, and a window of five
    // days around the paid date missed a payment it was looking straight at.
    expect(postingsCovering([posting()], [leg], 1011, ISSUED, '2026-01-31')).toHaveLength(1);
  });

  it('finds nothing when the ledger holds no such payment', () => {
    expect(postingsCovering([], [leg], 1011, ISSUED, '2026-01-31')).toEqual([]);
  });

  it('does not match a payment from a different account', () => {
    expect(
      postingsCovering([posting({ credit: 1005 })], [leg], 1011, ISSUED, '2026-01-31')
    ).toEqual([]);
  });

  it('does not match a different figure', () => {
    expect(
      postingsCovering([posting({ amount: 870.95 })], [leg], 1011, ISSUED, '2026-01-31')
    ).toEqual([]);
  });

  it('does not let last month settle this month, however alike they are', () => {
    // A monthly leasing bill is the same figure to the same accounts twelve
    // times a year. February's invoice cannot be settled by January's payment,
    // because that payment falls before February's invoice existed.
    const january = posting({ date: '2026-01-23' });
    expect(postingsCovering([january], [leg], 1011, '2026-02-01', '2026-02-28')).toEqual([]);
  });

  it('does not match a payment made before the invoice was issued', () => {
    expect(
      postingsCovering([posting({ date: '2025-12-20' })], [leg], 1011, ISSUED, '2026-01-31')
    ).toEqual([]);
  });

  it('forgives a few days either side, because a bank books when it books', () => {
    const early = posting({ date: '2025-12-29' });
    expect(postingsCovering([early], [leg], 1011, ISSUED, '2026-01-31')).toHaveLength(1);
  });

  it('falls back to the paid date when the invoice names no issue date', () => {
    expect(postingsCovering([posting()], [leg], 1011, null, '2026-01-25')).toHaveLength(1);
    expect(postingsCovering([posting()], [leg], 1011, null, '2026-02-25')).toEqual([]);
  });

  it('requires every leg of a split to be covered', () => {
    const legs = [leg, { account: 4013, amount: 510.95 }];
    expect(postingsCovering([posting()], legs, 1011, ISSUED, '2026-01-31')).toEqual([]);

    const both = [posting(), posting({ debit: 4013, amount: 510.95 })];
    expect(postingsCovering(both, legs, 1011, ISSUED, '2026-01-31')).toHaveLength(2);
  });

  it('does not let one posting cover two identical legs', () => {
    const twice = [
      { account: 4036, amount: 50 },
      { account: 4036, amount: 50 },
    ];
    const one = [posting({ debit: 4036, amount: 50 })];
    expect(postingsCovering(one, twice, 1011, ISSUED, '2026-01-31')).toEqual([]);
  });
});
