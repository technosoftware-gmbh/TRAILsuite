/**
 * A row that names the collector rather than the shop.
 *
 * Zooplus handed its collection to Klarna. From that day its statement rows say
 * `KLARNA BANK AB (PUBL)` and its invoices still say `ZOOPLUS`, and every one of
 * them stopped matching -- silently, because an unmatched row looks exactly like
 * a row nobody has classified yet. There is nothing shared to fall back on: the
 * bank's `Ref.-Nr.` is the bank's own, the message number on the row is Klarna's
 * own, and the invoice carries neither.
 *
 * So a row naming a company somebody has flagged as a payment provider is
 * matched on the amount, the currency and the date, and the vendor's name is not
 * required. The row texts and the figures below are the real ones.
 */
import { describe, expect, it } from 'vitest';
import {
  matchBillForRow,
  matchPaidBill,
  type BillForMatching,
} from '../../src/ledger/bill-match.js';
import type { BankStatementRow } from '../../src/ledger/statement.js';

const KLARNA = ['KLARNA'];

function klarnaRow(overrides: Partial<BankStatementRow> = {}): BankStatementRow {
  return {
    line: 41,
    date: '2026-05-26',
    valueDate: '2026-05-26',
    text: 'KLARNA BANK AB (PUBL) SVEAVAEGEN 46',
    rawText:
      ' Belastung Lastschrift / KLARNA BANK AB (PUBL) SVEAVAEGEN 46 11134 STOCKHOLM Mitteilungen: 2687218068009269 ',
    amount: -293.26,
    currency: 'CHF',
    balance: 1469.56,
    reference: '',
    batchCount: null,
    transfer: null,
    status: null,
    accepted: true,
    ...overrides,
  };
}

function zooplus(overrides: Partial<BillForMatching> = {}): BillForMatching {
  return {
    title: '20260511_ZOOPLUS_446799383',
    companyTitle: 'ZOOPLUS',
    amount: 293.26,
    currency: 'CHF',
    account: 4004,
    lines: [],
    issueDate: '2026-05-11',
    dueDate: '2026-05-31',
    paidDate: null,
    paidFrom: null,
    ...overrides,
  };
}

describe('a row collected by a payment provider', () => {
  it('does not match without the flag, which is the bug this fixes', () => {
    expect(matchBillForRow(klarnaRow(), [zooplus()])).toBeNull();
  });

  it('matches the invoice it pays once the collector is known to be one', () => {
    const match = matchBillForRow(klarnaRow(), [zooplus()], { paymentProviders: KLARNA });
    expect(match?.bill.title).toBe('20260511_ZOOPLUS_446799383');
    expect(match?.bill.account).toBe(4004);
    expect(match?.alsoFits).toEqual([]);
  });

  it('still needs the amount to agree to the cent', () => {
    const match = matchBillForRow(klarnaRow({ amount: -293.25 }), [zooplus()], {
      paymentProviders: KLARNA,
    });
    expect(match).toBeNull();
  });

  it('still refuses to settle an invoice that had not been written', () => {
    const match = matchBillForRow(klarnaRow({ date: '2026-04-02' }), [zooplus()], {
      paymentProviders: KLARNA,
    });
    expect(match).toBeNull();
  });

  it('still refuses an invoice in another currency', () => {
    const match = matchBillForRow(klarnaRow(), [zooplus({ currency: 'EUR' })], {
      paymentProviders: KLARNA,
    });
    expect(match).toBeNull();
  });

  it('reports the ambiguity rather than picking, when two invoices fit', () => {
    // Two shops behind one collector, same figure, same month. Nothing in the
    // row can tell them apart, and the honest answer is to say so.
    const other = zooplus({
      title: '20260514_DIGITEC_9987001',
      companyTitle: 'Digitec',
      account: 4036,
      issueDate: '2026-05-14',
      dueDate: '2026-06-13',
    });
    const match = matchBillForRow(klarnaRow(), [zooplus(), other], {
      paymentProviders: KLARNA,
    });
    expect(match?.alsoFits).toHaveLength(1);
    expect([match?.bill.title, match?.alsoFits[0]?.title].sort()).toEqual([
      '20260511_ZOOPLUS_446799383',
      '20260514_DIGITEC_9987001',
    ]);
  });

  it('leaves an ordinary row alone: naming the vendor is still required', () => {
    // The flag relaxes the name check on rows that name a provider, and on no
    // others. A Swisscom row must still be a Swisscom row.
    const swisscom = klarnaRow({
      text: 'SWISSCOM (SCHWEIZ) AG',
      rawText: ' Belastung e-banking / Ref.-Nr. 1561138148 SWISSCOM (SCHWEIZ) AG ',
    });
    expect(matchBillForRow(swisscom, [zooplus()], { paymentProviders: KLARNA })).toBeNull();
  });

  it('does not turn every row into a match when nothing is flagged', () => {
    expect(matchBillForRow(klarnaRow(), [zooplus()], { paymentProviders: [] })).toBeNull();
  });
});

describe('a provider row for a bill already settled by hand', () => {
  const settled = zooplus({ paidDate: '2026-05-26', paidFrom: 1011 });

  it('was posted twice before, because the names never agreed', () => {
    expect(matchPaidBill(klarnaRow(), [settled], 1011)).toBeNull();
  });

  it('is recognised as the payment already in the ledger', () => {
    expect(matchPaidBill(klarnaRow(), [settled], 1011, undefined, KLARNA)?.title).toBe(
      '20260511_ZOOPLUS_446799383'
    );
  });

  it('is not recognised from an account the bill was not paid from', () => {
    expect(matchPaidBill(klarnaRow(), [settled], 2010, undefined, KLARNA)).toBeNull();
  });
});
