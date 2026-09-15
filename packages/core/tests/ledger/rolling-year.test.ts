/**
 * The year as a household steers it: planned in January, replaced by what
 * happened one closed month at a time.
 *
 * The cases that decide the design: a premium due in January is planned in
 * January and nowhere else; a month is reality only once it is closed, however
 * much has been booked into the next one; an account nobody budgeted but money
 * moved through is shown; and the net worth of an open month is the last
 * measured one moved by the planned result.
 */
import { describe, expect, it } from 'vitest';
import {
  clampClosedThrough,
  parseAccountBudget,
  buildAccountBudgetFrontmatter,
  type AccountBudgetLine,
  type AccountBudgetProperties,
} from '../../src/ledger/account-budget.js';
import { parseAccount, type AccountProperties } from '../../src/ledger/account.js';
import { rollingYear } from '../../src/ledger/rolling-year.js';
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

function account(number: number, kind: string, extra: Record<string, unknown> = {}): Account {
  const parsed = parseAccount({ number, kind, currency: 'CHF', ...extra }, `Konto ${number}`, P);
  if (!parsed) throw new Error('unreadable fixture');
  return parsed;
}

function line(partial: Partial<AccountBudgetLine> & { account: number }): AccountBudgetLine {
  return { amount: 0, rhythm: 'monthly', startMonth: null, note: '', overrides: {}, ...partial };
}

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

const BANK = 1011;
const RESERVE = 1030;
const MORTGAGE = 2050;
const SALARY = 3010;
const INSURANCE = 6100;
const FOOD = 6200;
const GIFTS = 6300;

const chart = [
  account(BANK, 'asset', { group: 'Konten', opening: 1000 }),
  account(RESERVE, 'asset', { group: 'Reserve', opening: 500 }),
  account(MORTGAGE, 'liability', { group: 'Hypotheken', opening: 0 }),
  account(SALARY, 'income', { group: 'Erwerbseinkommen' }),
  account(INSURANCE, 'expense', { group: 'Gemeinsame Kosten' }),
  account(FOOD, 'expense', { group: 'Gemeinsame Kosten' }),
  account(GIFTS, 'expense', { group: 'Sonstiges' }),
];

const lines = [
  line({ account: SALARY, amount: 5000 }),
  // Due in January, all of it: the case a budget divided by twelve gets wrong.
  line({ account: INSURANCE, amount: 2400, rhythm: 'annual', startMonth: 1 }),
  line({ account: FOOD, amount: 800 }),
];

const postings: Posting[] = [
  post('2026-01-25', BANK, SALARY, 5100),
  post('2026-01-10', INSURANCE, BANK, 2350),
  post('2026-01-31', FOOD, BANK, 900),
  // Money moved between two own accounts: no result, and no plan either.
  post('2026-01-31', RESERVE, BANK, 850),
  // Booked into February, which is not closed.
  post('2026-02-03', FOOD, BANK, 120),
  // Nobody budgeted gifts.
  post('2026-01-20', GIFTS, BANK, 60),
];

