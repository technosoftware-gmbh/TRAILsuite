/**
 * What a travel agency is asked for: the itinerary filtered down to the things
 * that are sold, one list per kind, and what is still undecided.
 *
 * The fourth sheet's model, before any of it is words. See
 * docs/design/booking-sheet.md. The trip document prints the whole plan and
 * the cost sheet what has been spent; this one prints what somebody takes to
 * a counter to be booked, and the selection rules below are the whole of the
 * difference, which is why they live here and nowhere else:
 *
 * - **Flights** are legs flown; **transport** is every other leg.
 * - **Hotels** are stays, the rooms of one stay grouped under it the way the
 *   trip document groups them.
 * - **Excursions** are stops that name an excursion. A museum or a restaurant
 *   is bought at the door, not at an agency, and is not on the sheet.
 * - A line is on the sheet when it counts in the plan: not optional, or
 *   optional and chosen. An optional line nobody has decided on is not a line
 *   but an open item.
 *
 * **It never picks for its owner.** The cost arithmetic counts the first
 * variant while nothing is chosen, so a budget is not too small while a trip
 * is being decided. Here that guess would become a purchase, so a line with
 * variants and none chosen carries no class and no price, and says so in the
 * open items instead. That is the one place this sheet reads a note
 * differently from the totals, and it does so on purpose.
 *
 * Pure and not yet words: dates stay ISO, times stay `HH:mm`, units stay the
 * unit vocabulary. The App-bound half formats and translates, the arrangement
 * every other sheet here has.
 */
import { caseFold } from '@technosoftware/trail-core';
import { TravelTrip, TravelTripLeg, TravelTripNight, TravelTripStop } from '../vault/types';
import { ParsedBooking } from './costs/booking-note';
import { bookingsForPlace } from './costs/booking-match';
import { CostUnit, lineCost, nightsBetween, nightsBetweenDays } from './costs/line-cost';
import { chosenVariant, countsInPlan, lineFigure } from './costs/line-variants';
import { namesSomebodyElse } from './costs/per-person';
import { legRoute } from './costs/estimates';
import { cabinDescription } from '../places/vehicle-note';
import { isFlight } from '../shared/travel-mode';
import { legNights, stopEndsNextDay } from './journey-text';
import { clockTime, endpointDate, RelativeEndpoint } from './relative-days';

/** Which of the four tables a line belongs in. */
export type BookingSection = 'flight' | 'hotel' | 'transport' | 'excursion';

/** When something happens: its date where the trip has dates, its day of the trip where it only has days. */
export interface BookingWhen {
  /** "YYYY-MM-DD", or null when it cannot be dated yet. */
  date: string | null;
  /** The day of the trip it was written against, or null for a line that names its own date. */
  day: number | null;
}

/** The class, cabin or room asked for: the chosen variant, with the ship's own words where the line has none. */
export interface BookingChoice {
  name: string | null;
  description: string | null;
}

/** What a line is expected to cost, as the plan says it. */
export interface BookingPrice {
  /** The figure as the note states it, per `unit`. */
  cost: number;
  currency: string;
  unit: CostUnit;
  /** What the line comes to once the unit is multiplied out, the figure the totals add. */
  total: number;
}

/**
 * Whether it is already booked, and under which reference.
 *
 * A leg's own `reference` is a booking reference, so a leg that carries one is
 * booked. A stay or an excursion has none of its own and is booked when a
 * booking note for it says booked or paid; an estimate is not a booking.
 */
export interface BookingState {
  booked: boolean;
  reference: string | null;
}

/** What every row carries, whatever it is. */
interface BookingLineBase {
  /** Who it is for, where that is not the whole party. Null means everybody. */
  persons: string[] | null;
  /** The chosen variant, or null for a line sold at one price or one whose choice is open. */
  choice: BookingChoice | null;
  /** True when the line has variants and nobody has chosen one. The row says "open" rather than guessing. */
  choiceOpen: boolean;
  /** Null for a line with no figure, or one whose choice is open. */
  price: BookingPrice | null;
  /** True for an optional line that has been chosen: an extra, but one somebody decided on. */
  optional: boolean;
  state: BookingState;
}

