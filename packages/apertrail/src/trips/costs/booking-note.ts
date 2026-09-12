/**
 * What a booking note holds, and how it is read.
 *
 * A booking is one purchase that belongs to one trip: a flight, a hotel
 * stay, a museum ticket. The note is the record of what was charged, which
 * is why nothing here recomputes a figure from anywhere else, and why a
 * price that changes later is a different booking rather than an edit to
 * this one's meaning. The same rule `trail-core`'s order items already
 * carry, for the same reason.
 *
 * Pure: no Obsidian import, so parsing is testable without a vault.
 * See docs/design/trip-budget-and-bookings.md §4.
 */
import {
  normalizeCurrency,
  readNumberLike,
  readString,
  wikilinkTarget,
  wikilinkTargets,
} from '@technosoftware/trail-core';

/**
 * What kind of spending this is.
 *
 * Six, because a real trip's spending falls into them without deliberation.
 * `fees` is visas, insurance, baggage, the tourist tax a hotel adds at the
 * desk: money the trip costs that nobody enjoys. `other` exists so nothing
 * has to be miscategorised, and a trip whose biggest category is `other` is
 * telling you the vocabulary is wrong, which is information.
 *
 * A fixed vocabulary rather than a setting, for the reason
 * `TRAVEL_STATUS_VALUES` is one: a budget line, a total and a warning all
 * key off these exact strings, and a vault that renamed one would have
 * silently unbudgeted a category.
 */
export const BOOKING_CATEGORIES = [
  'transport',
  'accommodation',
  'activity',
  'food',
  'fees',
  'other',
] as const;

export type BookingCategory = (typeof BOOKING_CATEGORIES)[number];

/**
 * How far along a booking is, and therefore which total it counts in.
 *
 * `estimate` is a figure somebody looked up while planning, committed to
 * nothing. `booked` is owed. `paid` has left the account. `cancelled` is out
 * of every total. `refunded` counts as zero and stays visible, because a
 * refunded booking is evidence and deleting the note would lose the
 * reference the money came back under.
 */
export const BOOKING_STATUSES = ['estimate', 'booked', 'paid', 'cancelled', 'refunded'] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export function isBookingCategory(value: unknown): value is BookingCategory {
  return (
    typeof value === 'string' && (BOOKING_CATEGORIES as readonly string[]).includes(value.trim())
  );
}

export function isBookingStatus(value: unknown): value is BookingStatus {
  return (
    typeof value === 'string' && (BOOKING_STATUSES as readonly string[]).includes(value.trim())
  );
}

export interface BookingPropertyNames {
  tripProperty: string;
  categoryProperty: string;
  statusProperty: string;
  supplierProperty: string;
  placeProperty: string;
  dateProperty: string;
  amountProperty: string;
  currencyProperty: string;
  referenceProperty: string;
  payerProperty: string;
  forProperty: string;
  documentProperty: string;
}

/** One booking, as its note states it. Titles rather than resolved notes: resolution belongs to the reader. */
export interface ParsedBooking {
  tripTitle: string | null;
  category: BookingCategory;
  status: BookingStatus;
  supplierTitle: string | null;
  placeTitle: string | null;
  /** "YYYY-MM-DD", the day the cost belongs to rather than the day it was paid. */
  date: string | null;
  /** What it costs. Null means nobody has priced it yet, which is not zero: zero is a line that was genuinely free. */
  amount: number | null;
  /** The note's own currency, or null to inherit the trip's and then the setting's. */
  currency: string | null;
  reference: string | null;
  payerTitle: string | null;
  /** Who the cost is for. Empty means every participant of the trip, which is the common case and should not have to be typed. */
  forTitles: string[];
  /**
   * The confirmation file, as written. Resolved by the UI, kept verbatim.
   *
   * Named `documentPath` on the model while the note's property stays
   * `document`: a field called `document` shadows the global in every file
   * that destructures a booking, which is a trap rather than a tidiness.
   */
  documentPath: string | null;
}

/**
 * An unrecognized `category:` reads as `other` and an unrecognized `status:`
 * as `booked`, rather than as null.
 *
 * Both are what a half-typed note most likely means: something was spent on
 * something, and it is committed. A nullable category would put an
 * "uncategorised" column on every sheet to describe a typo, and a nullable
 * status would leave a figure in none of the three totals, which is the one
 * outcome guaranteed to be wrong.
 */
export function parseBooking(
  frontmatter: Record<string, unknown>,
  properties: BookingPropertyNames
): ParsedBooking {
  const p = properties;
  const rawCategory = readString(frontmatter[p.categoryProperty]);
  const rawStatus = readString(frontmatter[p.statusProperty]);

  return {
    tripTitle: wikilinkTarget(frontmatter[p.tripProperty]),
    category: isBookingCategory(rawCategory) ? (rawCategory.trim() as BookingCategory) : 'other',
    status: isBookingStatus(rawStatus) ? (rawStatus.trim() as BookingStatus) : 'booked',
    supplierTitle: wikilinkTarget(frontmatter[p.supplierProperty]),
    placeTitle: wikilinkTarget(frontmatter[p.placeProperty]),
    date: readString(frontmatter[p.dateProperty])?.slice(0, 10) ?? null,
    amount: readNumberLike(frontmatter[p.amountProperty]),
    currency: normalizeCurrency(readString(frontmatter[p.currencyProperty])),
    reference: readString(frontmatter[p.referenceProperty]),
    payerTitle: wikilinkTarget(frontmatter[p.payerProperty]),
    forTitles: wikilinkTargets(frontmatter[p.forProperty]),
    documentPath: readString(frontmatter[p.documentProperty]),
  };
}
