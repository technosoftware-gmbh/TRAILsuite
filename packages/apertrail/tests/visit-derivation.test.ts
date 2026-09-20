/**
 * Deriving visited/lastVisit from finished trips and from the day notes that
 * name a place -- see vault/visit-derivation.ts. Pure, so this exercises the
 * derivation directly; trip-read-visits.test.ts covers it end to end through
 * the board reader.
 */
import { describe, expect, it } from 'vitest';
import { aStop, aTrip } from './fixtures';
import { buildVisitIndex, deriveVisit } from '../src/vault/visit-derivation';
import { TravelTripStop } from '../src/vault/types';

function stop(placeTitle: string, from: string | null = null): TravelTripStop {
  return aStop({ placeTitle, from });
}

const trip = aTrip;

describe('buildVisitIndex', () => {
  it('indexes stops from finished trips only', () => {
    const index = buildVisitIndex([
      trip('Done', { effectiveStatus: 'Over', stops: [stop('Falknis', '2026-02-13T12:00')] }),
      trip('Upcoming', { effectiveStatus: 'Planned', stops: [stop('Gifthüttli', '2027-01-01')] }),
      trip('Called off', { effectiveStatus: 'Cancelled', stops: [stop('La Perla', '2026-04-26')] }),
      trip('Reserved', { effectiveStatus: 'Booked', stops: [stop('Santa Lucia', '2026-09-01')] }),
    ]);
    expect([...index.keys()]).toEqual(['Falknis']);
  });

  it('falls back to the trip dates when a stop carries no time of its own', () => {
    const index = buildVisitIndex([
      trip('Day out', { return: '2026-02-13T14:00', stops: [stop('Outlet')] }),
    ]);
    expect(index.get('Outlet')).toEqual(['2026-02-13']);
  });

  it('prefers return over departure for an untimed stop', () => {
    const index = buildVisitIndex([
      trip('Long trip', {
        departure: '2026-04-26',
        return: '2026-04-28',
        stops: [stop('Hotel')],
      }),
    ]);
    expect(index.get('Hotel')).toEqual(['2026-04-28']);
  });

  it('still registers a visit when neither the stop nor the trip has any date', () => {
    const index = buildVisitIndex([trip('Undated', { stops: [stop('Somewhere')] })]);
    expect(index.get('Somewhere')).toEqual(['']);
  });

  it('skips a stop whose place link never resolved to a title', () => {
    const index = buildVisitIndex([trip('Typo', { stops: [{ ...stop('x'), placeTitle: null }] })]);
    expect(index.size).toBe(0);
  });
});

describe('deriveVisit', () => {
  const index = new Map<string, string[]>([
    ['Falknis', ['2026-02-13']],
    ['Basel', ['2025-06-01', '2026-02-26']],
    ['Undated', ['']],
  ]);

  it('marks a place visited because a finished trip stopped there', () => {
    expect(deriveVisit('Falknis', false, null, index)).toEqual({
      visited: true,
      lastVisit: '2026-02-13',
      fromTrips: true,
    });
  });

  it('takes the most recent of several trips', () => {
    expect(deriveVisit('Basel', false, null, index).lastVisit).toBe('2026-02-26');
  });

  it('keeps an explicit visited flag for a place no trip covers', () => {
    // The case that matters most: somewhere visited long before the vault
    // started tracking trips has no trip to derive from, and that history
    // must survive.
    expect(deriveVisit('Ancient history', true, '2011-08-01', index)).toEqual({
      visited: true,
      lastVisit: '2011-08-01',
      fromTrips: false,
    });
  });

  it('folds an explicit lastVisit in alongside trip dates rather than replacing them', () => {
    expect(deriveVisit('Basel', true, '2024-01-01', index).lastVisit).toBe('2026-02-26');
  });

  it('keeps a hand-written date that is newer than any trip', () => {
    expect(deriveVisit('Falknis', false, '2026-07-04', index).lastVisit).toBe('2026-07-04');
  });

  it('counts an undated trip visit as visited, with no date', () => {
    expect(deriveVisit('Undated', false, null, index)).toEqual({
      visited: true,
      lastVisit: null,
      fromTrips: true,
    });
  });

  it('leaves a place with no evidence at all unvisited', () => {
    expect(deriveVisit('Nowhere', false, null, index)).toEqual({
      visited: false,
      lastVisit: null,
      fromTrips: false,
    });
  });
});

describe('a day note as evidence', () => {
  const noTrips = new Map<string, string[]>();

  it('counts on its own, which is the whole reason it exists', () => {
    // A restaurant on an ordinary Tuesday is not a trip and never will be, so
    // without this the Prospekt said "nicht besucht" about a place somebody
    // had eaten at the day before.
    const derived = deriveVisit('Landgasthof Keppel', false, null, noTrips, ['2026-09-20']);
    expect(derived.visited).toBe(true);
    expect(derived.lastVisit).toBe('2026-09-20');
  });

  it('does not claim a trip contributed it', () => {
    // `visitedFromTrips` is what lets a card explain a flag the note does not
    // carry, and a day note is not a trip. It always brings a date, so the card
    // shows the date rather than needing the explanation.
    expect(deriveVisit('Landgasthof Keppel', false, null, noTrips, ['2026-09-20']).fromTrips).toBe(
      false
    );
  });

  it('is folded in beside the trips rather than replacing them', () => {
    const index = buildVisitIndex([
      trip('Done', { effectiveStatus: 'Over', stops: [stop('Falknis', '2026-02-13T12:00')] }),
    ]);
    const derived = deriveVisit('Falknis', false, null, index, ['2026-08-01']);
    expect(derived.fromTrips).toBe(true);
    // The most recent across every source, which is the rule the explicit
    // lastVisit already follows.
    expect(derived.lastVisit).toBe('2026-08-01');
  });

  it('leaves an older day note behind a newer trip', () => {
    const index = buildVisitIndex([
      trip('Done', { effectiveStatus: 'Over', stops: [stop('Falknis', '2026-02-13T12:00')] }),
    ]);
    expect(deriveVisit('Falknis', false, null, index, ['2025-01-01']).lastVisit).toBe('2026-02-13');
  });

  it('changes nothing for a place no day note names', () => {
    expect(deriveVisit('Unbesucht', false, null, noTrips, []).visited).toBe(false);
    expect(deriveVisit('Unbesucht', false, null, noTrips, []).lastVisit).toBeNull();
  });
});
