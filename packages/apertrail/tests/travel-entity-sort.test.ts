import { describe, expect, it } from 'vitest';
import { aTrip } from './fixtures';
import type { TFile } from 'obsidian';
import { countryVisitInfo } from '../src/places/country-visited';
import { computeTripStats } from '../src/trips/trip-stats';
import { computePlaceStats } from '../src/places/place-stats';
import { isTravelStatusValue } from '../src/trips/trip-note';
import {
  sortCities,
  sortCountries,
  sortPlaces,
  sortTrips,
} from '../src/ui/dashboard/travel-entity-sort';
import {
  TravelBoard,
  TravelCity,
  TravelCountry,
  TravelPlace,
  TravelTrip,
} from '../src/vault/types';

// Every derived-stats/sort function under test here is a pure function over
// plain TravelBoard data -- no vault reads, no Obsidian API calls -- so a
// minimal fake TFile (identity only, never actually opened) is enough,
// unlike read-entities.test.ts/create-entities.test.ts which need the real
// fake-vault.ts + 'obsidian' mock to exercise actual frontmatter/vault
// scanning.
function fakeFile(basename: string): TFile {
  return { path: `${basename}.md`, basename } as TFile;
}

function makeCountry(title: string, overrides: Partial<TravelCountry> = {}): TravelCountry {
  return {
    file: fakeFile(title),
    title,
    capitalTitle: null,
    capital: null,
    stateTitles: [],
    states: [],
    ...overrides,
  };
}

function makeCity(title: string, overrides: Partial<TravelCity> = {}): TravelCity {
  return {
    file: fakeFile(title),
    title,
    countryTitle: null,
    country: null,
    stateTitle: null,
    state: null,
    geoLocation: null,
    visited: false,
    lastVisit: null,
    visitedFromTrips: false,
    tags: [],
    ...overrides,
  };
}

function makePlace(title: string, overrides: Partial<TravelPlace> = {}): TravelPlace {
  return {
    file: fakeFile(title),
    kind: 'landmark',
    title,
    countryTitle: null,
    country: null,
    cityTitle: null,
    city: null,
    geoLocation: null,
    visited: false,
    lastVisit: null,
    visitedFromTrips: false,
    tags: [],
    address: null,
    website: null,
    rating: null,
    accommodationType: null,
    accommodationStatus: null,
    fnbType: null,
    photoSpot: null,
    ...overrides,
  };
}

/**
 * `effectiveStatus` defaults to whatever `travelStatus` the caller passed
 * (falling back to 'Planned'), so the existing cases here keep meaning
 * what they meant before the derived-status fallback existed. Cases that
 * specifically exercise a trip with NO written status pass
 * `effectiveStatus` explicitly -- which is exactly the distinction the
 * production reader draws, since it is the only thing that sets both.
 */
function makeTrip(title: string, overrides: Partial<TravelTrip> = {}): TravelTrip {
  return aTrip(title, {
    // A dashboard fixture defaults to Planned rather than the builder's Over,
    // and derives it from the status under test the way the reader does.
    effectiveStatus: isTravelStatusValue(overrides.travelStatus)
      ? overrides.travelStatus
      : 'Planned',
    ...overrides,
  });
}

function emptyBoard(overrides: Partial<TravelBoard> = {}): TravelBoard {
  return {
    trips: [],
    vehicles: [],
    bookings: [],
    countries: [],
    states: [],
    cities: [],
    places: [],
    ...overrides,
  };
}