describe('a year with nothing closed', () => {
  const year = rollingYear(lines, chart, postings, 2026, 0);

  it('is pure plan, whatever has been booked', () => {
    expect(year.income.forecast).toEqual(new Array(12).fill(5000));
    expect(year.expense.forecast[0]).toBe(3200);
    expect(year.expense.forecast[1]).toBe(800);
    expect(year.result.variance).toBe(0);
  });

  it('plans a premium in the month it is due and nowhere else', () => {
    const insurance = year.expense.children[0]?.accounts.find(
      (a) => a.account.number === INSURANCE
    );
    expect(insurance?.plan).toEqual([2400, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('leaves out an account nobody planned while no closed month has touched it', () => {
    expect(year.expense.children.map((group) => group.name)).toEqual(['Gemeinsame Kosten']);
  });

  it('projects every month of the net worth from the opening by the planned result', () => {
    expect(year.net.opening).toBe(1500);
    expect(year.net.months[0]).toBe(1500 + 5000 - 3200);
    expect(year.net.months[1]).toBe(1500 + 5000 - 3200 + 5000 - 800);
    expect(year.net.measured.every((flag) => !flag)).toBe(true);
    expect(year.assets.months.every((value) => value === null)).toBe(true);
  });
});

describe('a year with January closed', () => {
  const year = rollingYear(lines, chart, postings, 2026, 1);

  it('shows what happened in January and the plan from February', () => {
    expect(year.income.forecast[0]).toBe(5100);
    expect(year.income.forecast[1]).toBe(5000);
    // 2350 + 900 + 60: the unbudgeted gifts count, February's booking does not.
    expect(year.expense.forecast[0]).toBe(3310);
    expect(year.expense.forecast[1]).toBe(800);
  });

  it('keeps the plan as made beside the forecast', () => {
    expect(year.expense.plan[0]).toBe(3200);
    expect(year.expense.planTotal).toBe(2400 + 800 * 12);
    expect(year.expense.forecastTotal).toBe(3310 + 800 * 11);
    expect(year.expense.variance).toBe(110);
    expect(year.income.variance).toBe(100);
    expect(year.result.variance).toBe(-10);
  });

  it('shows an account nobody budgeted once money moved through it, marked as such', () => {
    const gifts = year.expense.children.find((group) => group.name === 'Sonstiges')?.accounts[0];
    expect(gifts?.budgeted).toBe(false);
    expect(gifts?.forecast[0]).toBe(60);
    expect(gifts?.plan).toEqual(new Array(12).fill(0));
  });

  it('measures the balances at the end of January, and only January', () => {
    const bank = year.assets.children.find((group) => group.name === 'Konten')?.accounts[0];
    expect(bank?.opening).toBe(1000);
    expect(bank?.months[0]).toBe(1000 + 5100 - 2350 - 900 - 850 - 60);
    expect(bank?.months[1]).toBeNull();
    const reserve = year.assets.children.find((group) => group.name === 'Reserve')?.accounts[0];
    expect(reserve?.months[0]).toBe(1350);
  });

  it('measures the net worth of January and projects February from it', () => {
    const january = 1500 + 5100 - 3310;
    expect(year.net.months[0]).toBe(january);
    expect(year.net.measured[0]).toBe(true);
    expect(year.net.months[1]).toBe(january + 5000 - 800);
    expect(year.net.measured[1]).toBe(false);
  });

  it('leaves out an asset or liability that holds nothing', () => {
    expect(year.liabilities.children).toEqual([]);
  });
});

describe('what a budget note says', () => {
  it('reports a line on an account that is not income or expense', () => {
    const year = rollingYear(
      [line({ account: RESERVE, amount: 850 }), line({ account: 9999 })],
      chart,
      [],
      2026,
      0
    );
    expect(year.strayLines).toEqual([RESERVE, 9999]);
  });

  it('adds two lines on one account', () => {
    const year = rollingYear(
      [line({ account: FOOD, amount: 800 }), line({ account: FOOD, amount: 50 })],
      chart,
      [],
      2026,
      0
    );
    expect(year.expense.forecast[5]).toBe(850);
  });

  it('clamps the months closed rather than refusing them', () => {
    expect(clampClosedThrough(14)).toBe(12);
    expect(clampClosedThrough(-1)).toBe(0);
    expect(clampClosedThrough(2.7)).toBe(2);
    expect(clampClosedThrough(null)).toBe(0);
  });

  const BP: AccountBudgetProperties = {
    typePropertyName: 'type',
    typeValue: 'budget',
    periodProperty: 'period',
    currencyProperty: 'currency',
    linesProperty: 'lines',
    lineAccountField: 'account',
    lineAmountField: 'amount',
    lineRhythmField: 'rhythm',
    lineMonthField: 'month',
    lineNoteField: 'note',
    lineOverridesField: 'months',
    closedThroughProperty: 'closedThrough',
  };

  it('reads and writes the months closed, and writes nothing when none are', () => {
    const read = parseAccountBudget({ period: '2026', closedThrough: 3, lines: [] }, BP);
    expect(read.closedThrough).toBe(3);
    expect(buildAccountBudgetFrontmatter(BP, read).closedThrough).toBe(3);

    const open = parseAccountBudget({ period: '2026', lines: [] }, BP);
    expect(open.closedThrough).toBe(0);
    expect('closedThrough' in buildAccountBudgetFrontmatter(BP, open)).toBe(false);
  });
});
