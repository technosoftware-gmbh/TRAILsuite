/**
 * What a trip is planned to cost.
 *
 * The figure a brochure states: a stated ceiling where the budget names one,
 * and the itinerary's own estimates for everything it does not.
 *
 * **This suite exists because the logic was somewhere nothing could test it.**
 * It lived inside the trip document's App-bound half, and asked whether a
 * category was already in the map it was itself filling -- so the first
 * transport estimate landed, made `transport` present, and every later one was
 * dropped on the next line. The outbound flight showed its price and the
 * return did not, on a real trip, and two priced hotels would have gone the
 * same way. The accumulator underneath was correct code standing where it
 * could never run.
 */
import { describe, expect, it } from 'vitest';
import { PlannedLine, plannedByCategory, plannedTotal } from '../src/trips/costs/planned-total';
import { tripItemEstimates } from '../src/trips/costs/estimates';
import { TripPropertyNames, parseTripRecord } from '../src/trips/trip-note';
import { tripPropertyNames } from '../src/vault/read-entities';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const CHF = 'CHF';

/** Derived, so a new day or leg setting cannot sit here as `undefined`. */
const PROPS: TripPropertyNames = tripPropertyNames(DEFAULT_SETTINGS);

/** The three words the estimate labels supply. English, because no label is asserted here. */
const LABELS = { joiner: 'to', legFallback: 'Leg', nightFallback: 'Stay', stopFallback: 'Stop' };

describe('the plan, by category', () => {
  /** The defect, stated: two legs, and both of them count. */
  it('adds every estimate in a category, not just the first', () => {
    const lines = plannedByCategory(
      [],
      [
        { category: 'transport', amount: 1049, currency: CHF },
        { category: 'transport', amount: 1100, currency: CHF },
      ],
      CHF
    );

    expect(lines).toEqual([{ category: 'transport', amount: 2149 }]);
  });

  it('adds a third and a fourth just the same', () => {
    const lines = plannedByCategory(
      [],
      [1, 2, 3, 4].map((n) => ({ category: 'accommodation', amount: n * 100, currency: CHF })),
      CHF
    );

    expect(lines[0]?.amount).toBe(1000);
  });

  it('keeps categories apart', () => {
    const lines = plannedByCategory(
      [],
      [
        { category: 'transport', amount: 1049, currency: CHF },
        { category: 'accommodation', amount: 240, currency: CHF },
      ],
      CHF
    );

    expect(lines).toEqual([
      { category: 'transport', amount: 1049 },
      { category: 'accommodation', amount: 240 },
    ]);
  });

  /**
   * A stated ceiling is a decision about the whole category. Adding the
   * estimates to it would report a trip costing more than the person planning
   * it thinks it does.
   */
  it('lets a budget line win over the estimates in its category', () => {
    const lines = plannedByCategory(
      [{ category: 'transport', amount: 5000 }],
      [
        { category: 'transport', amount: 1049, currency: CHF },
        { category: 'transport', amount: 1100, currency: CHF },
      ],
      CHF
    );

    expect(lines).toEqual([{ category: 'transport', amount: 5000 }]);
  });

  it('still fills a category the budget does not name', () => {
    const lines = plannedByCategory(
      [{ category: 'transport', amount: 5000 }],
      [{ category: 'food', amount: 300, currency: CHF }],
      CHF
    );

    expect(lines).toEqual([
      { category: 'transport', amount: 5000 },
      { category: 'food', amount: 300 },
    ]);
  });

  it('puts the decided figures above the derived ones', () => {
    const lines = plannedByCategory(
      [{ category: 'accommodation', amount: 900 }],
      [{ category: 'transport', amount: 1049, currency: CHF }],
      CHF
    );

    expect(lines.map((line) => line.category)).toEqual(['accommodation', 'transport']);
  });

  it('drops a budget line that states no amount', () => {
    expect(plannedByCategory([{ category: 'fees', amount: null }], [], CHF)).toEqual([]);
  });

  /** Converting here would be arithmetic the reader cannot check. The cost sheet shows its working; this does not. */
  it('skips an estimate in another currency rather than converting it', () => {
    const lines = plannedByCategory(
      [],
      [
        { category: 'transport', amount: 1049, currency: CHF },
        { category: 'transport', amount: 500, currency: 'EUR' },
      ],
      CHF
    );

    expect(lines).toEqual([{ category: 'transport', amount: 1049 }]);
  });

  it('takes an estimate that names no currency as the trip’s own', () => {
    expect(plannedByCategory([], [{ category: 'fees', amount: 40, currency: null }], CHF)).toEqual([
      { category: 'fees', amount: 40 },
    ]);
  });
});

describe('what the plan comes to', () => {
  it('sums the lines', () => {
    expect(
      plannedTotal([
        { category: 'transport', amount: 2149 },
        { category: 'accommodation', amount: 240 },
      ])
    ).toBe(2389);
  });

  /** Nothing planned is not the same as nothing spent, and a document says nothing rather than zero. */
  it('is null when nothing is planned at all', () => {
    expect(plannedTotal([])).toBeNull();
  });
});

/**
 * The trip the defect was found on, through the whole chain rather than the
 * one function.
 *
 * `plannedByCategory` above is tested on figures handed to it; this reads the
 * frontmatter a real note carries, parses it, prices it and adds it up, so a
 * regression anywhere between the note and the total shows here. The numbers
 * are the Rovos Rail trip's own: two flights at 1049 and 1100 a person for
 * two people, and two single nights at 450 and 300 for the room.
 */
describe('the trip that found it', () => {
  const frontmatter = {
    type: 'trip',
    persons: ['[[Erika Muster]]', '[[Stefan Muster]]'],
    nights: [
      {
        accommodation: '[[AFRICAN ROCK HOTEL]]',
        checkInDay: 1,
        checkOutDay: 2,
        cost: 450,
        costUnit: 'night',
        currency: 'CHF',
      },
      {
        accommodation: '[[HOTEL HEINITZBURG]]',
        checkInDay: 10,
        checkOutDay: 11,
        cost: 300,
        costUnit: 'night',
        currency: 'CHF',
      },
    ],
    transport: [
      {
        direction: 'outbound',
        mode: 'plane',
        day: 0,
        toDay: 1,
        origin: 'Zürich',
        destination: 'Johannesburg, Südafrika',
        cost: 1049,
        costUnit: 'person',
        currency: 'CHF',
      },
      {
        direction: 'inbound',
        mode: 'plane',
        day: 11,
        toDay: 12,
        origin: 'Windhoek, Namibia',
        destination: 'Zürich, Schweiz',
        cost: 1100,
        costUnit: 'person',
        currency: 'CHF',
      },
    ],
  };

  const planned = (): PlannedLine[] => {
    const trip = parseTripRecord({ properties: PROPS, frontmatter });
    return plannedByCategory(trip.budget, tripItemEstimates(trip, LABELS), CHF);
  };

  it('prices the flight back as well as the flight out', () => {
    const transport = planned().find((line) => line.category === 'transport');
    expect(transport?.amount).toBe((1049 + 1100) * 2);
  });

  it('prices both hotels', () => {
    const accommodation = planned().find((line) => line.category === 'accommodation');
    expect(accommodation?.amount).toBe(450 + 300);
  });

  it('comes to the whole plan', () => {
    expect(plannedTotal(planned())).toBe((1049 + 1100) * 2 + 450 + 300);
  });
});
