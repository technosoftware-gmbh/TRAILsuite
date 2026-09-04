/**
 * The budget note now that it is keyed to accounts.
 *
 * The format changed shape entirely: a line used to name an area and a category
 * and now names an account and a rhythm. These are the assertions that would
 * have caught the change being half done.
 */
import { describe, expect, it } from 'vitest';
import {
  buildAccountBudgetFrontmatter,
  budgetYear,
  budgetYearOf,
  parseAccountBudget,
  type AccountBudgetProperties,
} from 'trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { budgetProperties } from '../src/finance/properties';

const P: AccountBudgetProperties = budgetProperties(DEFAULT_SETTINGS);

describe('the properties the plugin ships', () => {
  it('names every field the parser needs', () => {
    expect(P).toMatchObject({
      lineAccountField: 'account',
      lineAmountField: 'amount',
      lineRhythmField: 'rhythm',
      lineMonthField: 'month',
      lineOverridesField: 'months',
    });
  });
});

describe('reading a budget note', () => {
  const budget = parseAccountBudget(
    {
      period: '2026',
      currency: 'CHF',
      lines: [
        { account: 4001, amount: 140, rhythm: 'monthly' },
        { account: 4011, amount: 480, rhythm: 'annual', month: 3, note: 'Autoversicherung' },
        { account: 4002, amount: 90, rhythm: 'quarterly', month: 2, months: { 8: 120 } },
        { amount: 50, rhythm: 'monthly' },
      ],
    },
    P
  );

  it('drops a line naming no account', () => {
    // A line with nothing to measure against can never be measured, which is
    // the whole reason for keying a budget to accounts.
    expect(budget.lines).toHaveLength(3);
  });

  it('reads the rhythm and the month it falls in', () => {
    expect(budget.lines[1]).toMatchObject({ account: 4011, rhythm: 'annual', startMonth: 3 });
  });

  it('reads the per-month overrides', () => {
    expect(budget.lines[2]?.overrides).toEqual({ 8: 120 });
  });

  it('falls back to monthly rather than refusing an unknown rhythm', () => {
    const odd = parseAccountBudget(
      { period: '2026', lines: [{ account: 4001, amount: 10, rhythm: 'fortnightly' }] },
      P
    );
    expect(odd.lines[0]?.rhythm).toBe('monthly');
  });

  it('reads the year it is for', () => {
    expect(budgetYearOf(budget)).toBe(2026);
    expect(budgetYearOf({ ...budget, period: null })).toBeNull();
  });
});

describe('what a year of it comes to', () => {
  const budget = parseAccountBudget(
    {
      period: '2026',
      currency: 'CHF',
      lines: [
        { account: 4001, amount: 140, rhythm: 'monthly' },
        { account: 4011, amount: 480, rhythm: 'annual', month: 3 },
      ],
    },
    P
  );

  it('is twelve of the monthly and one of the annual', () => {
    expect(budgetYear(budget.lines).total).toBe(140 * 12 + 480);
  });

  it('puts the annual figure in its own month and nowhere else', () => {
    const year = budgetYear(budget.lines);
    expect(year.monthTotals[2]).toBe(620);
    expect(year.monthTotals[3]).toBe(140);
  });
});

describe('writing it back', () => {
  it('round trips through the note', () => {
    const before = parseAccountBudget(
      {
        period: '2026',
        currency: 'CHF',
        lines: [{ account: 4011, amount: 480, rhythm: 'annual', month: 3, months: { 6: 500 } }],
      },
      P
    );
    const after = parseAccountBudget(buildAccountBudgetFrontmatter(P, before), P);
    expect(after).toEqual(before);
  });

  it('leaves out what a line does not say', () => {
    const budget = parseAccountBudget(
      { period: '2026', lines: [{ account: 4001, amount: 140, rhythm: 'monthly' }] },
      P
    );
    const written = buildAccountBudgetFrontmatter(P, budget);
    const lines = written['lines'] as Record<string, unknown>[];
    // No note, no overrides and no month: a budget somebody left simple stays
    // simple in the file.
    expect(Object.keys(lines[0] ?? {})).toEqual(['account', 'amount', 'rhythm']);
  });
});
