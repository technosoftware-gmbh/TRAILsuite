/**
 * The join between a stop and the excursion it is, end to end.
 *
 * A fake vault read through the real `readTravelBoard`, which is the suite
 * that earned its keep when the vehicle went in: the two halves of a join are
 * each correct on their own and it is the join that breaks. What it asserts
 * is the rule the feature exists for -- the description is on the excursion,
 * the price is on the trip, and neither note carries the other's.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
}));

import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { readTravelBoard } from '../src/vault/read-entities';
import { makeFakeVault } from './fake-vault';
import { tripsWithExcursion } from '../src/trips/related-trips';

const settings = DEFAULT_SETTINGS;

function vault(stops: Record<string, unknown>[]) {
  return makeFakeVault([
    {
      path: `${settings.countriesFolder}/Norway.md`,
      frontmatter: { type: 'country' },
    },
    {
      path: `${settings.citiesFolder}/Stavanger.md`,
      frontmatter: { type: 'city', country: '[[Norway]]' },
    },
    {
      path: `${settings.excursionsFolder}/In the footsteps of the Vikings.md`,
      frontmatter: {
        type: 'excursion',
        description: 'Viking House, the Swords in the Rock, and the Domsteinene.',
        operator: '[[Hurtigruten]]',
        duration: 'About 4 hours',
        country: '[[Norway]]',
        city: '[[Stavanger]]',
      },
    },
    {
      path: `${settings.tripsFolder}/Nordkap 2027.md`,
      frontmatter: {
        type: 'trip',
        departure: '2027-12-17',
        return: '2027-12-31',
        currency: 'CHF',
        stops,
      },
    },
  ]);
}

const VIKINGS = {
  place: '[[Stavanger]]',
  day: 3,
  excursion: '[[In the footsteps of the Vikings]]',
  cost: 119,
  costUnit: 'person',
  currency: 'CHF',
  optional: true,
};

describe('a stop that is an excursion', () => {
  it('resolves the excursion beside the place rather than instead of it', () => {
    const board = readTravelBoard(vault([VIKINGS]).app, settings, '2026-09-07');
    const stop = board.trips[0].stops[0];

    // Both, at once. The day 3 line says which town the ship is in AND which
    // tour is being decided about, and a reader that made those one field
    // would have to throw one of them away.
    expect(stop.target?.title).toBe('Stavanger');
    expect(stop.targetKind).toBe('city');
    expect(stop.excursion?.title).toBe('In the footsteps of the Vikings');
  });

  it('takes the description from the excursion and the price from the trip', () => {
    const board = readTravelBoard(vault([VIKINGS]).app, settings, '2026-09-07');
    const stop = board.trips[0].stops[0];
    const excursion = board.excursions[0];

    expect(stop.excursion?.description).toBe(
      'Viking House, the Swords in the Rock, and the Domsteinene.'
    );
    expect(stop.cost).toBe(119);
    expect(stop.costUnit).toBe('person');
    // And neither note carries the other's half. An excursion has no price of
    // its own anywhere in its schema, which is the whole rule: the same tour
    // is sold at a different figure on every sailing that offers it.
    expect(Object.keys(excursion)).not.toContain('cost');
    expect(excursion.duration).toBe('About 4 hours');
  });

  it('resolves the excursion’s own city and country like a place’s', () => {
    const board = readTravelBoard(vault([VIKINGS]).app, settings, '2026-09-07');

    expect(board.excursions[0].city?.title).toBe('Stavanger');
    expect(board.excursions[0].country?.title).toBe('Norway');
  });

  it('keeps a tour the vault has no note for, as a name with nothing behind it', () => {
    const board = readTravelBoard(
      vault([{ ...VIKINGS, excursion: '[[King crab safari]]' }]).app,
      settings,
      '2026-09-07'
    );
    const stop = board.trips[0].stops[0];

    // The leg's ship reads this way too: a tour somebody typed the name of,
    // before there is a note for it, is still the tour they are taking. The
    // title survives and only the join is null.
    expect(stop.excursionTitle).toBe('King crab safari');
    expect(stop.excursion).toBeNull();
  });

  it('keeps a stop that names an excursion and no place at all', () => {
    const board = readTravelBoard(
      vault([{ day: 3, excursion: '[[In the footsteps of the Vikings]]' }]).app,
      settings,
      '2026-09-07'
    );
    const stop = board.trips[0].stops[0];

    // An outing that meets on board names nowhere. The writer's own filter
    // has to keep such a line, and the reader has to leave the place empty
    // rather than reporting an unresolved link.
    expect(stop.placeTitle).toBeNull();
    expect(stop.placeUnresolved).toBe(false);
    expect(stop.excursion?.title).toBe('In the footsteps of the Vikings');
  });

  it('does not make the excursion a candidate for the stop’s place', () => {
    // The two lookups are separate on purpose. A stop naming the tour in its
    // `place:` is a note that means something else, and it must not quietly
    // resolve to the excursion.
    const board = readTravelBoard(
      vault([{ place: '[[In the footsteps of the Vikings]]', day: 3 }]).app,
      settings,
      '2026-09-07'
    );
    const stop = board.trips[0].stops[0];

    expect(stop.target).toBeNull();
    expect(stop.targetKind).toBeNull();
  });
});

describe('which trips took an excursion', () => {
  it('finds them by the raw name and carries the stops', () => {
    const board = readTravelBoard(vault([VIKINGS]).app, settings, '2026-09-07');
    const visits = tripsWithExcursion(board, 'In the footsteps of the Vikings');

    expect(visits.map((visit) => visit.trip.title)).toEqual(['Nordkap 2027']);
    // Unlike a vehicle's, these carry their stops: on the tour's own note the
    // stops are the answer -- which day of which trip, and what it cost then.
    expect(visits[0].stops).toHaveLength(1);
    expect(visits[0].stops[0].cost).toBe(119);
  });

  it('finds none for a tour nothing names', () => {
    const board = readTravelBoard(vault([VIKINGS]).app, settings, '2026-09-07');

    expect(tripsWithExcursion(board, 'King crab safari')).toEqual([]);
  });
});