/** A flight, a train, a ship, a transfer: anything a leg is. */
export interface BookingLegLine extends BookingLineBase {
  section: 'flight' | 'transport';
  direction: 'outbound' | 'inbound';
  mode: string | null;
  carrier: string | null;
  number: string | null;
  vehicle: string | null;
  origin: string | null;
  destination: string | null;
  start: BookingWhen;
  /** Where it arrives on another day than it leaves, which is the `+1` of a flight and the fifteen days of a voyage. Null when it lands the same day or says nothing. */
  end: BookingWhen | null;
  /** Nights between departure and arrival, or null when it does not run overnight. */
  nights: number | null;
  departs: string | null;
  arrives: string | null;
  /**
   * The flights of a leg that changes planes, each with its own number and
   * times; empty for a direct leg. The class, reference and price above are
   * the ticket's and belong to all of them.
   */
  segments: BookingSegment[];
}

/** One flight of a leg that changes planes. */
export interface BookingSegment {
  /** Its own carrier for a codeshare, otherwise the leg's. */
  carrier: string | null;
  number: string | null;
  origin: string | null;
  destination: string | null;
  start: BookingWhen;
  nights: number | null;
  departs: string | null;
  arrives: string | null;
}

/** One room of a stay: who sleeps in it and what it is. */
export type BookingRoom = BookingLineBase;

export interface BookingStayLine {
  section: 'hotel';
  accommodation: string | null;
  city: string | null;
  address: string | null;
  website: string | null;
  checkIn: BookingWhen;
  checkOut: BookingWhen;
  nights: number | null;
  /** One entry for a stay booked as one room, several for a party split across rooms. Never empty. */
  rooms: BookingRoom[];
  state: BookingState;
}

export interface BookingExcursionLine extends BookingLineBase {
  section: 'excursion';
  excursion: string;
  place: string | null;
  start: BookingWhen;
  from: string | null;
  to: string | null;
  /** True when it ends the next morning: out at 01:30 after in at 23:45. */
  nextDay: boolean;
  duration: string | null;
  operator: string | null;
}

/** One way a variant can be bought, for the open item that lists them. */
export interface BookingOption {
  name: string | null;
  cost: number | null;
  currency: string;
  unit: CostUnit;
}

/**
 * Something the sheet cannot settle and will not guess.
 *
 * `subject` is the line as a person would name it: the route, the hotel, the
 * excursion. Already in the note's own words, so the App-bound half only has
 * to put a sentence round it.
 */
export type BookingOpenItem =
  | { kind: 'variant'; section: BookingSection; subject: string | null; options: BookingOption[] }
  | {
      kind: 'undecided';
      section: BookingSection;
      subject: string | null;
      when: BookingWhen;
      price: BookingPrice | null;
      options: BookingOption[];
    }
  | { kind: 'undated'; section: BookingSection; subject: string | null; day: number | null }
  | { kind: 'noTime'; section: BookingSection; subject: string | null };

export interface BookingSheetLines {
  /** Everybody on the trip, as written. The sheet adds the empty columns an agency asks for. */
  travellers: string[];
  flights: BookingLegLine[];
  hotels: BookingStayLine[];
  transport: BookingLegLine[];
  excursions: BookingExcursionLine[];
  /** What all the priced lines come to, per currency and never converted. */
  totals: { currency: string; amount: number }[];
  open: BookingOpenItem[];
}

export interface BookingSheetOptions {
  homeCurrency: string;
  /** The word between two ends of a route, already translated: "Zürich -> Pretoria" in the open items. */
  joiner: string;
}

type Line = TravelTripLeg | TravelTripNight | TravelTripStop;

/** Statuses that mean the money is committed. `estimate` is a figure somebody looked up, not a booking. */
function isBooked(booking: ParsedBooking): boolean {
  return booking.status === 'booked' || booking.status === 'paid';
}

