/**
 * Who pays for what, one person at a time.
 *
 * Asked for from a real trip: three people, two of them in one room and the
 * third in another, and an excursion only one of them takes. The trip note
 * already said all of that line by line and the trip document printed none of
 * it. What this suite pins down is the arithmetic the page is built from: a
 * shared line is divided between the people it names, a line naming nobody is
 * everybody's, an untaken extra is nobody's, and a share in another currency
 * is shown without being added up.
 */
import { describe, expect, it } from 'vitest';
import { aParsedNight, aParsedStop } from './fixtures';
import { EstimatedTrip, tripItemEstimates } from '../src/trips/costs/estimates';
import { namesSomebodyElse, perPersonShares } from '../src/trips/costs/per-person';

const LABELS = { joiner: 'to', legFallback: 'Leg', nightFallback: 'Night', stopFallback: 'Stop' };

function trip(over: Partial<EstimatedTrip> = {}): EstimatedTrip {
  return { stops: [], nights: [], transport: [], personTitles: [], ...over };
}

function shares(t: EstimatedTrip, currency = 'CHF') {
  return perPersonShares(tripItemEstimates(t, LABELS), t.personTitles, currency);
}

describe('each person’s share of a trip', () => {
  const party = ['Thomas', 'Anna', 'Sven'];
  const threeInTwoRooms = trip({
    personTitles: party,
    nights: [
      aParsedNight({
        accommodationTitle: 'Hotel Dreieich',
        checkInDay: 1,
        checkOutDay: 3,
        cost: 200,
        costUnit: 'night',
        persons: ['Thomas', 'Anna'],
      }),
      aParsedNight({
        accommodationTitle: 'Hotel Dreieich',
        checkInDay: 1,
        checkOutDay: 3,
        cost: 150,
        costUnit: 'night',
        persons: ['Sven'],
      }),
    ],
    stops: [
      aParsedStop({ placeTitle: 'Stavanger', cost: 119, costUnit: 'person', persons: ['Anna'] }),
      aParsedStop({ placeTitle: 'Bergen', cost: 30, costUnit: 'person' }),
    ],
  });

  it('divides a shared room between the people in it and gives a single room to its one guest', () => {
    const [thomas, anna, sven] = shares(threeInTwoRooms);
    expect(thomas.items.find((i) => i.category === 'accommodation')?.amount).toBe(200);
    expect(anna.items.find((i) => i.category === 'accommodation')?.sharedBy).toBe(2);
    expect(sven.items.find((i) => i.category === 'accommodation')?.amount).toBe(300);
  });

  it('charges an excursion to whoever takes it, and a line naming nobody to everybody', () => {
    const [thomas, anna, sven] = shares(threeInTwoRooms);
    expect(thomas.total).toBe(230);
    expect(anna.total).toBe(349);
    expect(sven.total).toBe(330);
  });

  it('keeps the participants’ order', () => {
    expect(shares(threeInTwoRooms).map((s) => s.person)).toEqual(party);
  });

  it('leaves an extra nobody has taken out, and counts one somebody has', () => {
    const offered = trip({
      personTitles: ['Thomas', 'Anna'],
      stops: [
        aParsedStop({ placeTitle: 'Tromsø', cost: 220, costUnit: 'person', optional: true }),
        aParsedStop({
          placeTitle: 'Stavanger',
          cost: 119,
          costUnit: 'person',
          optional: true,
          chosen: true,
          persons: ['Anna'],
        }),
      ],
    });
    const [thomas, anna] = shares(offered);
    expect(thomas.items).toEqual([]);
    expect(anna.total).toBe(119);
  });

  it('lists a share in another currency without adding it to the total', () => {
    const [thomas] = shares(
      trip({
        personTitles: ['Thomas', 'Anna'],
        stops: [
          aParsedStop({ placeTitle: 'Oslo', cost: 100, costUnit: 'total', currency: 'NOK' }),
          aParsedStop({ placeTitle: 'Bergen', cost: 20, costUnit: 'total' }),
        ],
      })
    );
    expect(thomas.items).toHaveLength(2);
    expect(thomas.total).toBe(10);
    expect(thomas.partial).toBe(true);
  });

  it('adds somebody a line names who is not among the participants, after them', () => {
    const result = shares(
      trip({
        personTitles: ['Thomas'],
        stops: [aParsedStop({ placeTitle: 'Bergen', cost: 20, persons: ['Thomas', 'Guest'] })],
      })
    );
    expect(result.map((s) => s.person)).toEqual(['Thomas', 'Guest']);
    expect(result[1].total).toBe(10);
  });

  it('matches names regardless of case, so one person is not counted twice', () => {
    const result = shares(
      trip({
        personTitles: ['Anna'],
        stops: [aParsedStop({ placeTitle: 'Bergen', cost: 20, persons: ['anna'] })],
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(20);
  });
});

describe('whether a line is for somebody other than the whole party', () => {
  it('is not for a line naming nobody, or exactly the participants in any order or case', () => {
    expect(namesSomebodyElse([], ['Thomas', 'Anna'])).toBe(false);
    expect(namesSomebodyElse(['anna', 'Thomas'], ['Thomas', 'Anna'])).toBe(false);
  });

  it('is for a subset, or for somebody not on the trip', () => {
    expect(namesSomebodyElse(['Anna'], ['Thomas', 'Anna'])).toBe(true);
    expect(namesSomebodyElse(['Thomas', 'Guest'], ['Thomas'])).toBe(true);
  });
});
