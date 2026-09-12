/**
 * Turning the three kinds of spending into the one shape a budget measures.
 *
 * A purchase, a bill and a projected occurrence of a recurring cost are three
 * different notes and one question: what did this cost, when, and to which area
 * and category does it belong. `SpendItem` is that question's shape, and it is
 * `trail-core`'s so the budget arithmetic never has to know which note an item
 * came from.
 *
 * **Which date places an item is a decision, not a detail.** A purchase belongs
 * to the day it was ordered. A bill belongs to the day it was **due**, not the
 * day it was paid, because that is the month somebody budgeted it in; a bill
 * paid late still belongs to the month it was owed. A projected occurrence
 * belongs to the day it falls.
 *
 * Pure, and generic over the file type, so the whole thing is testable with
 * plain objects.
 */
import {
  adjustedTotal,
  billPeriodDate,
  billStatus,
  computedPurchaseTotalOf,
  linesSubtotal,
  occurrencesBetween,
  type BillRecord,
  type PurchaseRecord,
  type RecurringRecord,
  type SpendItem,
} from '@technosoftware/trail-core';

/** A spend item with the note it came from, so a row can be clicked through. */
interface SourcedBase<F> extends SpendItem {
  file: F;
  title: string;
  /** ISO day. What placed this item in its period. */
  date: string | null;
}

/**
 * A spend item, the note it came from, and the record it was read out of.
 *
 * **The record travels with the item**, discriminated by `kind`, so a view that
 * lists these can offer the same actions the money views do -- mark a bill
 * paid, open its document, edit any of the three. It used to carry the file
 * alone, which is enough to open a note and not enough to do anything to it,
 * and the plan view's money section was therefore a list you could only read.
 *
 * A union rather than a `record: unknown`, because the three take different
 * dialogs and a caller narrowing on `kind` should get the right one from the
 * compiler rather than from a cast.
 */
export type SourcedSpendItem<F = unknown> =
  | (SourcedBase<F> & { kind: 'purchase'; record: PurchaseRecord<F> })
  | (SourcedBase<F> & { kind: 'bill'; record: BillRecord<F> })
  | (SourcedBase<F> & { kind: 'recurring'; record: RecurringRecord<F> });

/**
 * What a purchase cost.
 *
 * The stated total wins over the computed one, always. An order note is a
 * record of what was charged, and a figure recomputed from the lines is an
 * opinion about that record rather than the record itself. The computed total
 * is what the health check compares against, not what a budget spends.
 */
export function purchaseAmount<F>(purchase: PurchaseRecord<F>): number | null {
  return purchase.amount ?? computedPurchaseTotalOf(purchase);
}

export function purchaseItems<F>(
  purchases: readonly PurchaseRecord<F>[],
  fromIso: string,
  toIso: string
): SourcedSpendItem<F>[] {
  return purchases
    .filter((purchase) => purchase.status !== 'cancelled' && purchase.status !== 'returned')
    .filter((purchase) => inRange(purchase.date, fromIso, toIso))
    .map((purchase) => ({
      file: purchase.file,
      title: purchase.title,
      kind: 'purchase' as const,
      record: purchase,
      date: purchase.date,
      areaTitle: purchase.areaTitle,
      category: purchase.category,
      amount: purchaseAmount(purchase),
      currency: purchase.currency,
    }));
}

export function billItems<F>(
  bills: readonly BillRecord<F>[],
  fromIso: string,
  toIso: string,
  today: Date,
  dueSoonDays: number
): SourcedSpendItem<F>[] {
  return bills
    .filter((bill) => billStatus(bill, today, dueSoonDays) !== 'cancelled')
    .map((bill) => ({ bill, date: billPeriodDate(bill) }))
    .filter(({ date }) => inRange(date, fromIso, toIso))
    .map(({ bill, date }) => ({
      file: bill.file,
      title: bill.title,
      kind: 'bill' as const,
      record: bill,
      date,
      areaTitle: bill.areaTitle,
      category: bill.category,
      amount: bill.amount,
      currency: bill.currency,
    }));
}

/**
 * The occurrences of every recurring cost that fall in the range.
 *
 * **A cost that has already produced a bill note for an occurrence is counted
 * once, not twice.** The bill wins, because it is the record and the projection
 * is only a forecast of it. That is what `settledDates` is for: the caller
 * hands in the days already covered by a bill linked to this cost, and those
 * occurrences drop out.
 */
export function recurringItems<F>(
  costs: readonly RecurringRecord<F>[],
  fromIso: string,
  toIso: string,
  settledDates: ReadonlySet<string> = new Set()
): SourcedSpendItem<F>[] {
  return costs.flatMap((cost) =>
    occurrencesBetween(cost, fromIso, toIso)
      .filter((occurrence) => !settledDates.has(`${cost.title}@${occurrence.date}`))
      .map((occurrence) => ({
        file: cost.file,
        title: cost.title,
        kind: 'recurring' as const,
        record: cost,
        date: occurrence.date,
        areaTitle: cost.areaTitle,
        category: cost.category,
        amount: occurrence.amount,
        currency: occurrence.currency,
      }))
  );
}

/**
 * The occurrences a bill note already accounts for, keyed the way
 * `recurringItems` looks them up.
 *
 * A bill counts as settling an occurrence when it links to the recurring cost
 * and its own period date matches the day the occurrence falls on. Matching on
 * the exact day rather than the month is deliberate: a cost that falls twice in
 * one month, which is what a weekly one does, would otherwise have one bill
 * cancel every occurrence in it.
 */
export function settledOccurrences<F>(bills: readonly BillRecord<F>[]): Set<string> {
  const settled = new Set<string>();

  for (const bill of bills) {
    const date = billPeriodDate(bill);
    if (bill.recurringTitle && date) settled.add(`${bill.recurringTitle}@${date}`);
  }
  return settled;
}

/** Everything that cost money in a period, from all three sources. */
export function spendInPeriod<F>(input: {
  purchases: readonly PurchaseRecord<F>[];
  bills: readonly BillRecord<F>[];
  recurring: readonly RecurringRecord<F>[];
  from: string;
  to: string;
  today: Date;
  dueSoonDays: number;
}): SourcedSpendItem<F>[] {
  const bills = billItems(input.bills, input.from, input.to, input.today, input.dueSoonDays);

  return [
    ...purchaseItems(input.purchases, input.from, input.to),
    ...bills,
    ...recurringItems(input.recurring, input.from, input.to, settledOccurrences(input.bills)),
  ].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.title.localeCompare(b.title));
}

function inRange(day: string | null, fromIso: string, toIso: string): boolean {
  return day !== null && day >= fromIso && day <= toIso;
}

/** Re-exported so callers need not reach past this module for the one figure it computes over. */
export { adjustedTotal, linesSubtotal };
