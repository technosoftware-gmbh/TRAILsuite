/**
 * The months beside a budget line in the editor.
 *
 * Written after a quarterly line with no month planned the mortgage interest
 * in January, April, July and October when it falls in March, June, September
 * and December: the rule was right and nothing on the row showed it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { budgetLineMonths } from '../src/ledger/budget-line-months';
import { setDisplayLocale } from '../src/ui/kit/format';

setDisplayLocale('en-US');
afterEach(() => setDisplayLocale('en-US'));

describe('the months a line falls in', () => {
  it('says January, April, July and October for a quarterly line with no month', () => {
    expect(budgetLineMonths({ rhythm: 'quarterly', startMonth: null })).toBe(
      'Jan · Apr · Jul · Oct'
    );
  });

  it('says March, June, September and December once the month is 3, or any month of that cycle', () => {
    expect(budgetLineMonths({ rhythm: 'quarterly', startMonth: 3 })).toBe('Mar · Jun · Sep · Dec');
    expect(budgetLineMonths({ rhythm: 'quarterly', startMonth: 9 })).toBe('Mar · Jun · Sep · Dec');
  });

  it('names the two months of a half-yearly line and the one of an annual line', () => {
    expect(budgetLineMonths({ rhythm: 'semiannual', startMonth: 5 })).toBe('May · Nov');
    expect(budgetLineMonths({ rhythm: 'annual', startMonth: 7 })).toBe('Jul');
    expect(budgetLineMonths({ rhythm: 'once', startMonth: null })).toBe('Jan');
  });

  it('says nothing for a line that falls every month', () => {
    expect(budgetLineMonths({ rhythm: 'monthly', startMonth: null })).toBe('');
    expect(budgetLineMonths({ rhythm: 'weekly', startMonth: 4 })).toBe('');
  });

  it('follows the vault’s conventions', () => {
    setDisplayLocale('de-CH');
    expect(budgetLineMonths({ rhythm: 'quarterly', startMonth: 3 })).toMatch(
      /^M\S+ · Jun\S* · Sep\S* · Dez\S*$/
    );
  });

  it('says the range of a monthly line that runs for part of the year', () => {
    expect(
      budgetLineMonths({ rhythm: 'monthly', startMonth: null, fromMonth: 3, toMonth: 11 })
    ).toBe('Mar - Nov');
    expect(
      budgetLineMonths({ rhythm: 'weekly', startMonth: null, fromMonth: 11, toMonth: 2 })
    ).toBe('Nov - Feb');
    expect(
      budgetLineMonths({ rhythm: 'monthly', startMonth: null, fromMonth: 1, toMonth: 12 })
    ).toBe('');
  });

  it('lists only the months in range for a line that skips months', () => {
    expect(
      budgetLineMonths({ rhythm: 'quarterly', startMonth: null, fromMonth: 3, toMonth: 11 })
    ).toBe('Mar · Jun · Sep');
  });
});
