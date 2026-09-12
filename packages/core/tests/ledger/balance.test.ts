/**
 * Balances and the two reports.
 *
 * The signs are the part worth testing hardest. Getting one of the four kinds
 * backwards produces a ledger that balances perfectly and describes a household
 * that does not exist.
 */
import { describe, expect, it } from 'vitest';
import { parseAccount, type AccountProperties } from '../../src/ledger/account.js';
import {
  balanceAt,
  effectOn,
  movementBetween,
  statement,
  unknownAccounts,
} from '../../src/ledger/balance.js';
import { parseJournal } from '../../src/ledger/journal.js';
import { balanceSheet, flattenReport, incomeStatement } from '../../src/ledger/report.js';
import type { Account } from '../../src/ledger/types.js';

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

const BANK = account(1005, 'Haushaltskonto CHF', 'Haushalt', { opening: 12000 });
const CASH_EUR = account(1001, 'Haushaltskasse EUR', 'Haushalt', { currency: 'EUR' });
const MORTGAGE = account(2050, 'Geldmarkthypothek', 'Hypotheken', { opening: 380000 });
const SALARY = account(3010, 'Einkommen Netto Stefan', 'Erwerbseinkommen Netto');
const POWER = account(4001, 'IBB (Strom/Gas)', 'Gemeinsame Kosten/Haushalt, Versicherungen');
const CATS = account(4004, 'Katzen', 'Gemeinsame Kosten/Haushalt, Versicherungen');
const INTEREST = account(4006, 'Zins Haus', 'Gemeinsame Kosten/Hypothek');

const ACCOUNTS = [BANK, CASH_EUR, MORTGAGE, SALARY, POWER, CATS, INTEREST];

const AUGUST = parseJournal(
  [
    '2026-08-25 | 1005 | 3010 | 7412.00 | Lohn August',
    '2026-08-04 | 4001 | 1005 | 128.45 | IBB Strom August',
    '2026-08-06 | 4006 | 1005 | 640.00 | Hypothekarzins Q3',
    '2026-08-11 | | 1005 | 250.00 | Migros August',
    '    4001 | 30.00 | Grillkohle',
    '    4004 | 220.00 | Katzenfutter',
    '2026-07-11 | 1001 | 1005 | EUR 200.00 = CHF 189.60 | Bargeld Ferien',
  ].join('\n')
).postings;

describe('the four signs', () => {
  const spend = parseJournal('2026-08-04 | 4001 | 1005 | 100.00 | x').postings[0];

  it('grows an expense when it is debited', () => {
    expect(spend && effectOn(spend, POWER)).toBe(100);
  });

  it('shrinks an asset when it is credited', () => {
    expect(spend && effectOn(spend, BANK)).toBe(-100);
  });

  it('grows income when it is credited', () => {
    const wage = parseJournal('2026-08-25 | 1005 | 3010 | 7412.00 | x').postings[0];
    expect(wage && effectOn(wage, SALARY)).toBe(7412);
    expect(wage && effectOn(wage, BANK)).toBe(7412);
  });

  it('shrinks a liability when it is debited', () => {
    const repay = parseJournal('2026-08-30 | 2050 | 1005 | 5000.00 | Amortisation').postings[0];
    expect(repay && effectOn(repay, MORTGAGE)).toBe(-5000);
  });

  it('does nothing to an account the posting does not name', () => {
    expect(spend && effectOn(spend, CATS)).toBe(0);
  });
});

describe('balances', () => {
  it('sums the postings on top of the opening balance', () => {
    // 12000 + 7412 - 128.45 - 640 - 250 - 189.60
    expect(balanceAt(AUGUST, BANK)).toBe(18203.95);
  });

  it('takes each side of a conversion in its own currency', () => {
    // The bank gave up 189.60 francs and the cash box gained 200 euro.
    expect(balanceAt(AUGUST, CASH_EUR)).toBe(200);
  });

  it('stops on the day asked for, inclusive', () => {
    expect(balanceAt(AUGUST, BANK, '2026-08-04')).toBe(11681.95);
    expect(balanceAt(AUGUST, BANK, '2026-07-31')).toBe(11810.4);
  });

  it('counts a posting back-dated before the opening date, because somebody meant it', () => {
    const dated = account(1006, 'REKA', 'Haushalt', { opening: 100, openingDate: '2026-08-01' });
    const early = parseJournal('2026-01-04 | 1006 | 1005 | 50.00 | x').postings;
    expect(balanceAt(early, dated)).toBe(150);
  });

  it('counts a split leg by leg', () => {
    expect(balanceAt(AUGUST, POWER)).toBe(158.45);
    expect(balanceAt(AUGUST, CATS)).toBe(220);
  });
});

