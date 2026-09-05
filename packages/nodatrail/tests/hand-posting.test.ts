/**
 * A posting entered by hand, and the order that makes a card account work.
 *
 * The sequence under test is the one a first import has to follow. The bank
 * statement holds only the payment to the card; what created the debt is on the
 * card's own invoice. Import the bank first and the card ends the month with a
 * negative debt, which is not a thing.
 */
import { describe, expect, it } from 'vitest';
import {
  balanceAt,
  parseAccount,
  parseJournal,
  type Account,
  type AccountProperties,
} from '@technosoftware/trail-core';
import { linesFor } from '../src/ledger/import-write';

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

function account(number: number, kind: Account['kind'], opening = 0): Account {
  const parsed = parseAccount({ number, kind, currency: 'CHF', opening }, `Konto ${number}`, P);
  if (!parsed) throw new Error('unreadable fixture');
  return parsed;
}

const CARD = account(2010, 'liability');
const BANK = account(1011, 'asset', 1000);

/** What the new-posting modal builds for a card invoice: one credit, many legs. */
const INVOICE = linesFor({
  posting: {
    date: '2026-01-31',
    debit: null,
    credit: 2010,
    amount: 240,
    currency: 'CHF',
    text: 'Kartenrechnung Januar',
    reference: null,
    counterAmount: null,
    counterCurrency: null,
    line: 0,
    // The line the entry's header is on. A posting without one belongs to no
    // entry, which the journal parser cannot produce -- and grouping by
    // anything else is the bug `entryLine` was added for.
    entryLine: 0,
    splitOf: null,
    importKey: null,
  },
  legs: [
    { account: 4036, amount: 180, text: 'Digitec' },
    { account: 4004, amount: 60, text: 'Katzenfutter' },
  ],
});

/** What the bank import writes when the card bill is paid. */
const PAYMENT = '2026-02-05 | 2010 | 1011 | 240.00 | CORNER BANCA SA CORNERCARD |  | ref:9';

describe('the card invoice, entered by hand', () => {
  const { postings, problems } = parseJournal(INVOICE.join('\n'));

  it('reads back as one posting per purchase, all owed to the card', () => {
    expect(problems).toEqual([]);
    expect(postings.map((p) => [p.debit, p.credit, p.amount])).toEqual([
      [4036, 2010, 180],
      [4004, 2010, 60],
    ]);
  });

  it('leaves the card owing what was bought', () => {
    expect(balanceAt(postings, CARD)).toBe(240);
  });

  it('writes no import key, since it came from no row', () => {
    expect(postings[0]?.importKey).toBeNull();
  });
});

describe('the order the two have to go in', () => {
  it('brings the card back to nothing when the invoice is booked first', () => {
    const both = parseJournal([...INVOICE, PAYMENT].join('\n')).postings;
    expect(balanceAt(both, CARD)).toBe(0);
    expect(balanceAt(both, BANK)).toBe(760);
  });

  it('leaves the card owing a negative amount when only the payment is booked', () => {
    // The failure this ordering exists to avoid. A liability of minus 240 says
    // the card owes the household money, which no card has ever done.
    const paymentOnly = parseJournal(PAYMENT).postings;
    expect(balanceAt(paymentOnly, CARD)).toBe(-240);
  });
});
