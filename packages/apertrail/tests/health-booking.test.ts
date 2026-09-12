/**
 * The booking warnings.
 *
 * What they must stay quiet about matters more than what they catch: a
 * booking with no trip yet, one nobody has priced, and one whose trip has no
 * participants recorded are all ordinary half-filled notes rather than
 * mistakes.
 */
import { describe, expect, it } from 'vitest';
import { bookingWarnings, BookingContext } from '../src/vault/health/booking-issues';
import { ParsedBooking } from '../src/trips/costs/booking-note';

const TRIP = 'Jura im Juni';
const STEFAN = 'Stefan Muster';
const ERIKA = 'Erika Muster';

function booking(overrides: Partial<ParsedBooking> = {}): ParsedBooking {
  return {
    tripTitle: TRIP,
    category: 'transport',
    status: 'booked',
    supplierTitle: null,
    placeTitle: null,
    date: '2026-06-14',
    amount: 100,
    currency: 'CHF',
    reference: null,
    payerTitle: STEFAN,
    forTitles: [],
    documentPath: null,
    ...overrides,
  };
}

function context(overrides: Partial<BookingContext> = {}): BookingContext {
  return {
    tripTitles: new Set([TRIP]),
    participantsByTrip: new Map([[TRIP, new Set([STEFAN, ERIKA])]]),
    currencyByTrip: new Map<string, string | null>([[TRIP, 'CHF']]),
    homeCurrency: 'CHF',
    ...overrides,
  };
}

describe('a booking pointing at nothing', () => {
  it('warns when the trip it names does not exist', () => {
    const warnings = bookingWarnings(booking({ tripTitle: 'Jura im Juli' }), context());
    expect(warnings.map((warning) => warning.kind)).toEqual(['unattached']);
  });

  // A booking somebody is still writing is not a mistake.
  it('says nothing about a booking that names no trip at all', () => {
    expect(bookingWarnings(booking({ tripTitle: null }), context())).toEqual([]);
  });
});

describe('currency', () => {
  it('warns about an amount with no currency anywhere in the chain', () => {
    const warnings = bookingWarnings(
      booking({ currency: null }),
      context({ currencyByTrip: new Map<string, string | null>([[TRIP, null]]), homeCurrency: '' })
    );
    expect(warnings.map((warning) => warning.kind)).toEqual(['noCurrency']);
  });

  it('says nothing when the trip supplies one', () => {
    expect(
      bookingWarnings(
        booking({ currency: null }),
        context({
          currencyByTrip: new Map<string, string | null>([[TRIP, 'EUR']]),
          homeCurrency: '',
        })
      )
    ).toEqual([]);
  });

  // Unpriced is an ordinary state; only a figure needs a currency.
  it('says nothing about a booking nobody has priced', () => {
    expect(
      bookingWarnings(
        booking({ amount: null, currency: null }),
        context({
          currencyByTrip: new Map<string, string | null>([[TRIP, null]]),
          homeCurrency: '',
        })
      )
    ).toEqual([]);
  });
});

describe('the split', () => {
  it('warns when it names somebody who is not on the trip', () => {
    const warnings = bookingWarnings(booking({ forTitles: [STEFAN, 'Anna Meier'] }), context());
    expect(warnings).toEqual([{ kind: 'strangerOnTheSplit', person: 'Anna Meier' }]);
  });

  it('says nothing when everybody named is a participant', () => {
    expect(bookingWarnings(booking({ forTitles: [STEFAN, ERIKA] }), context())).toEqual([]);
  });

  // A trip whose participants nobody wrote down narrows nothing, so naming
  // anybody on a booking is fine.
  it('says nothing when the trip records no participants', () => {
    expect(
      bookingWarnings(
        booking({ forTitles: ['Anna Meier'] }),
        context({ participantsByTrip: new Map([[TRIP, new Set()]]) })
      )
    ).toEqual([]);
  });
});
