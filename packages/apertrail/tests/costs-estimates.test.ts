/**
 * The figures that live on an itinerary line rather than on a booking note.
 *
 * Two things carry the weight here. A leg reads as a route, which is what
 * the flight actually is, and an estimate STOPS counting the moment a
 * booking takes it over -- if that match ever broke, a trip would silently
 * count its flights twice and the budget would look blown for no reason.
 * The last case pins down the honest hole: an unreferenced estimate cannot
 * be matched, and is deliberately kept rather than guessed at.
 */
import { describe, expect, it } from 'vitest';
import { aParsedLeg, aParsedNight, aParsedStop } from './fixtures';
import {
  asEstimateBooking,
  EstimatedTrip,
  estimateLines,
  ItemEstimate,
  legLabel,
  legRoute,
  tripItemEstimates,
  unmatchedEstimates,
} from '../src/trips/costs/estimates';
import { ParsedBooking } from '../src/trips/costs/booking-note';

const LABELS = {
  joiner: 'to',
  legFallback: 'Transport leg',
  nightFallback: 'Accommodation',
  stopFallback: 'Stop',
};

const TWO = ['Stefan', 'Erika'];

function trip(overrides: Partial<EstimatedTrip> = {}): EstimatedTrip {
  return { stops: [], nights: [], transport: [], personTitles: TWO, ...overrides };
}

const stop = aParsedStop;

/** An estimate as the matcher sees it. The arithmetic behind it is lineCost's business, and has its own suite. */
function estimate(overrides: Partial<ItemEstimate> = {}): ItemEstimate {
  return {
    label: 'Zürich to Pretoria',
    category: 'transport',
    amount: 890,
    currency: null,
    reference: 'LX288',
    persons: TWO,
    cost: { amount: 890, unitAmount: 890, unit: 'total', multiplier: 1, people: 2, nights: null },
    ...overrides,
  };
}

const leg = aParsedLeg;

const night = aParsedNight;

function booking(overrides: Partial<ParsedBooking> = {}): ParsedBooking {
  return {
    tripTitle: 'Südafrika 2026',
    category: 'transport',
    status: 'booked',
    supplierTitle: null,
    placeTitle: null,
    date: null,
    amount: 900,
    currency: 'CHF',
    reference: null,
    payerTitle: null,
    forTitles: [],
    documentPath: null,
    ...overrides,
  };
}

describe('legRoute', () => {
  it('reads as a route when the leg names both ends', () => {
    expect(legRoute(leg({ origin: 'Zürich', destination: 'Pretoria' }), 'to')).toBe(
      'Zürich to Pretoria'
    );
  });

  it('gives the one end a half-filled leg names', () => {
    expect(legRoute(leg({ origin: 'Zürich' }), 'to')).toBe('Zürich');
    expect(legRoute(leg({ destination: 'Pretoria' }), 'to')).toBe('Pretoria');
  });

  it('is null rather than a placeholder when the leg names neither', () => {
    expect(legRoute(leg({ reference: 'LX288' }), 'to')).toBeNull();
  });
});

describe('legLabel', () => {
  it('falls back to the reference, then to the caller word', () => {
    expect(legLabel(leg({ reference: 'LX288' }), 'to', 'Transport leg')).toBe('LX288');
    expect(legLabel(leg(), 'to', 'Transport leg')).toBe('Transport leg');
  });
});

