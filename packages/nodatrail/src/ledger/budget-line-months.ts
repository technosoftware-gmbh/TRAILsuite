/**
 * The months a budget line falls in, as the editor says them beside the line.
 *
 * A quarterly line with no month starts in January, which is the rule and
 * almost never the household's quarter: the mortgage interest due in March,
 * June, September and December was planned in October the first time it was
 * entered, and nothing on the row said so. Showing "Jan · Apr · Jul · Okt"
 * beside it makes the missing month visible while it is being typed.
 *
 * A line that falls every month says its range instead, "Mar - Nov", or
 * nothing at all when it runs the whole year, where the list would say
 * nothing. Worked out from the rhythm, the month and the range alone:
 * overrides change what a month holds, not whether the line falls in it.
 */
import {
  expandBudgetLine,
  hasBudgetRange,
  type AccountBudgetLine,
} from '@technosoftware/trail-core';
import { monthName } from '../ui/kit/format';

export function budgetLineMonths(
  line: Pick<AccountBudgetLine, 'rhythm' | 'startMonth'> &
    Partial<Pick<AccountBudgetLine, 'fromMonth' | 'toMonth'>>
): string {
  const range = { fromMonth: line.fromMonth ?? null, toMonth: line.toMonth ?? null };
  if (line.rhythm === 'monthly' || line.rhythm === 'weekly') {
    if (!hasBudgetRange(range)) return '';
    return `${monthName(range.fromMonth ?? 1)} - ${monthName(range.toMonth ?? 12)}`;
  }
  const months = expandBudgetLine({
    account: 0,
    amount: 1,
    rhythm: line.rhythm,
    startMonth: line.startMonth,
    ...range,
    note: '',
    overrides: {},
    via: null,
  });
  return months
    .map((value, index) => (value !== 0 ? monthName(index + 1) : null))
    .filter((name): name is string => name !== null)
    .join(' · ');
}
