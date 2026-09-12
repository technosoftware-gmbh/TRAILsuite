/**
 * A trip that follows another trip, end to end.
 *
 * This is the feature that ends the reader's oldest simplifying sentence --
 * "nothing points back UP at a Trip, so this is still one pass" -- so the
 * tests here are mostly about the guards that replaced it rather than about
 * the happy path. A cycle written by hand into frontmatter is not a
 * hypothetical: the link is a plain wikilink and somebody will eventually
 * point two trips at each other.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
}));

import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { readTravelBoard, tripPropertyNames } from '../src/vault/read-entities';
import { makeFakeVault } from './fake-vault';
import { duplicateTripInput } from '../src/trips/duplicate-trip';
import { buildTripFrontmatter, parseTripRecord } from '../src/trips/trip-note';
import { aStopInput } from './fixtures';

const settings = DEFAULT_SETTINGS;
const P = tripPropertyNames(settings);

interface TripSpec {
  title: string;
  departure?: string;
  extends?: string;
}

function vault(trips: TripSpec[]) {
  return makeFakeVault(
    trips.map((trip) => ({
      path: `${settings.tripsFolder}/${trip.title}.md`,
      frontmatter: {
        type: 'trip',
        ...(trip.departure ? { departure: trip.departure } : {}),
        ...(trip.extends ? { extends: `[[${trip.extends}]]` } : {}),
      },
    }))
  );
}

function board(trips: TripSpec[]) {
  return readTravelBoard(vault(trips).app, settings, '2026-09-07');
}

function byTitle(trips: TripSpec[], title: string) {
  return board(trips).trips.find((trip) => trip.title === title);
}

describe('a trip that extends another', () => {
  it('links up in both directions from a link written on the child alone', () => {
    const trips = [
      { title: 'Nordkap', departure: '2027-12-17' },
      { title: 'Kopenhagen', departure: '2027-12-31', extends: 'Nordkap' },
    ];

    // The voyage note says nothing about the extension. That is the whole
    // point of the direction: adding three days in December does not reopen a
    // note finished in September.
    expect(byTitle(trips, 'Nordkap')?.extendsTitle).toBeNull();
    expect(byTitle(trips, 'Nordkap')?.extensions.map((t) => t.title)).toEqual(['Kopenhagen']);
    expect(byTitle(trips, 'Kopenhagen')?.extendsTrip?.title).toBe('Nordkap');
  });

  it('orders several extensions by when they run', () => {
    // Named so that date order and title order disagree. With "Kopenhagen"
    // and "Skagen" the two agreed, and the assertion held just as well
    // against a sort by title -- a test that cannot fail, which is the shape
    // this package keeps finding in its own suite.
    const trips = [
      { title: 'Nordkap', departure: '2027-12-17' },
      { title: 'Aalborg', departure: '2028-01-04', extends: 'Nordkap' },
      { title: 'Kopenhagen', departure: '2027-12-31', extends: 'Nordkap' },
    ];

    // Earliest first: an extension is read as what happens next, and the board
    // hands them over in the order they will be lived rather than by title.
    expect(byTitle(trips, 'Nordkap')?.extensions.map((t) => t.title)).toEqual([
      'Kopenhagen',
      'Aalborg',
    ]);
  });

  it('refuses a trip that names itself', () => {
    const trips = [{ title: 'Nordkap', departure: '2027-12-17', extends: 'Nordkap' }];
    const nordkap = byTitle(trips, 'Nordkap');

    // A cycle of length one, and the only place it can come from is somebody
    // editing frontmatter by hand -- which is exactly why the guard is at the
    // read and not in the form.
    expect(nordkap?.extendsTitle).toBe('Nordkap');
    expect(nordkap?.extendsTrip).toBeNull();
    expect(nordkap?.extensions).toEqual([]);
  });

  it('survives two trips pointing at each other', () => {
    const trips = [
      { title: 'A', departure: '2027-01-01', extends: 'B' },
      { title: 'B', departure: '2027-02-01', extends: 'A' },
    ];
    const result = board(trips);

    // Nothing walks a chain, so a cycle terminates by construction. Each side
    // simply holds the other, one level deep, and no reader loops.
    expect(result.trips.find((t) => t.title === 'A')?.extensions.map((t) => t.title)).toEqual([
      'B',
    ]);
    expect(result.trips.find((t) => t.title === 'B')?.extensions.map((t) => t.title)).toEqual([
      'A',
    ]);
  });

  it('fills one level and never a chain', () => {
    const trips = [
      { title: 'A', departure: '2027-01-01' },
      { title: 'B', departure: '2027-02-01', extends: 'A' },
      { title: 'C', departure: '2027-03-01', extends: 'B' },
    ];

    // C belongs on B's sheet and nowhere else. Following the chain here would
    // print, on A's document, a trip somebody has not opened.
    expect(byTitle(trips, 'A')?.extensions.map((t) => t.title)).toEqual(['B']);
    expect(byTitle(trips, 'B')?.extensions.map((t) => t.title)).toEqual(['C']);
  });

  it('keeps a name the vault has no trip for, and resolves it to nothing', () => {
    const trips = [{ title: 'Kopenhagen', departure: '2027-12-31', extends: 'Nordkap' }];
    const kopenhagen = byTitle(trips, 'Kopenhagen');

    expect(kopenhagen?.extendsTitle).toBe('Nordkap');
    expect(kopenhagen?.extendsTrip).toBeNull();
  });
});

describe('the note a trip writes', () => {
  it('round-trips the link as a wikilink', () => {
    const yaml = buildTripFrontmatter({
      properties: P,
      typeValue: 'trip',
      subtitle: null,
      image: null,
      highlights: [],
      gallery: [],
      countryTitle: null,
      cityTitles: [],
      departure: null,
      return: null,
      travelType: null,
      travelStatus: null,
      reviewStatus: null,
      rating: null,
      created: null,
      modified: null,
      personTitles: [],
      extendsTitle: 'Nordkap',
      days: [],
      stops: [],
      nights: [],
      transport: [],
      currency: null,
      budget: [],
      rates: [],
    });

    expect(yaml[P.extendsProperty]).toBe('[[Nordkap]]');
    expect(parseTripRecord({ properties: P, frontmatter: yaml }).extendsTitle).toBe('Nordkap');
  });

  it('writes the stop’s excursion as a wikilink and reads it back down to a title', () => {
    const yaml = buildTripFrontmatter({
      properties: P,
      typeValue: 'trip',
      subtitle: null,
      image: null,
      highlights: [],
      gallery: [],
      countryTitle: null,
      cityTitles: [],
      departure: null,
      return: null,
      travelType: null,
      travelStatus: null,
      reviewStatus: null,
      rating: null,
      created: null,
      modified: null,
      personTitles: [],
      extendsTitle: null,
      days: [],
      stops: [aStopInput({ day: 3, excursionTitle: 'In the footsteps of the Vikings' })],
      nights: [],
      transport: [],
      currency: null,
      budget: [],
      rates: [],
    });

    const stops = yaml[P.stopsProperty] as Record<string, unknown>[];
    // The line survives the writer's own filter with no place and no prose on
    // it, because the excursion is the one thing it says.
    expect(stops).toHaveLength(1);
    expect(stops[0][P.stopExcursionField]).toBe('[[In the footsteps of the Vikings]]');
    expect(parseTripRecord({ properties: P, frontmatter: yaml }).stops[0].excursionTitle).toBe(
      'In the footsteps of the Vikings'
    );
  });
});

describe('duplicating a trip', () => {
  it('clears what it follows on from, with the dates and the status', () => {
    const original = duplicateTripInput(
      {
        subtitle: null,
        image: null,
        highlights: [],
        gallery: [],
        countryTitle: null,
        cityTitles: [],
        departure: '2027-12-31',
        return: '2028-01-03',
        travelType: null,
        travelStatus: 'Booked',
        reviewStatus: null,
        rating: null,
        personTitles: [],
        extendsTitle: 'Nordkap',
        days: [],
        stops: [],
        nights: [],
        transport: [],
        currency: null,
        budget: [],
        rates: [],
      },
      { from: null, to: null }
    );

    // A copy happens nowhere yet, so it follows on from nothing yet. Keeping
    // the link would put a second extension under a parent nobody edited.
    expect(original.extendsTitle).toBeNull();
    expect(original.departure).toBeNull();
  });
});
