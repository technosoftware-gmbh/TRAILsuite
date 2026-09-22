/**
 * The budget that is planned by rhythm and checked by the month.
 *
 * The case that decides the design is the annual one: a car insurance falling
 * once in March must show up in March and nowhere else, and must still count
 * towards the year.
 */
import { describe, expect, it } from 'vitest';
import {
  budgetYear,
  budgetYearOf,
  expandBudgetLine,
  hasBudgetRange,
  inBudgetRange,
  measureBudgetMonth,
  monthRange,
  type AccountBudgetLine,
} from '../../src/ledger/account-budget.js';
import { parseAccount, type AccountProperties } from '../../src/ledger/account.js';
import { parseJournal } from '../../src/ledger/journal.js';
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

function account(number: number, title: string, group = ''): Account {
  const parsed = parseAccount({ number, group, currency: 'CHF' }, title, P);
  if (!parsed) throw new Error('unreadable fixture');
  return parsed;
}

function line(partial: Partial<AccountBudgetLine> & { account: number }): AccountBudgetLine {
  return {
    amount: 0,
    rhythm: 'monthly',
    startMonth: null,
    fromMonth: null,
    toMonth: null,
    note: '',
    overrides: {},
    via: null,
    ...partial,
  };
}

describe('a line as twelve months', () => {
  it('spreads a monthly amount over every month', () => {
    expect(expandBudgetLine(line({ account: 4001, amount: 140 }))).toEqual(
      new Array<number>(12).fill(140)
    );
  });

  it('puts an annual amount in the one month it falls', () => {
    // The car insurance in March: the case the old yearly-only budget could not
    // express and the reason it went unused.
    const months = expandBudgetLine(
      line({ account: 4011, amount: 480, rhythm: 'annual', startMonth: 3 })
    );
    expect(months[2]).toBe(480);
    expect(months.filter((value) => value !== 0)).toEqual([480]);
  });

  it('steps a quarterly amount every third month, forwards and back', () => {
    const months = expandBudgetLine(
      line({ account: 4002, amount: 90, rhythm: 'quarterly', startMonth: 2 })
    );
    expect(months).toEqual([0, 90, 0, 0, 90, 0, 0, 90, 0, 0, 90, 0]);
  });

  it('steps a half-yearly amount twice', () => {
    const months = expandBudgetLine(
      line({ account: 4005, amount: 300, rhythm: 'semiannual', startMonth: 4 })
    );
    expect(months.filter((value) => value !== 0)).toEqual([300, 300]);
    expect(months[3]).toBe(300);
    expect(months[9]).toBe(300);
  });

  it('spreads a weekly amount rather than counting weeks', () => {
    // Four weeks in some months and five in others would make the budget swing
    // by a fifth for no reason anybody cares about. The year still adds up.
    const months = expandBudgetLine(line({ account: 4000, amount: 60, rhythm: 'weekly' }));
    expect(months[0]).toBe(260);
    expect(months.reduce((sum, value) => sum + value, 0)).toBe(3120);
  });

  it('defaults to January when no month is named', () => {
    const months = expandBudgetLine(line({ account: 4013, amount: 1200, rhythm: 'annual' }));
    expect(months[0]).toBe(1200);
  });

  it('lets an override beat the rhythm', () => {
    const months = expandBudgetLine(
      line({ account: 4001, amount: 140, overrides: { 1: 210, 12: 260 } })
    );
    expect(months[0]).toBe(210);
    expect(months[1]).toBe(140);
    expect(months[11]).toBe(260);
  });

  it('ignores an override for a month that does not exist', () => {
    const months = expandBudgetLine(line({ account: 4001, amount: 10, overrides: { 13: 999 } }));
    expect(months).toEqual(new Array<number>(12).fill(10));
  });
});

