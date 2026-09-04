/**
 * A balance sheet is a statement about a day, and the day has to be the one on
 * screen.
 *
 * The ledger view passed `null` for the as-of day, which means "every posting
 * ever". While only one month exists that happens to look right, so the bug is
 * invisible exactly when somebody is first checking the figures. The month they
 * add February it silently stops answering the question they are asking: an
 * income statement for January beside a balance sheet including March is two
 * answers to two different questions, and the pair cannot be reconciled against
 * anything.
 *
 * This pins the arithmetic the view now relies on.
 */
import { describe, expect, it } from 'vitest';
import {
  balanceSheet,
  parseAccount,
  type Account,
  type AccountProperties,
  type Posting,
} from 'trail-core';

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

const ACCOUNTS = [account(1011, { opening: 1000 }), account(4031)];

function posting(date: string, amount: number): Posting {
  return {
    date,
    debit: 4031,
    credit: 1011,
    amount,
    currency: 'CHF',
    text: 'Krankenkasse',
    reference: null,
    counterAmount: null,
    counterCurrency: null,
    line: 1,
    // The line the entry's header is on. A posting without one belongs to no
    // entry, which is a shape the journal parser cannot produce -- and
    // grouping by anything else is the bug `entryLine` was added for.
    entryLine: 1,
    splitOf: null,
    importKey: null,
  };
}

const POSTINGS = [posting('2026-01-15', 300), posting('2026-02-15', 200)];

describe('the balance sheet the ledger view shows', () => {
  it('is as of the last day of the period, not as of everything ever', () => {
    const january = balanceSheet(ACCOUNTS, POSTINGS, '2026-01-31');
    expect(january.assetTotal).toBe(700);
  });

  it('moves with the period', () => {
    expect(balanceSheet(ACCOUNTS, POSTINGS, '2026-02-28').assetTotal).toBe(500);
  });

  it('shows the opening alone before anything has been posted', () => {
    expect(balanceSheet(ACCOUNTS, POSTINGS, '2025-12-31').assetTotal).toBe(1000);
  });

  it('names the day it is about, so the figure can be checked', () => {
    expect(balanceSheet(ACCOUNTS, POSTINGS, '2026-01-31').on).toBe('2026-01-31');
  });

  it('is what the old behaviour gave only while one month existed', () => {
    // The trap: with January alone on the books, "everything ever" and "as of
    // the end of January" agree, and the bug cannot be seen.
    const januaryOnly = POSTINGS.slice(0, 1);
    expect(balanceSheet(ACCOUNTS, januaryOnly, null).assetTotal).toBe(
      balanceSheet(ACCOUNTS, januaryOnly, '2026-01-31').assetTotal
    );
    // With February on the books they disagree, which is the whole point.
    expect(balanceSheet(ACCOUNTS, POSTINGS, null).assetTotal).not.toBe(
      balanceSheet(ACCOUNTS, POSTINGS, '2026-01-31').assetTotal
    );
  });
});
