/**
 * The three money blocks.
 *
 * `nod-bills` lists what is owed. `nod-budget` shows a period's plan against
 * what was actually spent. `nod-spending` goes in a **Company** note and answers
 * "what did I buy here, and what do I owe them".
 *
 * `nod-spending` is NODAtrail's counterpart to APERtrail's
 * `travel-related-trips` and CULItrail's `culi-related-orders`: a fence rendered
 * inside the shared CRM note without owning it. **An unclaimed fence renders as
 * a plain code block rather than an error**, which is what keeps a Company note
 * readable with any of the three plugins disabled.
 */
import { MarkdownPostProcessorContext } from 'obsidian';
import {
  accountLabel,
  billStatus,
  detectPeriodLevel,
  isOutstanding,
  parsePeriodTitle,
  sumByCurrency,
  titlesMatch,
  type PeriodLevel,
} from 'trail-core';
import { t } from '../../lang/I18nManager';
import { readFinanceBoard } from '../../finance/read-finance';
import { purchaseAmount } from '../../finance/spend';
import { chip, emptyState, row, stat, statRow } from '../kit/elements';
import { day, money } from '../kit/format';
import { measureMonth } from '../../ledger/budget-month';
import { blockArgs, hostNote, type BlockDeps } from './context';
import { noteIcon } from '../kit/note-icon';

/** The period a block was pointed at, or the current month. */
function periodFrom(args: Map<string, string>, today: Date): { level: PeriodLevel; date: Date } {
  const stated = args.get('period');
  const level = stated ? detectPeriodLevel(stated) : null;
  const date = level && stated ? parsePeriodTitle(level, stated) : null;

  return level && date ? { level, date } : { level: 'month', date: today };
}

export function renderBillsBlock(deps: BlockDeps, source: string, element: HTMLElement): void {
  const settings = deps.getSettings();
  const today = deps.today();
  const args = blockArgs(source);

  element.addClass('nod-block');

  const finance = readFinanceBoard(deps.app, settings);
  const wanted = args.get('area');
  const bills = finance.bills
    .filter((bill) => !wanted || titlesMatch(bill.areaTitle, wanted))
    .map((bill) => ({ bill, status: billStatus(bill, today, settings.billDueSoonDays) }))
    .filter(({ status }) => isOutstanding(status))
    .sort((a, b) => (a.bill.dueDate ?? '').localeCompare(b.bill.dueDate ?? ''));

  if (bills.length === 0) {
    emptyState(element, t('finance.noBills'));
    return;
  }

  const owed = sumByCurrency(
    bills.map(({ bill }) => bill),
    settings.homeCurrency
  );
  const strip = statRow(element);
  for (const [code, amount] of owed)
    stat(strip, t('finance.outstanding'), money(amount, code), 'warn');

  for (const { bill, status } of bills) {
    const line = row(element, {
      title: bill.title,
      subtitle: [bill.companyTitle, day(bill.dueDate)].filter(Boolean).join(' - '),
      trailing: money(bill.amount, bill.currency),
      trailingTone: status === 'overdue' ? 'warn' : undefined,
      icon: noteIcon(deps.app, bill.file, settings.iconProperty, 'receipt'),
      onClick: () => void deps.openNote(bill.file),
    });
    chip(line, t(`status.bill.${status}`), status === 'overdue' ? 'warn' : 'muted');
  }
}

/**
 * A month of the budget, on whatever note the block sits in.
 *
 * Asynchronous where the other blocks are not, because the figures come from
 * the postings and the postings live in the body of a note rather than in its
 * frontmatter. The level argument is accepted and only the month is measured:
 * a budget is planned per month, and a quarter of it is three months rather
 * than one longer one.
 */
