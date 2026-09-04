/**
 * The figures that live on an itinerary item rather than on a booking note.
 *
 * **Why they exist at all.** The moment a trip gets priced is the moment
 * before there is anything to book: you lay out the flights and the hotel,
 * you look up what they cost, and two weeks later you actually book them.
 * Making that first pass require a booking note per line would mean writing
 * notes for things that do not exist yet, and then editing them into
 * something else. So a leg and a night carry a `cost`, and it means "this is
 * what I expect".
 *
 * **What keeps them from double counting.** A booking carrying the same
 * `reference` as a leg IS that leg, paid for, so the estimate stops
 * counting the moment such a booking exists. That is the same reference
 * match the itinerary already uses to put a cost chip on a leg, which is
 * what makes it worth reusing rather than inventing a second link.
 *
 * The rule has one honest hole, stated rather than hidden: an estimate with
 * no reference cannot be matched to anything, so a booking made without one
 * leaves both figures standing. The block shows an estimate as an estimate,
 * so two chips on one row is visible rather than silent.
 *
 * Pure. See docs/design/trip-budget-and-bookings.md.
 */
import { BookingCategory, ParsedBooking } from './booking-note';
import { lineCost, LineCost, lineTravellers } from './line-cost';
import { ParsedTripLeg, ParsedTripNight, ParsedTripStop } from '../trip-note';

/** The three words the labels supply, kept out of here so this file never learns what language it is in. */
export interface EstimateLabelWords {
  joiner: string;
  legFallback: string;
  nightFallback: string;
  stopFallback: string;
}

/** What an estimate needs off a trip: its priced lines and who is on it. */
export interface EstimatedTrip {
  stops: ParsedTripStop[];
  nights: ParsedTripNight[];
  transport: ParsedTripLeg[];
  personTitles: string[];
}

/** Any line that can carry a figure. The three differ in everything else and in nothing here. */
type LineFigure = Pick<ParsedTripLeg, 'cost' | 'currency' | 'costUnit' | 'persons'>;

/** One priced itinerary item, in the shape the totals understand. */
export interface ItemEstimate {
  /** What the row is, for the document's line: "Zürich to Pretoria", "Hotel Dreieich". */
  label: string;
  category: BookingCategory;
  amount: number;
  currency: string | null;
  /** What a booking has to carry to supersede this. Null when the item names none. */
  reference: string | null;
  /** Who it is for, resolved: the people the line names, or everybody on the trip. */
  persons: string[];
  /** The multiplication behind the amount, so a row can show its working instead of asking to be trusted. */
  cost: LineCost;
}

const key = (value: string | null): string => (value ?? '').trim().toLowerCase();

/**
 * Where a leg goes: "Zürich to Pretoria", or the one end it names, or null.
 *
 * Null rather than a fallback string, because the itinerary row and the
 * document line fall back to different things: a row already prints the
 * direction beside it, a document line has nothing else to say.
 */
export function legRoute(leg: ParsedTripLeg, joiner: string): string | null {
  const ends = [leg.origin, leg.destination].filter((end): end is string => !!end);
  if (ends.length === 2) return `${ends[0]} ${joiner} ${ends[1]}`;
  return ends[0] ?? null;
}

/** A leg as one line of a cost document: its route where it has one, its reference otherwise. */
export function legLabel(leg: ParsedTripLeg, joiner: string, fallback: string): string {
  return legRoute(leg, joiner) ?? leg.reference ?? fallback;
}

/**
 * Every priced item on a trip.
 *
 * Labels are passed in already localized, because this file has no business
 * knowing what language the reader uses.
 */