function stateFrom(bookings: readonly ParsedBooking[]): BookingState {
  const held = bookings.filter(isBooked);
  return {
    booked: held.length > 0,
    reference: held.find((booking) => booking.reference)?.reference ?? null,
  };
}

function when(point: RelativeEndpoint, departure: string | null): BookingWhen {
  return { date: endpointDate(point, departure), day: point.day ?? null };
}

function currencyOf(
  figureCurrency: string | null,
  trip: TravelTrip,
  options: BookingSheetOptions
): string {
  return figureCurrency ?? trip.currency ?? options.homeCurrency;
}

/**
 * The line's price as the plan states it, or null where there is nothing to
 * state: no figure, or a choice nobody has made.
 */
function priceOf(
  line: Line,
  trip: TravelTrip,
  options: BookingSheetOptions,
  stay: {
    checkIn: string | null;
    checkOut: string | null;
    checkInDay: number | null;
    checkOutDay: number | null;
  } | null
): BookingPrice | null {
  const figure = lineFigure(line);
  if (figure.assumed || figure.cost === null) return null;
  const cost = lineCost({
    cost: figure.cost,
    unit: figure.costUnit,
    persons: line.persons,
    participants: trip.personTitles,
    ...(stay ?? {}),
  });
  return {
    cost: figure.cost,
    currency: currencyOf(figure.currency, trip, options),
    unit: figure.costUnit,
    total: cost.amount ?? figure.cost,
  };
}

function optionsOf(line: Line, trip: TravelTrip, options: BookingSheetOptions): BookingOption[] {
  return line.variants.map((variant) => ({
    name: variant.name,
    cost: variant.cost,
    currency: currencyOf(variant.currency ?? line.currency, trip, options),
    unit: variant.costUnit,
  }));
}

function personsOf(line: Line, trip: TravelTrip): string[] | null {
  return namesSomebodyElse(line.persons, trip.personTitles) ? [...line.persons] : null;
}

function choiceOf(line: Line, cabins: TravelTripLeg['vehicle'] = null): BookingChoice | null {
  const chosen = chosenVariant(line);
  if (!chosen) return null;
  return {
    name: chosen.name,
    description: chosen.description ?? cabinDescription(cabins, chosen.name),
  };
}

function choiceOpen(line: Line): boolean {
  return line.variants.length > 0 && chosenVariant(line) === null;
}

/**
 * Sorted by when, and otherwise in the note's order.
 *
 * Dated lines by date, then lines known only by their day, then lines that
 * say neither, each in the order the note wrote them: a comparator that tried
 * to rank a date against a day number would be ranking two different clocks.
 */
