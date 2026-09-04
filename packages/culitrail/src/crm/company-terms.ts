/**
 * What a company charges, and on what terms.
 *
 * **Unit-agnostic on purpose.** A discount tier says "from 12 upward, 10% off"
 * and has no opinion about what twelve of anything is; the caller counts. That
 * is not abstraction for its own sake: APERtrail is likely to want the same
 * block on the same Company notes for hotels and restaurants, where the ladder
 * is nights or guests rather than meals, and a module that hard-coded the word
 * "meal" could not be handed over without a rewrite. Nothing here mentions a
 * meal, an order or a plugin.
 *
 * It stays in CULItrail until a second plugin genuinely needs it, which is the
 * promotion rule for behaviour in `trail-core`'s CLAUDE.md: one consumer is a
 * module that belongs in its plugin, two is a contract. A discount ladder is
 * behaviour rather than a note format -- the Company note's own shape is
 * already the core's, in `crm/` -- so this is the door it has to come through.
 * The file is written to be moved the day it does: relocated, not rewritten.
 *
 * **Read only.** A Company note is shared with APERtrail, and CULItrail's half
 * of that contract is that it creates and modifies neither.
 * See docs/design/shared-crm.md.
 *
 * App-free.
 */
import { readNumberLike, readString, readStringList } from 'trail-core';

/**
 * One rung of a quantity ladder: everything from `from` upward gets `percent`
 * off, until a higher rung takes over.
 *
 * `from` is a count of whatever the caller is counting. `percent` is a
 * percentage, so 10 means ten percent and not a factor of ten.
 */
export interface DiscountTier {
  from: number;
  percent: number;
}

export interface CompanyTerms {
  /** ISO code as written, e.g. `CHF`. Null when the company states none. */
  currency: string | null;
  /** Free text, e.g. `Invoice` or `Credit card`. Never matched against, only shown. */
  paymentMethod: string | null;
  /** Free text, e.g. `At order` or `On delivery`. Likewise never matched against. */
  invoiceTiming: string | null;
  /** Charged once per order, unless waived by `freeShippingFrom`. */
  shippingFee: number | null;
  /** The count from which shipping is free. Null when it never is. */
  freeShippingFrom: number | null;
  /** Ascending by `from`, with later rungs winning a tie. Empty when none is stated. */
  discountTiers: DiscountTier[];
  /** The ranges a company sells under, e.g. Alltag, Sport, Weightloss. */
  lines: string[];
}

/** The frontmatter keys this module reads, resolved from settings once per read. */
export interface CompanyTermsProperties {
  currency: string;
  paymentMethod: string;
  invoiceTiming: string;
  shippingFee: string;
  freeShippingFrom: string;
  discountTable: string;
  lines: string;
}

/** A company that states nothing, so a caller never has to hold a null terms object. */
export function emptyCompanyTerms(): CompanyTerms {
  return {
    currency: null,
    paymentMethod: null,
    invoiceTiming: null,
    shippingFee: null,
    freeShippingFrom: null,
    discountTiers: [],
    lines: [],
  };
}

/**
 * One tier from whatever a row of the table happens to be.
 *
 * Two shapes, because a table is typed by hand and both are natural to type:
 * a mapping (`- from: 12` / `percent: 10`) and the one-line `12: 10` a person
 * writes when they are entering six of them. A row that yields neither number
 * is dropped rather than defaulted, since a rung at zero would silently
 * discount every order.
 */
function readTier(row: unknown): DiscountTier | null {
  if (typeof row === 'string') {
    const match = /^\s*(\d+(?:[.,]\d+)?)\s*[:=]\s*(\d+(?:[.,]\d+)?)\s*%?\s*$/.exec(row);
    if (!match) return null;
    return {
      from: Number(match[1].replace(',', '.')),
      percent: Number(match[2].replace(',', '.')),
    };
  }

  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const from = readNumberLike(record.from ?? record.quantity ?? record.count);
  const percent = readNumberLike(record.percent ?? record.discount);
  return from === null || percent === null ? null : { from, percent };
}

/**
 * The ladder, sorted and made unambiguous.
 *
 * Sorted because `discountFor()` walks it and a hand-written table is in
 * whatever order it was typed. Deduplicated by `from` with the last row
 * winning, because two rungs at the same count are a correction somebody made
 * without deleting the old line, and taking the later one is what they meant.
 */
export function readDiscountTiers(value: unknown): DiscountTier[] {
  const rows = Array.isArray(value) ? value : [value];
  const byFrom = new Map<number, number>();

  for (const row of rows) {
    const tier = readTier(row);
    if (tier) byFrom.set(tier.from, tier.percent);
  }

  return [...byFrom.entries()]
    .map(([from, percent]) => ({ from, percent }))
    .sort((a, b) => a.from - b.from);
}

export function readCompanyTerms(
  frontmatter: Record<string, unknown>,
  properties: CompanyTermsProperties
): CompanyTerms {
  return {
    currency: readString(frontmatter[properties.currency]),
    paymentMethod: readString(frontmatter[properties.paymentMethod]),
    invoiceTiming: readString(frontmatter[properties.invoiceTiming]),
    shippingFee: readNumberLike(frontmatter[properties.shippingFee]),
    freeShippingFrom: readNumberLike(frontmatter[properties.freeShippingFrom]),
    discountTiers: readDiscountTiers(frontmatter[properties.discountTable]),
    lines: readStringList(frontmatter[properties.lines]),
  };
}

/**
 * The percentage off at a given count, or 0 when no rung applies.
 *
 * The highest rung at or below the count wins, which is what a ladder means.
 * Zero rather than null for "no discount", because every caller would otherwise
 * turn null into zero itself and one of them would forget.
 */
export function discountFor(tiers: readonly DiscountTier[], count: number): number {
  let percent = 0;
  for (const tier of tiers) {
    if (count >= tier.from) percent = tier.percent;
  }
  return percent;
}

/**
 * What shipping costs at a given count.
 *
 * Null when the company states no fee at all, which is different from a fee of
 * zero: one is a company that never charges shipping and the other is this
 * order qualifying for free delivery. The order dialog shows them differently.
 */
export function shippingFor(terms: CompanyTerms, count: number): number | null {
  if (terms.shippingFee === null) return null;
  if (terms.freeShippingFrom !== null && count >= terms.freeShippingFrom) return 0;
  return terms.shippingFee;
}
