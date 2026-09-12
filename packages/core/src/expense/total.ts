/**
 * What a set of priced lines adds up to.
 *
 * Generic over anything carrying a price, a quantity and a line discount, which
 * is what lets a meal order and a hardware purchase share one answer to "what
 * does this come to". `order/total.ts` delegates here rather than keeping its
 * own copy, because two implementations of a subtotal are two opinions about
 * the same note.
 *
 * App-free.
 */
import { roundCents } from '../money/format.js';

/** The shape every arithmetic function here needs, and nothing more. */
export interface PricedLine {
  price: number | null;
  quantity: number;
  discount: number | null;
}

/**
 * One line's contribution: what it cost, times how many, less its own discount.
 *
 * The line discount is applied here rather than alongside an order-level one
 * because it is part of what the line cost. A subtotal that ignored it and an
 * adjustment further down that tried to make up the difference would both be
 * wrong about which item was cheap.
 *
 * Clamped to nothing below zero. A hand-typed 120% is a typo, and a line worth
 * minus four francs would quietly reduce everything around it.
 */
export function lineTotal(line: PricedLine): number | null {
  if (line.price === null) return null;

  const gross = line.price * Math.max(1, line.quantity);
  const percent = Math.min(100, Math.max(0, line.discount ?? 0));
  return gross * (1 - percent / 100);
}

/**
 * What the lines come to before any whole-document discount or shipping, or
 * null.
 *
 * **Null unless at least one line carries a price.** A version that summed an
 * empty list would show a computed 0.00 next to a stated 89.40 and read as
 * software that had lost the money. A computed total is an opinion about a note
 * that holds the data for one, not a default state.
 */
export function linesSubtotal(lines: readonly PricedLine[]): number | null {
  const priced = lines.map(lineTotal).filter((value): value is number => value !== null);
  if (priced.length === 0) return null;

  return roundCents(priced.reduce((sum, value) => sum + value, 0));
}

/**
 * The subtotal with the whole-document adjustments applied, or null.
 *
 * Discount and shipping apply to the whole thing rather than to any line: sum
 * the lines, take the discount off, add the shipping. They are only applied
 * when there is a sum to apply them to, for the reason above.
 */
export function adjustedTotal(
  subtotal: number | null,
  discount: number | null,
  shipping: number | null
): number | null {
  if (subtotal === null) return null;
  return roundCents(subtotal - (discount ?? 0) + (shipping ?? 0));
}

/**
 * Whether a computed figure disagrees with the one somebody typed.
 *
 * False when either is missing: a document with no line prices is not in
 * disagreement with itself, it simply has nothing to compare. A cent of
 * tolerance, because the two can differ by rounding without anybody having made
 * a mistake.
 */
export function statedDisagreesWithComputed(
  stated: number | null,
  computed: number | null
): boolean {
  if (computed === null || stated === null) return false;
  return Math.abs(computed - stated) > 0.005;
}

/**
 * How much of a gross figure was tax.
 *
 * **Prices are gross, so this is carved out of the total rather than added to
 * it.** A stated amount wins over a rate: a document that names the francs is
 * saying what was actually charged, and recomputing that from a percentage
 * would produce a figure a cent away from the paper for no gain.
 */
export function includedVatOf(
  gross: number | null,
  vatRate: number | null,
  vatAmount: number | null
): number | null {
  if (vatAmount !== null) return roundCents(vatAmount);
  if (vatRate === null || vatRate <= 0 || gross === null) return null;

  // The tax inside a gross figure, not the tax on top of it: a 2.6% rate on a
  // gross 102.90 is 102.90 - 102.90 / 1.026, which is not 2.6% of 102.90.
  return roundCents(gross - gross / (1 + vatRate / 100));
}
