/**
 * What a priced line actually costs, once it is allowed to be sold at several
 * prices or not to happen at all.
 *
 * Two things live here because they are the two things a line can say beyond
 * its own figure, and every consumer needs both answered together.
 *
 * **Variants are alternatives, never extras.** A voyage offered as an outside
 * cabin at one price and a superior outside cabin at another is one journey; a
 * room offered as double or single is one stay. Exactly one of them is bought,
 * so they are **never summed** -- a total that added both would report a
 * holiday nobody is taking, which is the same class of lie the money rules
 * next door exist to prevent.
 *
 * Two questions follow, and both are answered here rather than at each of the
 * call sites that ask:
 *
 * - **Which variant counts before a choice is made.** The first, and the
 *   caller is told it was an assumption. Counting nothing would leave the
 *   largest figure on a trip out of its own budget for as long as the trip is
 *   being decided, which is exactly when the budget is read -- the same
 *   argument that makes an `estimate` booking count as committed. The note's
 *   own order picks it, the rule the itinerary already applies to its days.
 * - **What happens to the line's own `cost`.** It is not read. A line carrying
 *   both a figure and a set of variants would count the same thing twice, and
 *   the variants are the more specific statement. The editors move the figure
 *   into the first variant when one is added, so no path this plugin owns
 *   writes the two together.
 *
 * **Optional is the other axis, and it is orthogonal.** Nearly every day of a
 * cruise brochure offers something you may or may not take. Such a line is
 * priced like any other and stays out of the plan until `chosen` says
 * somebody decided on it; what the untaken ones would add is reported beside
 * the plan rather than inside it, so a total never quietly includes a decision
 * nobody has made. An optional line with variants is both at once and needs no
 * special case: it is out of the plan until chosen, and priced from its
 * variants when it is in.
 *
 * Pure: no Obsidian import, no clock, no language.
 */
import { ParsedTripVariant } from '../trip-note';
import { CostUnit } from './line-cost';

/** Any line that can carry a figure and the choices around it. The three differ in everything else and in nothing here. */
export interface VariedLine {
  cost: number | null;
  currency: string | null;
  costUnit: CostUnit;
  variants: ParsedTripVariant[];
  optional: boolean;
  chosen: boolean;
}

/** A line's figure, whichever of the two places it came from. */
export interface LineFigure {
  cost: number | null;
  currency: string | null;
  costUnit: CostUnit;
  /** The variant this figure is, or null for a line that carries a plain price. */
  variant: ParsedTripVariant | null;
  /**
   * True when the variant was picked by order rather than by anybody choosing it.
   *
   * The row that shows the figure says so, because "4479 because you chose it"
   * and "4479 because it is the first of three" are different claims and only
   * one of them is the reader's own.
   */
  assumed: boolean;
}

/** The variant somebody settled on, or null while the choice is open. The first when a note marks two, since a choice is one. */
export function chosenVariant(line: Pick<VariedLine, 'variants'>): ParsedTripVariant | null {
  return line.variants.find((variant) => variant.chosen) ?? null;
}

/** Whether this line is sold at several prices at all. */
export function hasVariants(line: Pick<VariedLine, 'variants'>): boolean {
  return line.variants.length > 0;
}

/**
 * Whether the line belongs in the plan.
 *
 * Everything does except an optional line nobody has taken. Not a filter over
 * money -- an untaken extra still has a price and still prints one; it is the
 * plan's total it stays out of.
 */
export function countsInPlan(line: Pick<VariedLine, 'optional' | 'chosen'>): boolean {
  return !line.optional || line.chosen;
}

/**
 * What the line costs, and which variant says so.
 *
 * The one entry point the itinerary rows, the cost chips, the estimates and
 * the trip document all go through, so a figure on the screen and a figure in
 * a total cannot come from different variants.
 */
export function lineFigure(line: Omit<VariedLine, 'optional' | 'chosen'>): LineFigure {
  const plain = {
    cost: line.cost,
    currency: line.currency,
    costUnit: line.costUnit,
    variant: null,
    assumed: false,
  };
  if (line.variants.length === 0) return plain;

  const chosen = line.variants.find((variant) => variant.chosen);
  const variant = chosen ?? line.variants[0];
  if (!variant) return plain;

  return {
    cost: variant.cost,
    // A note that states the currency once, on the line, means it for every
    // variant under it. Stating it per variant is the exception rather than
    // the shape, and a variant that does state one wins.
    currency: variant.currency ?? line.currency,
    costUnit: variant.costUnit,
    variant,
    assumed: chosen === undefined,
  };
}
