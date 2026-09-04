/**
 * The gallery grid's default order.
 *
 * It exists because this order is the two retired dashboards' section strips
 * put end to end, and nothing else now checks that the strips' orderings are
 * still reached. The per-type comparators have their own suite next door
 * (travel-entity-sort.test.ts); what is asserted here is the assembly: which
 * type comes before which, that a place kind is ordered against its own kind
 * rather than against every place at once, and what happens to a row the map
 * has never heard of.
 */
import { describe, expect, it } from 'vitest';
import type { TFile } from 'obsidian';
import { aTrip } from './fixtures';
import { compareByRank, defaultGalleryRanks } from '../src/ui/gallery/gallery-order';
import { CrmBoard, CrmCompany, CrmPerson } from '../src/crm/types';
import { TravelBoard, TravelCity, TravelCountry, TravelPlace } from '../src/vault/types';

function fakeFile(basename: string): TFile {
  return { path: `${basename}.md`, basename } as TFile;
}

function country(title: string): TravelCountry {
  return {
    file: fakeFile(title),
    title,
    capitalTitle: null,
    capital: null,
    stateTitles: [],
    states: [],
  };
}

function city(title: string, lastVisit: string | null = null): TravelCity {
  return {
    file: fakeFile(title),
    title,
    countryTitle: null,
    country: null,
    stateTitle: null,
    state: null,
    geoLocation: null,
    visited: lastVisit !== null,
    lastVisit,
    visitedFromTrips: false,
    tags: [],
  };
}

function place(title: string, overrides: Partial<TravelPlace> = {}): TravelPlace {
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

function person(title: string): CrmPerson {
  return {
    file: fakeFile(title),
    title,
    description: null,
    tags: [],
    address: null,
    email: null,
    mobile: null,
  };
}

function company(title: string): CrmCompany {
  return {
    file: fakeFile(title),
    title,
    description: null,
    tags: [],
    address: null,
    website: null,
    email: null,
    phone: null,
  };
}

function board(overrides: Partial<TravelBoard> = {}): TravelBoard {
  return {
    trips: [],
    bookings: [],
    countries: [],
    states: [],
    cities: [],
    places: [],
    ...overrides,
  };
}

function crm(overrides: Partial<CrmBoard> = {}): CrmBoard {
  return { persons: [], companies: [], ...overrides };
}

/** The titles a grid holding every one of these rows would show, in order. */
function ordered(rows: { file: TFile; title: string }[], travel: TravelBoard, people: CrmBoard) {
  const ranks = defaultGalleryRanks(travel, people);
  return [...rows].sort((a, b) => compareByRank(ranks, a, b)).map((row) => row.title);
}

describe('defaultGalleryRanks', () => {
  it('puts the types in the order their chips read', () => {
    const trip = aTrip('ATrip', { effectiveStatus: 'Planned', departure: '2026-09-01' });
    const land = country('ZCountry');
    const town = city('MCity');
    const hotel = place('AHotel', { kind: 'accommodation' });
    const who = person('APerson');
    const firm = company('ACompany');
    const travel = board({
      trips: [trip],
      countries: [land],
      cities: [town],
      places: [hotel],
    });
    const people = crm({ persons: [who], companies: [firm] });

    // Deliberately handed to the sort in reverse, so a pass cannot come from
    // the input already being right.
    expect(ordered([firm, who, hotel, town, land, trip], travel, people)).toEqual([
      'ATrip',
      'ZCountry',
      'MCity',
      'AHotel',
      'APerson',
      'ACompany',
    ]);
  });

  it('orders a place against its own kind, not against every place at once', () => {
    // The five kinds share one comparator and one `places` array, so a rank
    // built over the array as a whole would interleave a five-star landmark
    // with the unrated hotels. The chips do not, and neither should this.
    const travel = board({
      places: [
        place('CheapHotel', { kind: 'accommodation', rating: 1 }),
        place('GreatLandmark', { kind: 'landmark', rating: 5 }),
        place('GrandHotel', { kind: 'accommodation', rating: 5 }),
      ],
    });
    expect(ordered(travel.places, travel, crm())).toEqual([
      'GrandHotel',
      'CheapHotel',
      'GreatLandmark',
    ]);
  });

  it('keeps each type in the ordering that type earned', () => {
    // Cities by most-recent visit rather than by name, which is the one
    // place the assembly could silently fall back to alphabetical.
    const travel = board({ cities: [city('Arles'), city('Zurich', '2026-05-01')] });
    expect(ordered(travel.cities, travel, crm())).toEqual(['Zurich', 'Arles']);
  });

  it('sorts a row the map has never heard of by title, after the ones it has', () => {
    const travel = board({ cities: [city('Zurich')] });
    const stranger = { file: fakeFile('Somewhere'), title: 'Somewhere' };
    expect(ordered([stranger, ...travel.cities], travel, crm())).toEqual(['Zurich', 'Somewhere']);
  });

  it('falls back to the title when the map knows neither row', () => {
    const a = { file: fakeFile('Beta'), title: 'Beta' };
    const b = { file: fakeFile('Alpha'), title: 'Alpha' };
    expect(ordered([a, b], board(), crm())).toEqual(['Alpha', 'Beta']);
  });
});