export async function renderBudgetBlock(
  deps: BlockDeps,
  source: string,
  element: HTMLElement
): Promise<void> {
  const settings = deps.getSettings();
  const today = deps.today();
  const { date } = periodFrom(blockArgs(source), today);

  element.addClass('nod-block');

  const measured = await measureMonth(deps.app, settings, date);
  if (!measured) {
    emptyState(element, t('dashboard.noBudget'));
    return;
  }

  const { measure } = measured;
  const currency = measured.budget.currency ?? settings.homeCurrency;
  const strip = statRow(element);
  stat(strip, t('finance.planned'), money(measure.plannedTotal, currency));
  stat(strip, t('finance.actual'), money(measure.actualTotal, currency));

  for (const line of [...measure.rows, ...measure.unbudgeted]) {
    // A line with nothing planned and nothing spent is a plan for a month that
    // has not come round yet, and listing it would bury the ones that matter.
    if (line.planned === 0 && line.actual === 0) continue;
    row(element, {
      title: line.account ? accountLabel(line.account) : String(line.number),
      subtitle: `${money(line.actual, currency)} / ${money(line.planned, currency)}`,
      trailing: money(line.left, currency),
      trailingTone: line.left < 0 ? 'warn' : 'good',
    });
  }
}

/**
 * What was bought from this company, and what is still owed them.
 *
 * The company is the note the block sits in, which is why it takes no argument
 * in the common case: a block copied into another Company note answers about
 * that one instead of about the one it came from.
 */
export function renderSpendingBlock(
  deps: BlockDeps,
  source: string,
  element: HTMLElement,
  context: MarkdownPostProcessorContext
): void {
  const settings = deps.getSettings();
  const today = deps.today();
  const args = blockArgs(source);
  const company = args.get('company') ?? hostNote(deps.app, context)?.basename ?? '';

  element.addClass('nod-block');
  if (!company) {
    emptyState(element, t('finance.noPurchases'));
    return;
  }

  const finance = readFinanceBoard(deps.app, settings);
  const purchases = finance.purchases.filter((purchase) =>
    titlesMatch(purchase.companyTitle, company)
  );
  const bills = finance.bills
    .filter((bill) => titlesMatch(bill.companyTitle, company))
    .map((bill) => ({ bill, status: billStatus(bill, today, settings.billDueSoonDays) }));
  const recurring = finance.recurring.filter((cost) => titlesMatch(cost.companyTitle, company));

  if (purchases.length === 0 && bills.length === 0 && recurring.length === 0) {
    emptyState(element, t('finance.noPurchases'));
    return;
  }

  const owed = sumByCurrency(
    bills.filter(({ status }) => isOutstanding(status)).map(({ bill }) => bill),
    settings.homeCurrency
  );
  if (owed.size > 0) {
    const strip = statRow(element);
    for (const [code, amount] of owed) {
      stat(strip, t('finance.outstanding'), money(amount, code), 'warn');
    }
  }

  for (const purchase of [...purchases].sort((a, b) =>
    (b.date ?? '').localeCompare(a.date ?? '')
  )) {
    row(element, {
      title: purchase.title,
      subtitle: day(purchase.date),
      trailing: money(purchaseAmount(purchase), purchase.currency),
      icon: noteIcon(deps.app, purchase.file, settings.iconProperty, 'shopping-bag'),
      onClick: () => void deps.openNote(purchase.file),
    });
  }

  for (const { bill, status } of bills) {
    const line = row(element, {
      title: bill.title,
      subtitle: day(bill.dueDate),
      trailing: money(bill.amount, bill.currency),
      trailingTone: status === 'overdue' ? 'warn' : undefined,
      icon: noteIcon(deps.app, bill.file, settings.iconProperty, 'receipt'),
      onClick: () => void deps.openNote(bill.file),
    });
    chip(line, t(`status.bill.${status}`), status === 'overdue' ? 'warn' : 'muted');
  }

  for (const cost of recurring) {
    row(element, {
      title: cost.title,
      subtitle: t(`cadence.${cost.cadence}`),
      trailing: money(cost.amount, cost.currency),
      trailingTone: 'muted',
      icon: noteIcon(deps.app, cost.file, settings.iconProperty, 'repeat'),
      onClick: () => void deps.openNote(cost.file),
    });
  }
}
