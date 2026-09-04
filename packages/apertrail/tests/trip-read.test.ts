/**
 * The vault-reading half of the Trip schema -- how parseTripRecord()'s
 * output gets resolved against the Cities and places the board already
 * built. trip-note.test.ts covers the pure build/parse round trip; this
 * covers the cross-reference pass and the folder/type gating around it.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
}));

import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { readTravelBoard } from '../src/vault/read-entities';
import { makeFakeVault } from './fake-vault';

const settings = DEFAULT_SETTINGS;
const P = 'Places';
const TR = 'Trips';
const TODAY = '2026-08-06';

/** A vault holding the geographic scaffolding every test below resolves stops against. */
function vaultWithTrip(tripFrontmatter: Record<string, unknown>) {
  return makeFakeVault([
    { path: `${P}/Countries/Switzerland.md`, frontmatter: { type: 'country' } },
    {
      path: `${P}/Cities/Maienfeld.md`,
      frontmatter: {
        type: 'city',
        country: '[[Switzerland]]',
        visited: true,
        lastVisit: '2026-02-13',
      },
    },
    { path: `${P}/Cities/Basel.md`, frontmatter: { type: 'city', country: '[[Switzerland]]' } },
    {
      path: `${P}/Food & Beverages/Restaurant Falknis.md`,
      frontmatter: {
        type: 'fnb',
        country: '[[Switzerland]]',
        city: '[[Maienfeld]]',
        fnbType: 'restaurant',
      },
    },
    {
      path: `${P}/Accommodation/Hotel Falknis.md`,
      frontmatter: { type: 'accommodation', country: '[[Switzerland]]' },
    },
    { path: `${TR}/Testtrip.md`, frontmatter: { type: 'trip', ...tripFrontmatter } },
  ]);
}

function tripFrom(frontmatter: Record<string, unknown>) {
  const { app } = vaultWithTrip(frontmatter);
  return readTravelBoard(app, settings, TODAY).trips[0];
}

describe('reading a Trip', () => {
  it('resolves persons, cities and every stop target', () => {
    const trip = tripFrom({
      country: '[[Switzerland]]',
      cities: ['[[Maienfeld]]', '[[Basel]]'],
      departure: '2026-02-13T09:00',
      return: '2026-02-13T14:00',
      travelStatus: 'Over',
      persons: ['[[Erika Muster]]', '[[Stefan Muster]]'],
      stops: [
        { place: '[[Maienfeld]]', from: '2026-02-13T11:45' },
        {
          place: '[[Restaurant Falknis]]',
          from: '2026-02-13T12:00',
          to: '2026-02-13T13:30',
          note: 'Angus beef fillet',
          rating: 5,
        },
      ],
    });

    expect(trip.country?.title).toBe('Switzerland');
    expect(trip.cities.map((c) => c.title)).toEqual(['Maienfeld', 'Basel']);
    // Person notes live in the Life module's own resource folders, so the
    // Travel reader keeps the titles without resolving them to files.
    expect(trip.personTitles).toEqual(['Erika Muster', 'Stefan Muster']);

    expect(trip.stops).toHaveLength(2);
    expect(trip.stops[0].targetKind).toBe('city');
    expect(trip.stops[0].target?.title).toBe('Maienfeld');
    expect(trip.stops[1].targetKind).toBe('fnb');
    expect(trip.stops[1].target?.title).toBe('Restaurant Falknis');
    expect(trip.stops[1].note).toBe('Angus beef fillet');
    expect(trip.stops[1].rating).toBe(5);
  });

  it('preserves stop order rather than re-sorting by time', () => {
    const trip = tripFrom({
      stops: [
        { place: '[[Restaurant Falknis]]', from: '2026-02-13T12:00' },
        { place: '[[Basel]]' },
        { place: '[[Maienfeld]]', from: '2026-02-13T09:30' },
      ],
    });
    expect(trip.stops.map((s) => s.placeTitle)).toEqual([
      'Restaurant Falknis',
      'Basel',
      'Maienfeld',
    ]);
  });

  it('leaves an unresolvable stop target null but keeps the row', () => {
    const trip = tripFrom({
      stops: [{ place: '[[Restaurant Nirgendwo]]', from: '2026-02-13T12:00' }],
    });
    expect(trip.stops).toHaveLength(1);
    expect(trip.stops[0].placeTitle).toBe('Restaurant Nirgendwo');
    expect(trip.stops[0].target).toBeNull();
    expect(trip.stops[0].targetKind).toBeNull();
  });

  it('resolves an accommodation night against the places index', () => {
    const trip = tripFrom({
      nights: [
        { accommodation: '[[Hotel Falknis]]', checkIn: '2026-02-13', checkOut: '2026-02-15' },
      ],
    });
    expect(trip.nights[0].accommodation?.kind).toBe('accommodation');
    expect(trip.nights[0].checkIn).toBe('2026-02-13');
  });

  it('keeps the time on departure and on every stop', () => {
    const trip = tripFrom({
      departure: '2026-02-13T09:00',
      stops: [{ place: '[[Basel]]', from: '2026-02-13T12:00', to: '2026-02-13T13:30' }],
    });
    expect(trip.departure).toBe('2026-02-13T09:00');
    expect(trip.stops[0].from).toBe('2026-02-13T12:00');
    expect(trip.stops[0].to).toBe('2026-02-13T13:30');
  });

  it('derives Over for a past trip that never had a status typed into it', () => {
    const trip = tripFrom({ departure: '2026-02-13T09:00', return: '2026-02-13T14:00' });
    expect(trip.travelStatus).toBeNull();
    expect(trip.effectiveStatus).toBe('Over');
  });

  it('derives Planned for a future trip with no status', () => {
    const trip = tripFrom({ departure: '2026-12-01', return: '2026-12-08' });
    expect(trip.effectiveStatus).toBe('Planned');
  });

  it('prefers a City over a same-titled place, the documented tie-break', () => {
    const { app } = makeFakeVault([
      { path: `${P}/Cities/Basel.md`, frontmatter: { type: 'city' } },
      { path: `${P}/Locations/Basel.md`, frontmatter: { type: 'location' } },
      {
        path: `${TR}/Testtrip.md`,
        frontmatter: { type: 'trip', stops: [{ place: '[[Basel]]' }] },
      },
    ]);
    const trip = readTravelBoard(app, settings, TODAY).trips[0];
    expect(trip.stops[0].targetKind).toBe('city');
  });

  it('reads a trip with no structure at all without inventing any', () => {
    const trip = tripFrom({});
    expect(trip.stops).toEqual([]);
    expect(trip.nights).toEqual([]);
    expect(trip.transport).toEqual([]);
    expect(trip.personTitles).toEqual([]);
    expect(trip.cities).toEqual([]);
  });
});
