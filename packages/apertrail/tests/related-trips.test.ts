/**
 * The two reverse lookups behind the related-trips block -- which trips
 * stopped at a given note, and which trips a given person came along on.
 * See trips/related-trips.ts.
 */
import { describe, expect, it } from 'vitest';
import { relatedTrips, tripsWithPerson } from '../src/trips/related-trips';
import { TravelBoard, TravelTrip, TravelTripStop } from '../src/vault/types';
import { aBoard, aStop, aTrip } from './fixtures';

function stop(
  placeTitle: string | null,
  from: string | null = null,
  note?: string
): TravelTripStop {
  return aStop({ placeTitle, from, note: note ?? null });
}

const trip = aTrip;

function board(trips: TravelTrip[]): TravelBoard {
  return aBoard({ trips });
}

describe('relatedTrips', () => {
  it('finds every trip that stopped at the given title', () => {
    const b = board([
      trip('A', { departure: '2026-02-13', stops: [stop('Falknis', '2026-02-13T12:00')] }),
      trip('B', { departure: '2026-03-01', stops: [stop('Gifthüttli')] }),
      trip('C', { departure: '2026-04-01', stops: [stop('Falknis', '2026-04-01T19:00')] }),
    ]);
    expect(relatedTrips(b, 'Falknis').map((v) => v.trip.title)).toEqual(['C', 'A']);
  });

  it('orders most recent first, regardless of status', () => {
    const b = board([
      trip('Past', { effectiveStatus: 'Over', departure: '2025-01-01', stops: [stop('X')] }),
      trip('Upcoming', { effectiveStatus: 'Booked', departure: '2027-01-01', stops: [stop('X')] }),
    ]);
    // A place note answers "when was I last here" and "when am I next
    // here" from one list -- splitting by status would hide the answer to
    // whichever question you weren't asking.
    expect(relatedTrips(b, 'X').map((v) => v.trip.title)).toEqual(['Upcoming', 'Past']);
  });

  it('sorts undated trips last', () => {
    const b = board([
      trip('Undated', { stops: [stop('X')] }),
      trip('Dated', { departure: '2020-01-01', stops: [stop('X')] }),
    ]);
    expect(relatedTrips(b, 'X').map((v) => v.trip.title)).toEqual(['Dated', 'Undated']);
  });

  it('keeps both stops when one trip visits the same place twice', () => {
    const b = board([
      trip('Two visits', {
        departure: '2026-02-13',
        stops: [
          stop('Cafe', '2026-02-13T09:00', 'coffee'),
          stop('Museum', '2026-02-13T10:00'),
          stop('Cafe', '2026-02-13T16:00', 'cake'),
        ],
      }),
    ]);
    const visits = relatedTrips(b, 'Cafe');
    expect(visits).toHaveLength(1);
    expect(visits[0].stops.map((s) => s.note)).toEqual(['coffee', 'cake']);
  });

  it('returns nothing for a place no trip mentions', () => {
    expect(relatedTrips(board([trip('A', { stops: [stop('X')] })]), 'Y')).toEqual([]);
  });

  it('ignores stops whose place link never resolved', () => {
    expect(relatedTrips(board([trip('A', { stops: [stop(null)] })]), 'X')).toEqual([]);
  });
});

describe('tripsWithPerson', () => {
  it('finds every trip naming the person, most recent first', () => {
    const b = board([
      trip('A', { departure: '2026-02-13', personTitles: ['Gaby', 'Stefan'] }),
      trip('B', { departure: '2026-03-01', personTitles: ['Erika'] }),
      trip('C', { departure: '2026-04-01', personTitles: ['Gaby'] }),
    ]);
    expect(tripsWithPerson(b, 'Gaby').map((v) => v.trip.title)).toEqual(['C', 'A']);
  });

  /**
   * Being on a trip is a fact about the whole trip, not about any one stop
   * on it. The block draws a row per trip and nothing per stop for these,
   * which is what the empty list encodes.
   */
  it('matches a trip that has no stops at all', () => {
    const b = board([trip('Weekend', { departure: '2026-05-01', personTitles: ['Marc'] })]);
    const visits = tripsWithPerson(b, 'Marc');
    expect(visits).toHaveLength(1);
    expect(visits[0].stops).toEqual([]);
  });

  it('never attaches stops, even when the trip has some', () => {
    const b = board([
      trip('Basel', { departure: '2026-02-13', personTitles: ['Marc'], stops: [stop('Cafe')] }),
    ]);
    expect(tripsWithPerson(b, 'Marc')[0].stops).toEqual([]);
  });

  it('orders upcoming alongside past, and undated last, same as the place lookup', () => {
    const b = board([
      trip('Undated', { personTitles: ['Marc'] }),
      trip('Past', { effectiveStatus: 'Over', departure: '2025-01-01', personTitles: ['Marc'] }),
      trip('Upcoming', {
        effectiveStatus: 'Booked',
        departure: '2027-01-01',
        personTitles: ['Marc'],
      }),
    ]);
    expect(tripsWithPerson(b, 'Marc').map((v) => v.trip.title)).toEqual([
      'Upcoming',
      'Past',
      'Undated',
    ]);
  });

  it('returns nothing for a person no trip names', () => {
    expect(tripsWithPerson(board([trip('A', { personTitles: ['Gaby'] })]), 'Marc')).toEqual([]);
  });

  /**
   * A participant title is matched exactly as the trip carries it. The
   * trip editor keeps whatever was typed, so a name with no Person note
   * behind it still matches its own note if one is ever created under that
   * exact title -- and never matches a different one.
   */
  it('matches on the exact title, not a partial one', () => {
    const b = board([trip('A', { personTitles: ['Marcus'] })]);
    expect(tripsWithPerson(b, 'Marc')).toEqual([]);
  });
});