function byWhen<T>(items: T[], key: (item: T) => { when: BookingWhen; time: string | null }): T[] {
  const rank = (at: BookingWhen): number => (at.date !== null ? 0 : at.day !== null ? 1 : 2);
  return items
    .map((item, index) => ({ item, index, at: key(item) }))
    .sort((a, b) => {
      const ra = rank(a.at.when);
      const rb = rank(b.at.when);
      if (ra !== rb) return ra - rb;
      if (ra === 0) {
        const byDate = (a.at.when.date ?? '').localeCompare(b.at.when.date ?? '');
        if (byDate !== 0) return byDate;
      } else if (ra === 1) {
        const byDay = (a.at.when.day ?? 0) - (b.at.when.day ?? 0);
        if (byDay !== 0) return byDay;
      }
      if (ra !== 2 && a.at.time && b.at.time && a.at.time !== b.at.time) {
        return a.at.time.localeCompare(b.at.time);
      }
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

/** A mode that is bought without a timetable: a rental car has a pick-up, not a departure. */
function timetabled(mode: string | null): boolean {
  return mode?.trim() !== 'car';
}

function legSubject(leg: TravelTripLeg, joiner: string): string | null {
  const service = [leg.carrier, leg.number].filter((part): part is string => !!part).join(' ');
  return legRoute(leg, joiner) ?? (service === '' ? null : service) ?? leg.vehicleTitle;
}

export function bookingSheetLines(
  trip: TravelTrip,
  bookings: readonly ParsedBooking[],
  options: BookingSheetOptions
): BookingSheetLines {
  const departure = trip.departure;
  const open: BookingOpenItem[] = [];

  /** The open items every kind of line can raise, in the order a reader would fix them. */
  const raise = (
    line: Line,
    section: BookingSection,
    subject: string | null,
    start: BookingWhen
  ): boolean => {
    if (!countsInPlan(line)) {
      open.push({
        kind: 'undecided',
        section,
        subject,
        when: start,
        price: line.variants.length > 0 ? null : priceOf(line, trip, options, null),
        options: optionsOf(line, trip, options),
      });
      return false;
    }
    if (choiceOpen(line)) {
      open.push({ kind: 'variant', section, subject, options: optionsOf(line, trip, options) });
    }
    if (start.date === null) open.push({ kind: 'undated', section, subject, day: start.day });
    return true;
  };

  const legs: BookingLegLine[] = [];
  for (const leg of trip.transport) {
    const section = isFlight(leg.mode) ? 'flight' : 'transport';
    const subject = legSubject(leg, options.joiner);
    const start = when({ day: leg.day, value: leg.from }, departure);
    if (!raise(leg, section, subject, start)) continue;
    const departs = clockTime(leg.from);
    if (departs === null && timetabled(leg.mode)) open.push({ kind: 'noTime', section, subject });

    const nights = legNights(leg, departure);
    legs.push({
      section,
      direction: leg.direction,
      mode: leg.mode,
      carrier: leg.carrier,
      number: leg.number,
      vehicle: leg.vehicleTitle,
      origin: leg.origin,
      destination: leg.destination,
      start,
      end: nights === null ? null : when({ day: leg.toDay, value: leg.to }, departure),
      nights,
      departs,
      arrives: clockTime(leg.to),
      segments: leg.segments.map((segment) => ({
        carrier: segment.carrier ?? leg.carrier,
        number: segment.number,
        origin: segment.origin,
        destination: segment.destination,
        start: when({ day: segment.day, value: segment.from }, departure),
        nights: legNights(segment, departure),
        departs: clockTime(segment.from),
        arrives: clockTime(segment.to),
      })),
      persons: personsOf(leg, trip),
      choice: choiceOf(leg, leg.vehicle),
      choiceOpen: choiceOpen(leg),
      price: priceOf(leg, trip, options, null),
      optional: leg.optional,
      state: {
        booked: leg.reference !== null,
        reference: leg.reference,
      },
    });
  }

  // A party split across rooms is several entries at one place over the same
  // days. Grouped the way the trip document groups them, so the sheet and the
  // brochure count the same hotels.
  const stays = new Map<string, TravelTripNight[]>();
  for (const night of trip.nights) {
    const key = [
      caseFold(night.accommodationTitle),
      night.checkInDay ?? night.checkIn ?? '',
      night.checkOutDay ?? night.checkOut ?? '',
    ].join('|');
    const group = stays.get(key);
    if (group) group.push(night);
    else stays.set(key, [night]);
  }

  const hotels: BookingStayLine[] = [];
  for (const group of stays.values()) {
    const [first] = group;
    if (!first) continue;
    const subject = first.accommodationTitle;
    const checkIn = when({ day: first.checkInDay, value: first.checkIn }, departure);
    const checkOut = when({ day: first.checkOutDay, value: first.checkOut }, departure);
    const span = {
      checkIn: first.checkIn,
      checkOut: first.checkOut,
      checkInDay: first.checkInDay,
      checkOutDay: first.checkOutDay,
    };

    // Each room is decided on its own: a single room may be optional where
    // the double is not. The undated item is raised once per stay, not per
    // room, since the rooms share their dates.
    const rooms: BookingRoom[] = [];
    for (const night of group) {
      if (!countsInPlan(night)) {
        raise(night, 'hotel', subject, checkIn);
        continue;
      }
      if (choiceOpen(night)) {
        open.push({
          kind: 'variant',
          section: 'hotel',
          subject,
          options: optionsOf(night, trip, options),
        });
      }
      rooms.push({
        persons: personsOf(night, trip),
        choice: choiceOf(night),
        choiceOpen: choiceOpen(night),
        price: priceOf(night, trip, options, span),
        optional: night.optional,
        state: stateFrom(bookingsForPlace([...bookings], night.accommodationTitle)),
      });
    }
    if (rooms.length === 0) continue;
    if (checkIn.date === null) {
      open.push({ kind: 'undated', section: 'hotel', subject, day: checkIn.day });
    }

    const place = first.accommodation;
    hotels.push({
      section: 'hotel',
      accommodation: first.accommodationTitle,
      city: place?.cityTitle ?? null,
      address: place?.address ?? null,
      website: place?.website ?? null,
      checkIn,
      checkOut,
      nights:
        nightsBetweenDays(first.checkInDay, first.checkOutDay) ??
        nightsBetween(first.checkIn, first.checkOut),
      rooms,
      state: stateFrom(bookingsForPlace([...bookings], first.accommodationTitle)),
    });
  }

  // A booking names a place, and a port may have two excursions. The
  // excursion's own title matches first; the place only where it can mean
  // nothing else.
  const excursionStops = trip.stops.filter((stop) => stop.excursionTitle !== null);
  const perPlace = new Map<string, number>();
  for (const stop of excursionStops) {
    const key = caseFold(stop.placeTitle);
    if (key !== '') perPlace.set(key, (perPlace.get(key) ?? 0) + 1);
  }

  const excursions: BookingExcursionLine[] = [];
  for (const stop of excursionStops) {
    const title = stop.excursionTitle ?? '';
    const start = when({ day: stop.day, value: stop.from }, departure);
    if (!raise(stop, 'excursion', title, start)) continue;

    const own = bookingsForPlace([...bookings], title);
    const matched =
      own.length > 0 || (perPlace.get(caseFold(stop.placeTitle)) ?? 0) !== 1
        ? own
        : bookingsForPlace([...bookings], stop.placeTitle);

    excursions.push({
      section: 'excursion',
      excursion: title,
      place: stop.placeTitle,
      start,
      from: clockTime(stop.from),
      to: clockTime(stop.to),
      nextDay: stopEndsNextDay(stop),
      duration: stop.excursion?.duration ?? null,
      operator: stop.excursion?.operatorTitle ?? null,
      persons: personsOf(stop, trip),
      choice: choiceOf(stop),
      choiceOpen: choiceOpen(stop),
      price: priceOf(stop, trip, options, null),
      optional: stop.optional,
      state: stateFrom(matched),
    });
  }

  const flights = byWhen(
    legs.filter((leg) => leg.section === 'flight'),
    (leg) => ({ when: leg.start, time: leg.departs })
  );
  const transport = byWhen(
    legs.filter((leg) => leg.section === 'transport'),
    (leg) => ({ when: leg.start, time: leg.departs })
  );
  const sortedHotels = byWhen(hotels, (stay) => ({ when: stay.checkIn, time: null }));
  const sortedExcursions = byWhen(excursions, (line) => ({ when: line.start, time: line.from }));

  const sums = new Map<string, number>();
  const add = (price: BookingPrice | null): void => {
    if (!price) return;
    sums.set(
      price.currency,
      Math.round(((sums.get(price.currency) ?? 0) + price.total) * 100) / 100
    );
  };
  for (const leg of [...flights, ...transport]) add(leg.price);
  for (const stay of sortedHotels) for (const room of stay.rooms) add(room.price);
  for (const line of sortedExcursions) add(line.price);

  return {
    travellers: [...trip.personTitles],
    flights,
    hotels: sortedHotels,
    transport,
    excursions: sortedExcursions,
    totals: [...sums].map(([currency, amount]) => ({ currency, amount })),
    open,
  };
}
