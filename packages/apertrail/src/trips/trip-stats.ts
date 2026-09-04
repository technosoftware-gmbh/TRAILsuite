/**
 * The Trip half of the dashboard's derived stats: how many trips sit in each
 * Travel Status, and how long until the next one departs.
 *
 * Takes a whole TravelBoard rather than just its trips. The input is
 * cross-module by nature -- read-entities.ts builds every entity type in one
 * pass -- and it is only the derivation that belongs to Trips.
 */
import { dateTimeDatePart, daysSince } from 'trail-core';
import { isTravelStatusValue, TRAVEL_STATUS_VALUES, TravelStatusValue } from './trip-note';
import { TravelBoard, TravelTrip } from '../vault/types';
import { BookingCategory } from './costs/booking-note';
import { tripCostTotals } from './costs/totals';

// Re-exported so the stats row, which already imports its stats shape from
// here, does not need a second import just to label the per-status counts.
export { TRAVEL_STATUS_VALUES };
export type { TravelStatusValue };

export interface NextTripInfo {
  trip: TravelTrip;
  daysUntil: number;
}

/**
 * What the next trip is going to cost, against what it was allowed to.
 *
 * Only for the next trip, and only when it has a plan or a booking: this is
 * the tile that answers "am I still inside the budget for the thing that has
 * not happened yet", and a figure for a trip nobody has budgeted would be a
 * number with no question behind it.
 */
export interface NextTripBudget {
  currency: string;
  planned: number | null;
  committed: number | null;
}

export interface TripDashboardStats {
  tripCountsByStatus: Record<TravelStatusValue, number>;
  nextTrip: NextTripInfo | null;
  /** Null when there is no next trip, when it has no money on it, or when the money feature is switched off. */
  nextTripBudget: NextTripBudget | null;
}

function countTripsByStatus(trips: TravelTrip[]): Record<TravelStatusValue, number> {
  const counts: Record<TravelStatusValue, number> = {
    Planned: 0,
    Booked: 0,
    Over: 0,
    Cancelled: 0,
  };
  // effectiveStatus, not the raw travelStatus -- a trip note that never
  // got a status typed into it still belongs in these counts, under the
  // status its own dates imply. See trip-note.ts's effectiveTravelStatus();
  // before that fallback existed, every trip in the reference vault counted
  // as nothing at all.
  for (const trip of trips) {
    // effectiveStatus is typed as one of the four, and the reader is the
    // only thing that sets it -- but this stays a checked lookup rather
    // than a bare index so a hand-constructed TravelTrip (or a future
    // caller that skips the reader) can't silently turn a count into NaN.
    if (isTravelStatusValue(trip.effectiveStatus)) counts[trip.effectiveStatus] += 1;
  }
  return counts;
}

/**
 * Nearest future Trip with a Planned/Booked status and a departure date --
 * Over/Cancelled trips and trips missing a departure are never candidates,
 * and a departure that's already passed (daysUntil < 0) is skipped rather
 * than shown as a negative countdown.
 *
 * **The date part, not the value.** A departure is written `2026-09-01T07:00`
 * and `daysSince` reads a date; handed the whole datetime it returns null, so
 * this tile silently found no candidate for every trip that carried a time,
 * which is every real one. The nearest-trip fixture in
 * `tests/travel-dashboard.test.ts` carries a clock time for exactly that
 * reason: the date-only fixture it replaced passed while the tile was dead, so
 * a fixture without a time proves only that the bug is invisible again.
 */
function computeNextTrip(trips: TravelTrip[]): NextTripInfo | null {
  let best: NextTripInfo | null = null;
  for (const trip of trips) {
    if (trip.effectiveStatus !== 'Planned' && trip.effectiveStatus !== 'Booked') continue;
    if (!trip.departure) continue;
    const since = daysSince(dateTimeDatePart(trip.departure));
    if (since === null) continue;
    const daysUntil = -since;
    if (daysUntil < 0) continue;
    if (!best || daysUntil < best.daysUntil) best = { trip, daysUntil };
  }
  return best;
}

/**
 * The next trip's money, from the same arithmetic the costs block uses.
 *
 * Through `tripCostTotals()` rather than a second sum here, so the tile and
 * the block cannot disagree about the same trip: the same reason CULItrail's
 * order card and its invoice both go through the core's order totals.
 */
function computeNextTripBudget(
  board: TravelBoard,
  next: NextTripInfo | null,
  homeCurrency: string
): NextTripBudget | null {
  if (!next) return null;

  const bookings = board.bookings.filter((booking) => booking.tripTitle === next.trip.title);
  const budget = next.trip.budget
    .filter((line) => line.amount !== null)
    .map((line) => ({ category: line.category as BookingCategory, amount: line.amount }));
  if (bookings.length === 0 && budget.length === 0) return null;

  const totals = tripCostTotals({
    bookings,
    budget,
    rates: next.trip.rates
      .filter((rate) => rate.rate !== null)
      .map((rate) => ({ currency: rate.currency, rate: rate.rate })),
    currency: next.trip.currency ?? homeCurrency,
  });

  return {
    currency: totals.currency,
    planned: totals.plannedTotal,
    committed: totals.committedConverted,
  };
}

export function computeTripStats(board: TravelBoard, homeCurrency = 'CHF'): TripDashboardStats {
  const nextTrip = computeNextTrip(board.trips);
  return {
    tripCountsByStatus: countTripsByStatus(board.trips),
    nextTrip,
    nextTripBudget: computeNextTripBudget(board, nextTrip, homeCurrency),
  };
}
