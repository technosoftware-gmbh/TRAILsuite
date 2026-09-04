/**
 * Visit derivation end to end through the board reader -- the path that
 * actually decides what the dashboard's "countries visited" tile shows.
 * Modeled on the reference vault, where every note's own `visited:` is
 * false and every visit is evidence carried by a trip.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
}));

import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { readTravelBoard } from '../src/vault/read-entities';
import { computePlaceStats } from '../src/places/place-stats';
import { makeFakeVault, FakeNote } from './fake-vault';

const settings = DEFAULT_SETTINGS;
const P = 'Places';
const TR = 'Trips';
const TODAY = '2026-08-06';

/** The reference vault in miniature: nothing marked visited, one finished trip and one cancelled one. */
const NOTES: FakeNote[] = [
  { path: `${P}/Countries/Switzerland.md`, frontmatter: { type: 'country' } },
  { path: `${P}/Countries/Germany.md`, frontmatter: { type: 'country' } },
  {
    path: `${P}/Cities/Maienfeld.md`,
    frontmatter: { type: 'city', country: '[[Switzerland]]', visited: false },
  },
  {
    path: `${P}/Cities/Dreieich.md`,
    frontmatter: { type: 'city', country: '[[Germany]]', visited: false },
  },
  {
    path: `${P}/Food & Beverages/Restaurant Falknis.md`,
    frontmatter: { type: 'fnb', country: '[[Switzerland]]', city: '[[Maienfeld]]', visited: false },
  },
  {
    path: `${P}/Food & Beverages/La Perla.md`,
    frontmatter: { type: 'fnb', country: '[[Germany]]', visited: false },
  },
  {
    path: `${P}/Landmarks/Schloss Brandis.md`,
    frontmatter: { type: 'landmark', country: '[[Switzerland]]', visited: false },
  },
  {
    path: `${TR}/Landquart - Maienfeld.md`,
    frontmatter: {
      type: 'trip',
      country: '[[Switzerland]]',
      departure: '2026-02-13T09:00',
      return: '2026-02-13T14:00',
      travelStatus: 'Over',
      stops: [
        { place: '[[Maienfeld]]', from: '2026-02-13T11:45' },
        { place: '[[Restaurant Falknis]]', from: '2026-02-13T12:00' },
      ],
    },
  },
  {
    path: `${TR}/Besuch bei Regina.md`,
    frontmatter: {
      type: 'trip',
      country: '[[Germany]]',
      departure: '2026-04-26T07:00',
      travelStatus: 'Cancelled',
      stops: [{ place: '[[Dreieich]]' }, { place: '[[La Perla]]' }],
    },
  },
];

function board(extra: FakeNote[] = []) {
  const { app } = makeFakeVault([...NOTES, ...extra]);
  return readTravelBoard(app, settings, TODAY);
}

function place(b: ReturnType<typeof board>, title: string) {
  const found = b.places.find((p) => p.title === title);
  if (!found) throw new Error(`no place ${title}`);
  return found;
}

describe('visits derived through readTravelBoard', () => {
  it('marks a place visited from a finished trip, though its own note says false', () => {
    const falknis = place(board(), 'Restaurant Falknis');
    expect(falknis.visited).toBe(true);
    expect(falknis.lastVisit).toBe('2026-02-13');
    expect(falknis.visitedFromTrips).toBe(true);
  });

  it('marks the City the trip stopped in as visited too', () => {
    const maienfeld = board().cities.find((c) => c.title === 'Maienfeld');
    expect(maienfeld?.visited).toBe(true);
    expect(maienfeld?.lastVisit).toBe('2026-02-13');
  });

  it('leaves places from a cancelled trip unvisited', () => {
    const b = board();
    expect(place(b, 'La Perla').visited).toBe(false);
    expect(b.cities.find((c) => c.title === 'Dreieich')?.visited).toBe(false);
  });

  it('leaves a place no trip mentions unvisited', () => {
    expect(place(board(), 'Schloss Brandis').visited).toBe(false);
  });

  it('counts the country as visited, which is the number the dashboard shows', () => {
    const stats = computePlaceStats(board());
    // Before derivation this read 0 of 2 despite a finished trip through
    // Switzerland -- the exact symptom in the reference vault.
    expect(stats.countriesVisitedCount).toBe(1);
    expect(stats.countriesTotalCount).toBe(2);
  });

  it('counts landmarks visited separately from other place kinds', () => {
    const stats = computePlaceStats(
      board([
        {
          path: `${TR}/Burgentour.md`,
          frontmatter: {
            type: 'trip',
            travelStatus: 'Over',
            departure: '2026-03-01',
            stops: [{ place: '[[Schloss Brandis]]' }],
          },
        },
      ])
    );
    expect(stats.landmarksVisitedCount).toBe(1);
    expect(stats.landmarksTotalCount).toBe(1);
  });

  it('respects an explicit visited flag on a place no trip covers', () => {
    const b = board([
      {
        path: `${P}/Locations/Altes Museum.md`,
        frontmatter: { type: 'location', visited: true, lastVisit: '2011-08-01' },
      },
    ]);
    const museum = place(b, 'Altes Museum');
    expect(museum.visited).toBe(true);
    expect(museum.lastVisit).toBe('2011-08-01');
    expect(museum.visitedFromTrips).toBe(false);
  });

  it('derives a visit from a trip with no written status, using the date fallback', () => {
    const b = board([
      {
        path: `${P}/Locations/Bahnhof.md`,
        frontmatter: { type: 'location' },
      },
      {
        path: `${TR}/Alte Reise.md`,
        // No travelStatus at all -- effectiveTravelStatus() derives Over
        // from the past return date, and that feeds the visit.
        frontmatter: {
          type: 'trip',
          departure: '2026-01-05',
          return: '2026-01-05',
          stops: [{ place: '[[Bahnhof]]' }],
        },
      },
    ]);
    expect(place(b, 'Bahnhof').visited).toBe(true);
    expect(place(b, 'Bahnhof').lastVisit).toBe('2026-01-05');
  });
});
