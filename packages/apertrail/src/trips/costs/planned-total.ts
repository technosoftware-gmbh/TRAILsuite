/**
 * What a trip is planned to cost, by category.
 *
 * The figure a brochure states, as against what has been spent: a stated
 * ceiling where the budget names one, and the itinerary's own estimates for
 * everything it does not. Both are the plan. A booking is not, which is what
 * keeps the trip document from becoming a second cost sheet.
 *
 * **Pure, and extracted because the bug was here.** It lived inside the
 * document's App-bound half, where nothing could reach it: the loop asked
 * whether a category was already in the map it was itself filling, so the
 * first transport estimate landed, made `transport` present, and every later
 * one was dropped on the next line. A return flight vanished from a real trip
 * and two priced hotels would have gone the same way -- and the accumulator
 * underneath was correct code standing where it could never run.
 *
 * The fix is one line; having somewhere to test it is the rest of the point.
 */

/** A budget line as the trip states one. */
export interface PlannedBudgetLine {
  category: string;
  amount: number | null;
}

/** An itinerary item's own expected cost. `ItemEstimate` satisfies this. */
export interface PlannedEstimate {
  category: string;
  amount: number;
  /** Null means the trip's own currency, which is what most lines say. */
  currency: string | null;
}

export interface PlannedLine {
  category: string;
  amount: number;
}

/**
 * One figure per category: the budget's where it states one, the estimates'
 * sum where it does not.
 *
 * **The budget wins rather than adds.** A stated ceiling is somebody's
 * decision about the whole category, and adding the estimates to it would
 * report a trip costing more than the person planning it thinks it does.
 *
 * Estimates in another currency are skipped rather than converted: converting
 * here would be arithmetic the reader cannot check, and rates belong to the
 * cost sheet, which shows its working.
 *
 * Order is the budget's own first, then whatever the estimates add, so a
 * reader sees the decided figures above the derived ones.
 */
export function plannedByCategory(
  budget: readonly PlannedBudgetLine[],
  estimates: readonly PlannedEstimate[],
  currency: string
): PlannedLine[] {
  const planned = new Map<string, number>();
  for (const line of budget) {
    if (line.amount !== null) planned.set(line.category, line.amount);
  }

  // Settled before anything is added, so a category the estimates fill does
  // not start blocking its own later estimates. That is the whole defect.
  const budgeted = new Set(planned.keys());

  for (const estimate of estimates) {
    if (budgeted.has(estimate.category)) continue;
    if (estimate.currency !== null && estimate.currency !== currency) continue;
    planned.set(estimate.category, (planned.get(estimate.category) ?? 0) + estimate.amount);
  }

  return [...planned.entries()].map(([category, amount]) => ({ category, amount }));
}

/** What the whole plan comes to. Null when nothing is planned at all, which is not the same as zero. */
export function plannedTotal(lines: readonly PlannedLine[]): number | null {
  return lines.length === 0 ? null : lines.reduce((sum, line) => sum + line.amount, 0);
}