describe('countryVisitInfo', () => {
  it('is unvisited with no lastVisit when nothing under the country is visited', () => {
    const austria = makeCountry('Austria');
    const board = emptyBoard({
      countries: [austria],
      cities: [makeCity('Vienna', { country: austria, visited: false })],
    });
    expect(countryVisitInfo(austria, board)).toEqual({ visited: false, lastVisit: null });
  });

  it('is visited via a visited City, using its lastVisit date', () => {
    const austria = makeCountry('Austria');
    const board = emptyBoard({
      countries: [austria],
      cities: [makeCity('Vienna', { country: austria, visited: true, lastVisit: '2024-05-01' })],
    });
    expect(countryVisitInfo(austria, board)).toEqual({ visited: true, lastVisit: '2024-05-01' });
  });

  it('is visited via a visited place even with no visited City', () => {
    const austria = makeCountry('Austria');
    const board = emptyBoard({
      countries: [austria],
      places: [
        makePlace('Stephansdom', { country: austria, visited: true, lastVisit: '2023-01-01' }),
      ],
    });
    expect(countryVisitInfo(austria, board)).toEqual({ visited: true, lastVisit: '2023-01-01' });
  });

  it('takes the latest date across multiple visited children', () => {
    const austria = makeCountry('Austria');
    const board = emptyBoard({
      countries: [austria],
      cities: [makeCity('Vienna', { country: austria, visited: true, lastVisit: '2023-01-01' })],
      places: [
        makePlace('Stephansdom', { country: austria, visited: true, lastVisit: '2024-06-15' }),
      ],
    });
    expect(countryVisitInfo(austria, board).lastVisit).toBe('2024-06-15');
  });

  it('is visited-but-undated when the visited child has no lastVisit', () => {
    const austria = makeCountry('Austria');
    const board = emptyBoard({
      countries: [austria],
      cities: [makeCity('Vienna', { country: austria, visited: true, lastVisit: null })],
    });
    expect(countryVisitInfo(austria, board)).toEqual({ visited: true, lastVisit: null });
  });
});

describe('computeTripStats', () => {
  it('counts trips by status, defaulting every known status to zero', () => {
    const board = emptyBoard({
      trips: [
        makeTrip('A', { travelStatus: 'Planned' }),
        makeTrip('B', { travelStatus: 'Planned' }),
        makeTrip('C', { travelStatus: 'Booked' }),
      ],
    });
    const stats = computeTripStats(board);
    expect(stats.tripCountsByStatus).toEqual({ Planned: 2, Booked: 1, Over: 0, Cancelled: 0 });
  });

  // An unrecognized status is now normalized away one layer earlier, in
  // parseTripRecord() (see trip-note.test.ts) -- it never reaches
  // effectiveStatus, which is typed as one of the four. This asserts the
  // counting side stays defensive anyway, since TravelTrip objects can be
  // hand-constructed by callers that skip the reader.
  it('ignores an effectiveStatus outside the fixed enum rather than producing NaN', () => {
    const rogue = makeTrip('A');
    (rogue as { effectiveStatus: string }).effectiveStatus = 'Somewhere In Between';
    const stats = computeTripStats(emptyBoard({ trips: [rogue] }));
    expect(stats.tripCountsByStatus).toEqual({ Planned: 0, Booked: 0, Over: 0, Cancelled: 0 });
  });

  it('finds the nearest future Planned/Booked trip, skipping Over/Cancelled and past departures', () => {
    const today = new Date();
    const future = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const board = emptyBoard({
      trips: [
        makeTrip('Past', { travelStatus: 'Planned', departure: future(-5) }),
        makeTrip('Far', { travelStatus: 'Planned', departure: future(30) }),
        // With a clock time, which is what a real departure carries and what
        // this tile used to be unable to read.
        makeTrip('Near', { travelStatus: 'Booked', departure: `${future(3)}T07:00` }),
        makeTrip('OverButSoon', { travelStatus: 'Over', departure: future(1) }),
      ],
    });
    const stats = computeTripStats(board);
    expect(stats.nextTrip?.trip.title).toBe('Near');
    expect(stats.nextTrip?.daysUntil).toBe(3);
  });

  // The tile answers "am I still inside the budget for the thing that has not
  // happened yet", so a trip nobody has budgeted or booked anything for gets
  // no tile rather than a zero.
  it('reports no budget for a next trip with no money on it', () => {
    const board = emptyBoard({
      trips: [makeTrip('Near', { travelStatus: 'Booked', departure: '2099-01-01T07:00' })],
    });
    expect(computeTripStats(board).nextTripBudget).toBeNull();
  });

  it('reports no next trip when nothing qualifies', () => {
    const board = emptyBoard({ trips: [makeTrip('NoDate', { travelStatus: 'Planned' })] });
    expect(computeTripStats(board).nextTrip).toBeNull();
  });
});