export function tripItemEstimates(trip: EstimatedTrip, labels: EstimateLabelWords): ItemEstimate[] {
  const estimates: ItemEstimate[] = [];
  const participants = trip.personTitles;

  const push = (
    label: string,
    category: BookingCategory,
    line: {
      cost: number | null;
      currency: string | null;
      costUnit: LineFigure['costUnit'];
      persons: string[];
    },
    reference: string | null,
    dates: {
      checkIn?: string | null;
      checkOut?: string | null;
      checkInDay?: number | null;
      checkOutDay?: number | null;
    } = {}
  ): void => {
    const cost = lineCost({
      cost: line.cost,
      unit: line.costUnit,
      persons: line.persons,
      participants,
      ...dates,
    });
    if (cost.amount === null) return;
    estimates.push({
      label,
      category,
      amount: cost.amount,
      currency: line.currency,
      reference,
      persons: lineTravellers(line.persons, participants),
      cost,
    });
  };

  for (const leg of trip.transport) {
    push(legLabel(leg, labels.joiner, labels.legFallback), 'transport', leg, leg.reference);
  }

  for (const night of trip.nights) {
    // A night has no reference of its own, so it is superseded by a booking
    // that names the same accommodation instead.
    push(
      night.accommodationTitle ?? labels.nightFallback,
      'accommodation',
      night,
      night.accommodationTitle,
      {
        checkIn: night.checkIn,
        checkOut: night.checkOut,
        checkInDay: night.checkInDay,
        checkOutDay: night.checkOutDay,
      }
    );
  }

  for (const stop of trip.stops) {
    push(stop.placeTitle ?? labels.stopFallback, 'activity', stop, stop.placeTitle);
  }

  return estimates;
}

/**
 * The estimates a booking has not already replaced.
 *
 * A leg is matched on its reference and a night on its accommodation, both
 * against the booking's own `reference` and `place`. Either match means the
 * real figure exists and the guess should stop being counted.
 */
export function unmatchedEstimates(
  estimates: ItemEstimate[],
  bookings: ParsedBooking[]
): ItemEstimate[] {
  const references = new Set(
    bookings.map((booking) => key(booking.reference)).filter((value) => value !== '')
  );
  const places = new Set(
    bookings.map((booking) => key(booking.placeTitle)).filter((value) => value !== '')
  );

  return estimates.filter((estimate) => {
    const reference = key(estimate.reference);
    if (reference === '') return true;
    return !references.has(reference) && !places.has(reference);
  });
}

/**
 * An estimate in the shape the totals already understand.
 *
 * Rather than a second code path through `tripCostTotals()`: an estimate is
 * a booking with a status of `estimate` and nobody who has paid for it,
 * which is exactly what it is. It carries no payer because nobody has paid.
 *
 * It carries who it is FOR because a printed line has to say so, and because
 * that list is what a booking made from it needs. Note that this is NOT what
 * keeps an estimate out of the settlement: `tripSettlement()` deliberately
 * charges a payer-less booking to the people it names, so an estimate that
 * reached it would invent a debt. Every caller passes it the real bookings
 * only, and that is the line to hold.
 */
export function asEstimateBooking(estimate: ItemEstimate, tripTitle: string): ParsedBooking {
  return {
    tripTitle,
    category: estimate.category,
    status: 'estimate',
    supplierTitle: null,
    placeTitle: null,
    date: null,
    amount: estimate.amount,
    currency: estimate.currency,
    reference: estimate.reference,
    payerTitle: null,
    forTitles: [...estimate.persons],
    documentPath: null,
  };
}

/**
 * The estimates that still count, as titled rows.
 *
 * The one entry point the costs block and the cost sheet share, so the
 * document and the screen cannot end up counting different things. The title
 * is the item's own label rather than a note name, because there is no note:
 * that is the whole point of an estimate.
 */
export function estimateLines(
  trip: EstimatedTrip,
  bookings: ParsedBooking[],
  tripTitle: string,
  labels: EstimateLabelWords
): (ParsedBooking & { title: string })[] {
  return unmatchedEstimates(tripItemEstimates(trip, labels), bookings).map((estimate) => ({
    ...asEstimateBooking(estimate, tripTitle),
    title: estimate.label,
  }));
}