describe('tripItemEstimates', () => {
  it('takes only the lines that carry a figure', () => {
    const estimates = tripItemEstimates(
      trip({
        transport: [
          leg({ origin: 'Zürich', destination: 'Pretoria', cost: 890, reference: 'LX288' }),
          leg({ origin: 'Pretoria', destination: 'Zürich' }),
        ],
        nights: [night({ accommodationTitle: 'Hotel 224', cost: 240, currency: 'ZAR' })],
      }),
      LABELS
    );
    expect(estimates.map((e) => [e.label, e.amount, e.category])).toEqual([
      ['Zürich to Pretoria', 890, 'transport'],
      ['Hotel 224', 240, 'accommodation'],
    ]);
  });

  /**
   * The case this whole shape exists for: two people means two tickets. A
   * fare is quoted per passenger, so the trip's figure is twice what the
   * airline quoted, and a budget counting 890 once is wrong by a flight.
   */
  it('multiplies a per-person fare by the people on the trip', () => {
    const [flight] = tripItemEstimates(
      trip({ transport: [leg({ origin: 'Zürich', cost: 890, costUnit: 'person' })] }),
      LABELS
    );
    expect(flight.amount).toBe(1780);
    expect(flight.persons).toEqual(TWO);
    expect(flight.cost.multiplier).toBe(2);
  });

  it('charges a per-person fare only to the people the leg names', () => {
    const [flight] = tripItemEstimates(
      trip({ transport: [leg({ cost: 890, costUnit: 'person', persons: ['Stefan'] })] }),
      LABELS
    );
    expect(flight.amount).toBe(890);
    expect(flight.persons).toEqual(['Stefan']);
  });

  /**
   * The other half of it: a room is a room. Two people in a double do not
   * pay twice, they pay per night, so this one multiplies by the nights.
   */
  it('multiplies a per-night room by the nights of the stay, not by the people', () => {
    const [room] = tripItemEstimates(
      trip({
        nights: [
          night({
            accommodationTitle: 'Hotel 224',
            cost: 240,
            costUnit: 'night',
            checkIn: '2026-04-26',
            checkOut: '2026-04-29',
          }),
        ],
      }),
      LABELS
    );
    expect(room.amount).toBe(720);
    expect(room.cost.nights).toBe(3);
  });

  it('prices a stop per head, which is what an entry fee is', () => {
    const [museum] = tripItemEstimates(
      trip({ stops: [stop({ placeTitle: 'Zeitz MOCAA', cost: 12.5, costUnit: 'person' })] }),
      LABELS
    );
    expect(museum.amount).toBe(25);
    expect(museum.category).toBe('activity');
  });

  // Zero is a real estimate -- a leg somebody flies on miles is planned at
  // nothing, which is not the same fact as a leg nobody has priced.
  it('keeps a line estimated at zero', () => {
    const estimates = tripItemEstimates(
      trip({ transport: [leg({ origin: 'Zürich', cost: 0 })] }),
      LABELS
    );
    expect(estimates).toHaveLength(1);
    expect(estimates[0].amount).toBe(0);
  });

  it('leaves an unpriced line out entirely rather than counting it as free', () => {
    expect(tripItemEstimates(trip({ transport: [leg({ origin: 'Zürich' })] }), LABELS)).toEqual([]);
  });
});

describe('unmatchedEstimates', () => {
  const estimates = [
    estimate(),
    estimate({ label: 'Hotel 224', category: 'accommodation', reference: 'Hotel 224' }),
  ];

  it('drops the leg a booking with the same reference has taken over', () => {
    const left = unmatchedEstimates(estimates, [booking({ reference: 'lx288' })]);
    expect(left.map((estimate) => estimate.label)).toEqual(['Hotel 224']);
  });

  it('drops the night a booking at the same accommodation has taken over', () => {
    const left = unmatchedEstimates(estimates, [
      booking({ category: 'accommodation', placeTitle: 'Hotel 224' }),
    ]);
    expect(left.map((estimate) => estimate.label)).toEqual(['Zürich to Pretoria']);
  });

  it('keeps both when the bookings match neither', () => {
    expect(unmatchedEstimates(estimates, [booking({ reference: 'LX289' })])).toHaveLength(2);
  });

  /**
   * The stated hole: nothing identifies an estimate with no reference, so a
   * booking for it cannot be recognised and both figures stand. Kept rather
   * than guessed at -- dropping it on a category match would delete a real
   * second flight.
   */
  it('keeps an estimate that names nothing to match on', () => {
    const orphan = [estimate({ reference: null })];
    expect(unmatchedEstimates(orphan, [booking({ reference: 'LX288' })])).toHaveLength(1);
  });
});

describe('asEstimateBooking', () => {
  const line = estimate({ currency: 'CHF' });

  it('carries the figure onto the trip as an estimate', () => {
    const made = asEstimateBooking(line, 'Südafrika 2026');
    expect(made.tripTitle).toBe('Südafrika 2026');
    expect(made.status).toBe('estimate');
    expect(made.amount).toBe(890);
    expect(made.currency).toBe('CHF');
    expect(made.reference).toBe('LX288');
  });

  /**
   * An estimate is not money anybody spent, so it names no payer. It does
   * name who it is for, which a printed line needs and which a booking made
   * from it inherits. Keeping it out of the settlement is the CALLER's job,
   * since tripSettlement() charges a payer-less booking to the people it
   * names -- see the note on asEstimateBooking().
   */
  it('names nobody as payer, while keeping who it is for', () => {
    const made = asEstimateBooking(line, 'Südafrika 2026');
    expect(made.payerTitle).toBeNull();
    expect(made.forTitles).toEqual(TWO);
  });
});

describe('estimateLines', () => {
  it('titles each surviving estimate with its own label', () => {
    const lines = estimateLines(
      trip({
        transport: [
          leg({ origin: 'Zürich', destination: 'Pretoria', cost: 890, reference: 'LX288' }),
        ],
        nights: [night({ accommodationTitle: 'Hotel 224', cost: 240 })],
      }),
      [booking({ reference: 'LX288' })],
      'Südafrika 2026',
      LABELS
    );

    expect(lines.map((line) => line.title)).toEqual(['Hotel 224']);
    expect(lines[0].status).toBe('estimate');
    expect(lines[0].category).toBe('accommodation');
  });
});