describe('computePlaceStats', () => {
  it('derives countriesVisitedCount from countryVisitInfo, not a Country field', () => {
    const visited = makeCountry('Austria');
    const unvisited = makeCountry('Germany');
    const board = emptyBoard({
      countries: [visited, unvisited],
      cities: [makeCity('Vienna', { country: visited, visited: true })],
    });
    const stats = computePlaceStats(board);
    expect(stats.countriesVisitedCount).toBe(1);
    expect(stats.countriesTotalCount).toBe(2);
  });

  it('counts landmarks visited vs. total, excluding other place kinds', () => {
    const board = emptyBoard({
      places: [
        makePlace('Stephansdom', { kind: 'landmark', visited: true }),
        makePlace('Belvedere', { kind: 'landmark', visited: false }),
        makePlace('Hotel Sacher', { kind: 'accommodation', visited: true }),
      ],
    });
    const stats = computePlaceStats(board);
    expect(stats.landmarksVisitedCount).toBe(1);
    expect(stats.landmarksTotalCount).toBe(2);
  });

  /**
   * Captured, not visited. The two come apart constantly -- you drive to
   * the Pavillon, it rains, you have visited it and captured nothing -- and
   * the tile exists to answer the second question.
   */
  it('counts a photo spot as captured only when every motif it names has been shot', () => {
    const spot = (title: string, captured: boolean[], visited = true): TravelPlace =>
      makePlace(title, {
        kind: 'photospot',
        visited,
        photoSpot: {
          timezone: null,
          openingHours: null,
          entryFee: null,
          accessibility: 'unknown',
          parking: null,
          transit: [],
          samples: [],
          motifs: captured.map((flag, i) => ({
            name: `Motiv ${i}`,
            role: 'secondary',
            geoLocation: null,
            direction: null,
            light: [],
            season: [],
            lens: null,
            gear: [],
            technique: null,
            note: null,
            captured: flag,
            capturedOn: null,
          })),
        },
      });

    const stats = computePlaceStats(
      emptyBoard({
        places: [
          spot('Fertig', [true, true]),
          spot('Halb', [true, false]),
          spot('Offen', [false]),
          // Visited but with no motifs written down yet: there is nothing
          // here to have captured, so it counts in the total and not in the
          // numerator.
          spot('Leer', []),
          makePlace('Stephansdom', { kind: 'landmark', visited: true }),
        ],
      })
    );
    expect(stats.photoSpotsCapturedCount).toBe(1);
    expect(stats.photoSpotsTotalCount).toBe(4);
  });
});

