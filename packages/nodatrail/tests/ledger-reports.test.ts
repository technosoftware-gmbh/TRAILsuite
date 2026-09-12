/**
 * A worked month, carried from journal text all the way to the figures the
 * ledger view puts on screen.
 *
 * The unit tests each prove one step. This proves the steps join up, which is
 * the failure a suite of unit tests is most likely to miss: every part correct
 * and the whole reporting something nobody would recognise.
 */
import { describe, expect, it } from 'vitest';
import {
  balanceAt,
  balanceSheet,
  flattenReport,
  incomeStatement,
  parseAccount,
  parseJournal,
  statement,
  type Account,
  type AccountProperties,
} from '@technosoftware/trail-core';

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

function account(
  number: number,
  title: string,
  group: string,
  extra: Record<string, unknown> = {}
): Account {
  const parsed = parseAccount({ number, group, currency: 'CHF', ...extra }, title, P);
  if (!parsed) throw new Error('unreadable fixture');
  return parsed;
}

/** A household of the shape the chart ships, with an opening balance sheet. */
const ACCOUNTS = [
  account(1005, 'Household account', 'Household', { opening: 400 }),
  account(1011, 'Personal account', 'Person 1', { opening: -1370 }),
  account(1060, 'House', 'Property', { opening: 654000 }),
  account(2010, 'Credit card', 'Cards', { kind: 'liability' }),
  account(2022, 'Cantonal tax payable', 'Amounts owed', { kind: 'liability' }),
  account(2050, 'Mortgage', 'Mortgages', { kind: 'liability', opening: 530000 }),
  account(3010, 'Net income', 'Net earned income', { kind: 'income' }),
  account(4001, 'Electricity and gas', 'Shared costs/Household, insurance'),
  account(4004, 'Pets', 'Shared costs/Household, insurance'),
  account(4036, 'Other', 'Person 1 costs/Health, phone, clothing'),
  account(5001, 'Cantonal tax', 'Taxes/Federal, cantonal, communal'),
];

/**
 * One month, written the way the import and the hand would leave it.
 *
 * It exercises every posting shape the design has: a plain expense, a salary,
 * a split, a transfer between two of the household's own accounts, a card
 * purchase that raises a debt, a payment that lowers it, and a tax assessment
 * booked against a payable with one instalment paid.
 */
const JOURNAL = [
  '2026-01-05 | 4001 | 1005 | 128.45 | Strom Januar',
  '2026-01-08 | 5001 | 2022 | 6000.00 | Steuerveranlagung 2026',
  '2026-01-15 | 2022 | 1011 | 500.00 | Steuerrate Januar',
  '2026-01-20 | 4036 | 2010 | 240.00 | Einkauf mit Karte',
  '2026-01-25 | 1011 | 3010 | 7412.00 | Lohn Januar',
  '2026-01-27 | 2010 | 1011 | 240.00 | Kartenrechnung bezahlt',
  '2026-01-28 | 1005 | 1011 | 1000.00 | Uebertrag auf Haushaltskonto',
  '2026-01-30 | | 1005 | 250.00 | Migros',
  '    4001 | 30.00 | Grillkohle',
  '    4004 | 220.00 | Katzenfutter',
].join('\n');

const { postings, problems } = parseJournal(JOURNAL);

describe('the month reads cleanly', () => {
  it('has nothing unreadable in it', () => {
    expect(problems).toEqual([]);
  });

  it('expands the split into a posting per leg', () => {
    // Seven single lines, and the split header becomes two.
    expect(postings).toHaveLength(9);
  });
});

describe('the accounts each end where they should', () => {
  const balance = (number: number) => {
    const found = ACCOUNTS.find((a) => a.number === number);
    if (!found) throw new Error(`no account ${number}`);
    return balanceAt(postings, found);
  };

  it('runs the personal account down and up again', () => {
    // -1370 opening, -500 tax, +7412 salary, -240 card, -1000 transfer out
    expect(balance(1011)).toBe(4302);
  });

  it('leaves the household account with what arrived less what was spent', () => {
    // 400 opening, -128.45 power, +1000 transfer in, -250 Migros
    expect(balance(1005)).toBe(1021.55);
  });

  it('brings the card back to nothing once its bill is paid', () => {
    // The point of giving the card an account: the purchase is an expense in
    // January and the payment is not a second one.
    expect(balance(2010)).toBe(0);
  });

  it('leaves the tax payable showing what is still owed', () => {
    expect(balance(2022)).toBe(5500);
  });
});

describe('Gewinnermittlung for January', () => {
  const report = incomeStatement(ACCOUNTS, postings, '2026-01-01', '2026-01-31');

  it('counts the whole tax assessment, not the one instalment paid', () => {
    // The reason the payable exists. Booked as cash, January would show 500 of
    // tax and the other 5500 would land in whichever months the instalments
    // happened to fall.
    const tax = flattenReport(report.expense).find((entry) => entry.account.number === 5001);
    expect(tax?.amount).toBe(6000);
  });

  it('counts the card purchase in the month it was made', () => {
    const other = flattenReport(report.expense).find((entry) => entry.account.number === 4036);
    expect(other?.amount).toBe(240);
  });

  it('counts neither the transfer nor the card payment as an expense', () => {
    // Both move money between the household's own accounts, and an income
    // statement that counted them would be counting the same francs twice.
    expect(report.expenseTotal).toBe(6000 + 240 + 158.45 + 220);
  });

  it('gives a result that is income less expenses', () => {
    expect(report.incomeTotal).toBe(7412);
    expect(report.result).toBe(793.55);
  });
});

describe('Bestandeskonten at the end of January', () => {
  const sheet = balanceSheet(ACCOUNTS, postings, '2026-01-31');

  it('adds the house to the financial assets', () => {
    expect(sheet.assetTotal).toBe(654000 + 4302 + 1021.55);
  });

  it('carries the mortgage and what is still owed on the tax', () => {
    expect(sheet.liabilityTotal).toBe(530000 + 5500);
  });

  it('nets to a household that owns more than it owes', () => {
    expect(sheet.net).toBe(123823.55);
  });

  it('would report nonsense without the house, which is why it is there', () => {
    const withoutHouse = balanceSheet(
      ACCOUNTS.filter((a) => a.number !== 1060),
      postings,
      '2026-01-31'
    );
    expect(withoutHouse.net).toBeLessThan(0);
  });
});

describe('the statement held against a bank statement', () => {
  const personal = ACCOUNTS.find((a) => a.number === 1011);
  const rows = personal ? statement(postings, personal) : [];

  it('runs in date order and finishes at the balance', () => {
    expect(rows.map((entry) => entry.posting.date)).toEqual([
      '2026-01-15',
      '2026-01-25',
      '2026-01-27',
      '2026-01-28',
    ]);
    expect(rows.at(-1)?.balance).toBe(4302);
  });

  it('names the other account on every line, which is what makes it checkable', () => {
    expect(rows.map((entry) => entry.other)).toEqual([2022, 3010, 2010, 1005]);
  });
});