describe('the statement held against a bank statement', () => {
  const rows = statement(AUGUST, BANK);

  it('runs in date order with a balance after every line', () => {
    expect(rows.map((row) => row.posting.date)).toEqual([
      '2026-07-11',
      '2026-08-04',
      '2026-08-06',
      '2026-08-11',
      '2026-08-11',
      '2026-08-25',
    ]);
    expect(rows.at(-1)?.balance).toBe(18203.95);
  });

  it('names the other account, which is where the money went', () => {
    expect(rows[1]?.other).toBe(4001);
  });

  it('keeps the running balance right when a window hides the earlier lines', () => {
    const august = statement(AUGUST, BANK, '2026-08-01');
    // The opening row is out of the window, but its effect is still in the
    // balance: a statement that restarted at zero would not reconcile.
    expect(august[0]?.balance).toBe(11681.95);
  });
});

describe('movement over a period', () => {
  it('ignores the opening balance and anything outside the days', () => {
    expect(movementBetween(AUGUST, BANK, '2026-08-01', '2026-08-31')).toBe(
      7412 - 128.45 - 640 - 250
    );
  });
});

describe('Gewinnermittlung', () => {
  const report = incomeStatement(ACCOUNTS, AUGUST, '2026-08-01', '2026-08-31');

  it('gives income less expenses', () => {
    expect(report.incomeTotal).toBe(7412);
    expect(report.expenseTotal).toBe(158.45 + 220 + 640);
    expect(report.result).toBe(6393.55);
  });

  it('totals every group beneath it', () => {
    const shared = report.expense.children[0];
    expect(shared?.name).toBe('Gemeinsame Kosten');
    expect(shared?.total).toBe(1018.45);
    expect(shared?.children.map((child) => [child.name, child.total])).toEqual([
      ['Haushalt, Versicherungen', 378.45],
      ['Hypothek', 640],
    ]);
  });

  it('shows an account that stayed at nothing, unless asked not to', () => {
    expect(flattenReport(report.expense).map((entry) => entry.account.number)).toContain(4004);
    const tidy = incomeStatement(ACCOUNTS, AUGUST, '2026-08-01', '2026-08-04', { hideEmpty: true });
    expect(flattenReport(tidy.expense).map((entry) => entry.account.number)).toEqual([4001]);
  });
});

describe('Bestandeskonten', () => {
  const sheet = balanceSheet(ACCOUNTS, AUGUST);

  it('adds everything at face value when no converter is given', () => {
    // Which is right for a vault whose accounts are all in one currency, and
    // is why the default is identity rather than refusal.
    expect(sheet.assetTotal).toBe(18403.95);
    expect(sheet.liabilityTotal).toBe(380000);
    expect(sheet.assets.missing).toBe(0);
  });

  it('leaves a foreign account out of the total when nothing converts it', () => {
    // Adding 200 euro to a franc total as 200 was the old behaviour and it was
    // wrong. A converter that says it has no rate leaves the account out and
    // counts it as missing, so a view can name the figure that is incomplete.
    const noRate = balanceSheet(ACCOUNTS, AUGUST, null, {
      convert: (amount, currency) => (currency === 'EUR' ? null : amount),
    });
    expect(noRate.assetTotal).toBe(18203.95);
    expect(noRate.assets.missing).toBe(1);
  });

  it('adds it once a converter is given', () => {
    const converted = balanceSheet(ACCOUNTS, AUGUST, null, {
      convert: (amount, currency) => (currency === 'EUR' ? amount * 0.94 : amount),
    });
    expect(converted.assetTotal).toBe(18203.95 + 188);
    expect(converted.assets.missing).toBe(0);
  });

  it('keeps what the account itself holds beside what the total used', () => {
    const converted = balanceSheet(ACCOUNTS, AUGUST, null, {
      convert: (amount, currency) => (currency === 'EUR' ? amount * 0.94 : amount),
    });
    const cash = flattenReport(converted.assets).find((entry) => entry.account.number === 1001);
    expect(cash).toMatchObject({ stated: 200, amount: 188, inTotal: true });
  });
});

describe('postings naming an account nobody created', () => {
  it('reports them rather than losing them', () => {
    const strays = parseJournal('2026-08-04 | 4999 | 1005 | 12.00 | x').postings;
    const known = new Set(ACCOUNTS.map((a) => a.number));
    expect(unknownAccounts(strays, known)).toHaveLength(1);
    expect(unknownAccounts(strays, known)[0]?.number).toBe(4999);
  });
});