describe('sortTrips', () => {
  it('puts upcoming trips first (soonest first), then past ones (most recent first)', () => {
    const trips = [
      makeTrip('OlderPast', { travelStatus: 'Over', departure: '2024-01-01' }),
      makeTrip('Later', { travelStatus: 'Planned', departure: '2026-09-01' }),
      makeTrip('RecentPast', { travelStatus: 'Over', departure: '2025-06-01' }),
      makeTrip('Sooner', { travelStatus: 'Booked', departure: '2026-08-10' }),
    ];
    expect(sortTrips(trips).map((t) => t.title)).toEqual([
      'Sooner',
      'Later',
      'RecentPast',
      'OlderPast',
    ]);
  });

  it('keeps cancelled trips, in the second tier, rather than dropping them', () => {
    // They used to be dropped, back when this fed a strip capped at six
    // cards under a heading counting every trip in the vault. It now feeds
    // the gallery grid, which shows everything the filters leave and carries
    // a Travel-Status facet, so "without the cancelled ones" is a thing to
    // ask for rather than a thing a sort decides on your behalf.
    const trips = [
      makeTrip('Cancelled', { travelStatus: 'Cancelled', departure: '2026-08-05' }),
      makeTrip('Real', { travelStatus: 'Planned', departure: '2026-09-01' }),
      makeTrip('OlderCancelled', { travelStatus: 'Cancelled', departure: '2024-01-01' }),
    ];
    expect(sortTrips(trips).map((t) => t.title)).toEqual(['Real', 'Cancelled', 'OlderCancelled']);
  });

  it('sorts undated trips last in both tiers, not just the ascending one', () => {
    // A naive "reverse the comparator" for the past tier would promote an
    // undated trip to the front of it; "no departure yet" is not a date.
    const trips = [
      makeTrip('NoDatePast', { travelStatus: 'Over', departure: null }),
      makeTrip('DatedPast', { travelStatus: 'Over', departure: '2025-06-01' }),
      makeTrip('NoDateUpcoming', { travelStatus: 'Planned', departure: null }),
      makeTrip('DatedUpcoming', { travelStatus: 'Planned', departure: '2026-08-10' }),
    ];
    expect(sortTrips(trips).map((t) => t.title)).toEqual([
      'DatedUpcoming',
      'NoDateUpcoming',
      'DatedPast',
      'NoDatePast',
    ]);
  });

  it('places a trip whose status is only derived, never written', () => {
    // effectiveStatus is what the ordering reads, so a past trip with no
    // travelStatus of its own still lands in the second tier.
    const trips = [
      makeTrip('DerivedOver', {
        travelStatus: null,
        effectiveStatus: 'Over',
        departure: '2020-01-01',
      }),
      makeTrip('Upcoming', { travelStatus: 'Planned', departure: '2026-09-01' }),
    ];
    expect(sortTrips(trips).map((t) => t.title)).toEqual(['Upcoming', 'DerivedOver']);
  });
});

describe('sortCountries', () => {
  it('orders visited-with-date first (most recent first), then visited-undated, then unvisited', () => {
    const older = makeCountry('OlderVisit');
    const newer = makeCountry('NewerVisit');
    const undated = makeCountry('UndatedVisit');
    const never = makeCountry('Never');
    const board = emptyBoard({
      countries: [older, newer, undated, never],
      cities: [
        makeCity('C1', { country: older, visited: true, lastVisit: '2020-01-01' }),
        makeCity('C2', { country: newer, visited: true, lastVisit: '2024-01-01' }),
        makeCity('C3', { country: undated, visited: true, lastVisit: null }),
      ],
    });
    const sorted = sortCountries(board.countries, board);
    expect(sorted.map((c) => c.title)).toEqual([
      'NewerVisit',
      'OlderVisit',
      'UndatedVisit',
      'Never',
    ]);
  });
});

describe('sortPlaces', () => {
  it('sorts by rating descending, falling back to most-recently-visited when unrated', () => {
    const places = [
      makePlace('LowRated', { rating: 2 }),
      makePlace('HighRated', { rating: 5 }),
      makePlace('UnratedRecent', { rating: null, lastVisit: '2024-06-01' }),
      makePlace('UnratedOlder', { rating: null, lastVisit: '2020-01-01' }),
      makePlace('UnratedNever', { rating: null, lastVisit: null }),
    ];
    const sorted = sortPlaces(places);
    expect(sorted.map((p) => p.title)).toEqual([
      'HighRated',
      'LowRated',
      'UnratedRecent',
      'UnratedOlder',
      'UnratedNever',
    ]);
  });
});

describe('sortCities', () => {
  it('sorts purely by most-recently-visited, since City has no rating field', () => {
    const cities = [
      makeCity('Older', { lastVisit: '2020-01-01' }),
      makeCity('Newer', { lastVisit: '2024-01-01' }),
      makeCity('Never', { lastVisit: null }),
    ];
    const sorted = sortCities(cities);
    expect(sorted.map((c) => c.title)).toEqual(['Newer', 'Older', 'Never']);
  });
});