describe('a line that runs for part of the year', () => {
  it('falls only between its first and last month', () => {
    // The garden from March until November: one line rather than nine.
    const months = expandBudgetLine(
      line({ account: 4210, amount: 120, fromMonth: 3, toMonth: 11 })
    );
    expect(months).toEqual([0, 0, 120, 120, 120, 120, 120, 120, 120, 120, 120, 0]);
  });

  it('runs to December when only the start is named, and from January when only the end is', () => {
    expect(expandBudgetLine(line({ account: 4210, amount: 10, fromMonth: 10 }))).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 10, 10,
    ]);
    expect(expandBudgetLine(line({ account: 4210, amount: 10, toMonth: 2 }))).toEqual([
      10, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it('wraps past the year end when the first month is after the last', () => {
    // Heating from November until February, in one year's note: both ends of it.
    const months = expandBudgetLine(
      line({ account: 4020, amount: 300, fromMonth: 11, toMonth: 2 })
    );
    expect(months).toEqual([300, 300, 0, 0, 0, 0, 0, 0, 0, 0, 300, 300]);
  });

  it('counts a skipping rhythm from the start of the range', () => {
    const months = expandBudgetLine(
      line({ account: 4002, amount: 90, rhythm: 'quarterly', fromMonth: 3, toMonth: 11 })
    );
    expect(months).toEqual([0, 0, 90, 0, 0, 90, 0, 0, 90, 0, 0, 0]);
  });

  it('lets a named month win over the start of the range', () => {
    const months = expandBudgetLine(
      line({ account: 4002, amount: 90, rhythm: 'quarterly', startMonth: 1, fromMonth: 3 })
    );
    expect(months).toEqual([0, 0, 0, 90, 0, 0, 90, 0, 0, 90, 0, 0]);
  });

  it('spreads a weekly amount over the months in range only', () => {
    const months = expandBudgetLine(
      line({ account: 4000, amount: 60, rhythm: 'weekly', fromMonth: 4, toMonth: 9 })
    );
    expect(months.filter((value) => value !== 0)).toEqual(new Array<number>(6).fill(260));
  });

  it('keeps an override outside the range, because it names its month outright', () => {
    const months = expandBudgetLine(
      line({ account: 4210, amount: 120, fromMonth: 3, toMonth: 11, overrides: { 12: 40 } })
    );
    expect(months[11]).toBe(40);
    expect(months[0]).toBe(0);
  });

  it('says whether a line has a range at all', () => {
    expect(hasBudgetRange(line({ account: 1 }))).toBe(false);
    expect(hasBudgetRange(line({ account: 1, fromMonth: 1, toMonth: 12 }))).toBe(false);
    expect(hasBudgetRange(line({ account: 1, fromMonth: 3 }))).toBe(true);
    expect(inBudgetRange(line({ account: 1, fromMonth: 11, toMonth: 2 }), 1)).toBe(true);
    expect(inBudgetRange(line({ account: 1, fromMonth: 11, toMonth: 2 }), 6)).toBe(false);
  });
});

describe('the year overview', () => {
  const year = budgetYear([
    line({ account: 4001, amount: 140 }),
    line({ account: 4011, amount: 480, rhythm: 'annual', startMonth: 3 }),
    line({ account: 4002, amount: 90, rhythm: 'quarterly', startMonth: 2 }),
  ]);

  it('totals each line over the year', () => {
    expect(year.rows.map((row) => row.total)).toEqual([1680, 480, 360]);
  });

  it('totals each month across the lines', () => {
    expect(year.monthTotals[0]).toBe(140);
    expect(year.monthTotals[1]).toBe(230);
    expect(year.monthTotals[2]).toBe(620);
  });

  it('totals the year', () => {
    expect(year.total).toBe(2520);
  });
});

describe('a month measured', () => {
  const POWER = account(4001, 'IBB (Strom/Gas)');
  const CATS = account(4004, 'Katzen');
  const PHONE = account(4003, 'Telefon, Internet, Fernsehen');
  const BANK = account(1005, 'Haushaltskonto CHF');
  const ACCOUNTS = [POWER, CATS, PHONE, BANK];

  const POSTINGS = parseJournal(
    [
      '2026-08-04 | 4001 | 1005 | 128.45 | IBB August',
      '2026-08-11 | 4004 | 1005 | 220.00 | Katzenfutter',
      '2026-08-20 | 4003 | 1005 | 79.00 | Swisscom',
      '2026-09-04 | 4001 | 1005 | 131.00 | IBB September',
    ].join('\n')
  ).postings;

  const LINES = [line({ account: 4001, amount: 140 }), line({ account: 4004, amount: 180 })];
  const measure = measureBudgetMonth(LINES, ACCOUNTS, POSTINGS, 2026, 8);

  it('takes only the month asked for', () => {
    expect(measure.from).toBe('2026-08-01');
    expect(measure.to).toBe('2026-08-31');
    expect(measure.rows[0]?.actual).toBe(128.45);
  });

  it('says what is left, and what is over', () => {
    expect(measure.rows[0]?.left).toBe(11.55);
    expect(measure.rows[1]?.left).toBe(-40);
  });

  it('shows what no line claimed rather than hiding it', () => {
    // The most interesting row on the page: money spent on an account nobody
    // budgeted. A report that left it out would flatter.
    expect(measure.unbudgeted.map((row) => [row.number, row.actual])).toEqual([[4003, 79]]);
  });

  it('counts the unbudgeted into the actual result but not the planned', () => {
    // Expenses only here, so the result is what was spent, negative.
    expect(measure.plannedTotal).toBe(-320);
    expect(measure.actualTotal).toBe(-427.45);
    expect(measure.variance).toBe(-107.45);
  });

  it('keeps a line whose account note is missing, so it is visible rather than lost', () => {
    const orphan = measureBudgetMonth(
      [line({ account: 4999, amount: 50 })],
      ACCOUNTS,
      POSTINGS,
      2026,
      8
    );
    expect(orphan.rows[0]).toMatchObject({ number: 4999, account: null, planned: 50, actual: 0 });
  });

  it('leaves the asset accounts out of the unbudgeted list', () => {
    // Money leaving the bank account is not an unbudgeted expense; it is the
    // other side of one that is already counted.
    expect(measure.unbudgeted.map((row) => row.number)).not.toContain(1005);
  });
});

describe('a month with several lines on one account, and income', () => {
  const SALARY = account(3010, 'Einkommen Netto');
  const OTHER = account(3020, 'Einkommen Netto Partner');
  const BONUS = account(3090, 'Bonus');
  const HOUSE = account(4000, 'Haushaltsrechnungen');
  const BANK = account(1005, 'Haushaltskonto CHF');
  const ACCOUNTS = [SALARY, OTHER, BONUS, HOUSE, BANK];

  const POSTINGS = parseJournal(
    [
      '2026-01-25 | 1005 | 3010 | 10102.20 | Lohn Januar',
      '2026-01-25 | 1005 | 3020 | 3740.95 | Lohn Januar',
      '2026-01-26 | 1005 | 3090 | 500.00 | Bonus',
      '2026-01-28 | 4000 | 1005 | 1279.90 | Rechnungen',
    ].join('\n')
  ).postings;

  // The salary planned one line a month, as a budget had to be written before
  // a line could carry a range: the case that showed the salary three times.
  const LINES = [
    line({ account: 3010, amount: 10102.2, rhythm: 'once', startMonth: 1, note: 'Januar' }),
    line({ account: 3010, amount: 10102.2, rhythm: 'once', startMonth: 2 }),
    line({ account: 3010, amount: 10102.2, rhythm: 'once', startMonth: 3, note: 'März' }),
    line({ account: 3020, amount: 3793.1 }),
    line({ account: 4000, amount: 1950 }),
  ];
  const measure = measureBudgetMonth(LINES, ACCOUNTS, POSTINGS, 2026, 1);

  it('measures an account once, however many lines plan it', () => {
    expect(measure.rows.map((row) => row.number)).toEqual([3010, 3020, 4000]);
    expect(measure.rows[0]).toMatchObject({ planned: 10102.2, actual: 10102.2, left: 0 });
  });

  it('joins the notes of the lines it merged', () => {
    expect(measure.rows[0]?.note).toBe('Januar · März');
  });

  it('calls income earned short of its plan worse, not better', () => {
    expect(measure.rows[1]?.left).toBe(-52.15);
    expect(measure.rows[2]?.left).toBe(670.1);
  });

  it('shows income no line claimed, and counts it into the result', () => {
    expect(measure.unbudgeted.map((row) => [row.number, row.actual, row.left])).toEqual([
      [3090, 500, 500],
    ]);
    expect(measure.plannedTotal).toBe(roundTo(10102.2 + 3793.1 - 1950));
    expect(measure.actualTotal).toBe(roundTo(10102.2 + 3740.95 + 500 - 1279.9));
    expect(measure.variance).toBe(roundTo(measure.actualTotal - measure.plannedTotal));
  });
});

function roundTo(value: number): number {
  return Math.round(value * 100) / 100;
}

describe('monthRange', () => {
  it('ends on the last day the month actually has', () => {
    expect(monthRange(2026, 2).to).toBe('2026-02-28');
    expect(monthRange(2028, 2).to).toBe('2028-02-29');
    expect(monthRange(2026, 12)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});

describe('which year a budget note is for', () => {
  const forPeriod = (period: string | null) =>
    budgetYearOf({ period, currency: null, lines: [], closedThrough: 0, via: null });

  it('reads a bare year', () => {
    expect(forPeriod('2026')).toBe(2026);
  });

  it('refuses a period naming a month, rather than reading the year out of it', () => {
    // A note whose period is a month was written under the older shape, where a
    // budget was one note a month. Accepting it would let a note with no
    // readable lines present itself as the year's budget and report a plan of
    // nothing, which reads exactly like a year nobody has budgeted yet.
    expect(forPeriod('2026-08')).toBeNull();
    expect(forPeriod('2026-Q3')).toBeNull();
  });

  it('refuses what it cannot read', () => {
    expect(forPeriod(null)).toBeNull();
    expect(forPeriod('next year')).toBeNull();
  });
});

describe('a transfer in a month measured against its plan', () => {
  it('is left out, so a bank balance is never measured as spending', () => {
    const chart = [
      { ...account(1011, 'Bank'), kind: 'asset' as const },
      { ...account(1030, 'Reserve'), kind: 'asset' as const },
      account(6110, 'Haushalt'),
    ];
    const measure = measureBudgetMonth(
      [line({ account: 6110, amount: 100 }), line({ account: 1030, amount: 600, via: 1011 })],
      chart,
      [],
      2026,
      1
    );
    expect(measure.rows.map((row) => row.number)).toEqual([6110]);
    expect(measure.plannedTotal).toBe(-100);
  });
});
