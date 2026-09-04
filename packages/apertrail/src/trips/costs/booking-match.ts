/**
 * Which bookings belong to which line of an itinerary.
 *
 * Two rules, and the second one is the reason this file is worth having.
 *
 * A stop or a night matches a booking whose `place` is the same note, which
 * is the obvious half. A transport leg matches a booking whose `reference`
 * equals the leg's own, which costs nothing because `legReferenceField`
 * already exists and a booking reference is exactly what people type into
 * it. A leg has no identity of its own to match on otherwise.
 *
 * Pure. See docs/design/trip-budget-and-bookings.md §7.3.
 */
import { ParsedBooking } from './booking-note';

const key = (value: string | null): string => (value ?? '').trim().toLowerCase();

/** Bookings for a stop or a night at a given place, matched by title the way every wikilink here is. */
export function bookingsForPlace<T extends ParsedBooking>(
  bookings: T[],
  placeTitle: string | null
): T[] {
  if (key(placeTitle) === '') return [];
  return bookings.filter((booking) => key(booking.placeTitle) === key(placeTitle));
}

/** Bookings for a transport leg, matched on the reference both sides already carry. */
export function bookingsForReference<T extends ParsedBooking>(
  bookings: T[],
  reference: string | null
): T[] {
  if (key(reference) === '') return [];
  return bookings.filter((booking) => key(booking.reference) === key(reference));
}

/**
 * What a set of bookings comes to, per currency.
 *
 * Per currency rather than converted, because a chip beside an itinerary row
 * has no room to explain a rate, and a converted figure without its rate is
 * the one thing this feature must not print. Two currencies on one row show
 * two chips.
 */
export function chipAmounts(bookings: ParsedBooking[], tripCurrency: string): Map<string, number> {
  const totals = new Map<string, number>();

  for (const booking of bookings) {
    if (booking.status === 'cancelled' || booking.amount === null) continue;
    const amount = booking.status === 'refunded' ? 0 : booking.amount;
    const code = booking.currency ?? tripCurrency;
    totals.set(code, Math.round(((totals.get(code) ?? 0) + amount) * 100) / 100);
  }

  return totals;
}
