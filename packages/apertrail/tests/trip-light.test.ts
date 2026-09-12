/**
 * Photo spots inside a trip: which point a day's light is computed at, the
 * golden-hour time a new stop starts from, the shot list, and the conflict
 * check. The band itself is shared/sun-band.ts and has its own suite. The
 * rendering that consumes all of it is DOM building and is left untested,
 * the same boundary the rest of the codebase draws.
 */
import { describe, expect, it } from 'vitest';
import { aStop, aTrip } from './fixtures';
import {
  dayAnchor,
  goldenHourPrefill,
  scheduleConflicts,
  stopMotif,
  tripShotList,
} from '../src/trips/trip-light';
import { ParsedPhotoSpotMotif } from '../src/places/photo-spot-note';
import { TravelPlace, TravelTrip, TravelTripStop } from '../src/vault/types';

function motif(name: string, overrides: Partial<ParsedPhotoSpotMotif> = {}): ParsedPhotoSpotMotif {
  return {
    name,
    role: 'secondary',
    geoLocation: null,
    direction: null,
    light: [],
    season: [],
    lens: null,
    gear: [],
    technique: null,
    note: null,
    captured: false,
    capturedOn: null,
    ...overrides,
  };
}

function spot(
  title: string,
  motifs: ParsedPhotoSpotMotif[],
  geoLocation: [string, string] | null = ['46.947999', '7.448148']
): TravelPlace {
  return {
    file: { path: `Photo Spots/${title}.md`, basename: title },
    kind: 'photospot',
    title,
    geoLocation,
    photoSpot: {
      timezone: null,
      openingHours: null,
      entryFee: null,
      accessibility: 'unknown',
      parking: null,
      transit: [],
      motifs,
      samples: [],
    },
  } as unknown as TravelPlace;
}

function stop(target: TravelPlace | null, kind: TravelTripStop['targetKind']): TravelTripStop {
  return aStop({ placeTitle: target?.title ?? null, target, targetKind: kind });
}

function trip(stops: TravelTripStop[]): TravelTrip {
  return aTrip('A trip', { stops });
}

describe('dayAnchor', () => {
  it('takes the first stop that has coordinates', () => {
    const withCoords = spot('Bern', [], ['46.9', '7.4']);
    const without = spot('Nowhere', [], null);
    expect(dayAnchor([stop(without, 'photospot'), stop(withCoords, 'photospot')])).toEqual({
      lat: 46.9,
      lon: 7.4,
    });
  });

  // A day whose stops are all unlocated gets no band rather than a wrong
  // one computed somewhere the trip never went.
  it('is null when nothing on the day is located', () => {
    expect(dayAnchor([stop(spot('Nowhere', [], null), 'photospot'), stop(null, null)])).toBeNull();
  });
});

describe('stopMotif', () => {
  const spotWithTwo = spot('Neuchâtel', [
    motif('Schloss', { role: 'main', light: ['golden-hour-evening'] }),
    motif('Pavillon', { light: ['blue-hour-morning'] }),
  ]).photoSpot;

  it('takes the motif the stop names', () => {
    expect(stopMotif(spotWithTwo, 'Pavillon')?.name).toBe('Pavillon');
  });

  // The name is typed on the stop and on the motif, so expecting them to
  // match byte for byte would fail on a stray capital -- the same rule
  // samples are matched to motifs by.
  it('matches the name case-insensitively and trimmed', () => {
    expect(stopMotif(spotWithTwo, '  pavillon ')?.name).toBe('Pavillon');
  });

  it('falls back to the main motif when the stop names none', () => {
    expect(stopMotif(spotWithTwo, null)?.name).toBe('Schloss');
  });

  // The stop is still at that spot. Refusing to answer would leave the row
  // with no light at all, which is worse than answering with the main one.
  it('falls back rather than refusing when the name matches nothing', () => {
    expect(stopMotif(spotWithTwo, 'Steg')?.name).toBe('Schloss');
  });
});

describe('goldenHourPrefill', () => {
  const date = new Date('2026-06-14T12:00:00Z');

  it("takes the main motif's first light window", () => {
    const place = spot('Bern', [
      motif('Pavillon', { role: 'secondary', light: ['night'] }),
      motif('Schloss', { role: 'main', light: ['golden-hour-evening', 'sunset'] }),
    ]);
    const prefill = goldenHourPrefill(place, date);
    // The evening golden hour at Bern in mid-June, not the secondary
    // motif's night and not midnight.
    expect(prefill.from.toISOString()).toMatch(/2026-06-14T18:/);
    expect(prefill.to.valueOf()).toBeGreaterThan(prefill.from.valueOf());
  });

  // The two motifs at Neuchâtel want opposite ends of the day, which is
  // exactly why a stop may name one: prefilling the main motif's evening
  // for a stop that goes for the morning one is wrong by twelve hours and
  // says nothing about why.
  it("takes the named motif's light rather than the main one's", () => {
    const place = spot('Neuchâtel', [
      motif('Schloss', { role: 'main', light: ['golden-hour-evening'] }),
      motif('Pavillon', { light: ['blue-hour-morning'] }),
    ]);
    const evening = goldenHourPrefill(place, date);
    const morning = goldenHourPrefill(place, date, 'Pavillon');
    expect(evening.light).toBe('golden-hour-evening');
    expect(morning.light).toBe('blue-hour-morning');
    expect(morning.from.valueOf()).toBeLessThan(evening.from.valueOf());
  });

  it('prefers a motif with its own coordinates over the note anchor', () => {
    const far = spot('Bern', [
      motif('Weit weg', { role: 'main', light: ['sunrise'], geoLocation: ['64.1466', '-21.9426'] }),
    ]);
    const near = spot('Bern', [motif('Hier', { role: 'main', light: ['sunrise'] })]);
    expect(goldenHourPrefill(far, date).from.valueOf()).not.toBe(
      goldenHourPrefill(near, date).from.valueOf()
    );
  });

  // A stop that begins and ends at the same minute reads as a mistake.
  it('prefills only a start for an instant like sunrise', () => {
    const place = spot('Bern', [motif('Schloss', { role: 'main', light: ['sunrise'] })]);
    expect(goldenHourPrefill(place, date).to).toBeNull();
  });

  it('suggests nothing for a place that is not a photo spot', () => {
    const landmark = { ...spot('Schloss', []), kind: 'landmark' } as TravelPlace;
    expect(goldenHourPrefill(landmark, date)).toBeNull();
  });

  it('suggests nothing when no motif names a light window', () => {
    expect(goldenHourPrefill(spot('Bern', [motif('Schloss', { role: 'main' })]), date)).toBeNull();
  });

  it('suggests nothing when neither the motif nor the note has coordinates', () => {
    const place = spot('Bern', [motif('Schloss', { role: 'main', light: ['sunrise'] })], null);
    expect(goldenHourPrefill(place, date)).toBeNull();
  });

  it('suggests nothing on a date when that light never happens', () => {
    const place = spot(
      'Tromso',
      [motif('Grat', { role: 'main', light: ['golden-hour-evening'] })],
      ['69.6492', '18.9553']
    );
    expect(goldenHourPrefill(place, new Date('2026-06-21T12:00:00Z'))).toBeNull();
  });
});

describe('tripShotList', () => {
  it('lists every motif at every photo spot the trip stops at, in stop order', () => {
    const a = spot('Neuchatel', [motif('Schloss', { captured: true }), motif('Pavillon')]);
    const b = spot('Creux du Van', [motif('Felsenkessel')]);
    const list = tripShotList(trip([stop(a, 'photospot'), stop(b, 'photospot')]));
    expect(list.map((e) => e.motifName)).toEqual(['Schloss', 'Pavillon', 'Felsenkessel']);
    expect(list[0].captured).toBe(true);
    expect(list[1].captured).toBe(false);
  });

  // The itinerary above already shows both visits. Repeating the motifs
  // would answer a different question than the one the list asks.
  it('lists a spot the trip visits twice only once', () => {
    const a = spot('Neuchatel', [motif('Schloss')]);
    expect(tripShotList(trip([stop(a, 'photospot'), stop(a, 'photospot')]))).toHaveLength(1);
  });

  it('ignores stops that are not photo spots', () => {
    const landmark = { ...spot('Schloss', [motif('X')]), kind: 'landmark' } as TravelPlace;
    expect(tripShotList(trip([stop(landmark, 'landmark'), stop(null, null)]))).toEqual([]);
  });

  it('skips a nameless motif, which has nothing to tick off', () => {
    const a = spot('Neuchatel', [motif('Schloss'), { ...motif('x'), name: null }]);
    expect(tripShotList(trip([stop(a, 'photospot')]))).toHaveLength(1);
  });
});

describe('scheduleConflicts', () => {
  /** A stop at a place, with times. `place` carries the coordinates. */
  function timed(place: TravelPlace | null, from: string | null, to: string | null = null) {
    return { ...stop(place, place ? 'photospot' : null), from, to };
  }

  // Neuchâtel to the Creux du Van is about 24 km straight line: six hours
  // on foot, which no evening golden hour is long enough for.
  const neuchatel = spot('Neuchatel', [], ['46.9899', '6.9293']);
  const creuxDuVan = spot('Creux du Van', [], ['46.9333', '6.7333']);

  it('flags two stops that cannot be walked between in the time between them', () => {
    const conflicts = scheduleConflicts([
      timed(neuchatel, '2026-06-14T20:42', '2026-06-14T21:29'),
      timed(creuxDuVan, '2026-06-14T20:45'),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].index).toBe(1);
    expect(conflicts[0].fromIndex).toBe(0);
    expect(conflicts[0].km).toBeGreaterThan(10);
    expect(conflicts[0].walkMinutes).toBeGreaterThan(conflicts[0].gapMinutes);
  });

  it('stays quiet when the gap is long enough to cover the distance', () => {
    expect(
      scheduleConflicts([
        timed(neuchatel, '2026-06-14T08:00', '2026-06-14T09:00'),
        timed(creuxDuVan, '2026-06-14T20:00'),
      ])
    ).toEqual([]);
  });

  it('measures from the end of the earlier stop, not its start', () => {
    // Same arrival, but a stop that runs until 20:00 leaves far less room
    // than one that ended at 08:00.
    const short = scheduleConflicts([
      timed(neuchatel, '2026-06-14T08:00', '2026-06-14T20:00'),
      timed(creuxDuVan, '2026-06-14T21:00'),
    ]);
    expect(short).toHaveLength(1);
  });

  it('says nothing about stops on different days', () => {
    expect(
      scheduleConflicts([
        timed(neuchatel, '2026-06-14T20:42', '2026-06-14T21:29'),
        timed(creuxDuVan, '2026-06-15T05:00'),
      ])
    ).toEqual([]);
  });

  // Without a time, a coordinate or a place, there is no claim to check,
  // and inventing one would be worse than saying nothing.
  it('says nothing when either stop lacks a clock time', () => {
    expect(
      scheduleConflicts([timed(neuchatel, '2026-06-14'), timed(creuxDuVan, '2026-06-14T20:45')])
    ).toEqual([]);
    expect(
      scheduleConflicts([timed(neuchatel, '2026-06-14T20:42'), timed(creuxDuVan, null)])
    ).toEqual([]);
  });

  it('says nothing when either stop has no coordinates', () => {
    const nowhere = spot('Nowhere', [], null);
    expect(
      scheduleConflicts([
        timed(neuchatel, '2026-06-14T20:42', '2026-06-14T21:29'),
        timed(nowhere, '2026-06-14T20:45'),
      ])
    ).toEqual([]);
    expect(
      scheduleConflicts([timed(null, '2026-06-14T20:42'), timed(creuxDuVan, '2026-06-14T20:45')])
    ).toEqual([]);
  });

  // The sharpest version of the same mistake: you cannot be in two places
  // at once, whatever the distance between them.
  it('flags overlapping stops at different places, with a negative gap', () => {
    const conflicts = scheduleConflicts([
      timed(neuchatel, '2026-06-14T20:00', '2026-06-14T22:00'),
      timed(creuxDuVan, '2026-06-14T21:00'),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].gapMinutes).toBeLessThan(0);
  });

  it('checks every consecutive pair, not just the first', () => {
    const conflicts = scheduleConflicts([
      timed(neuchatel, '2026-06-14T08:00', '2026-06-14T09:00'),
      timed(creuxDuVan, '2026-06-14T20:00', '2026-06-14T20:10'),
      timed(neuchatel, '2026-06-14T20:20'),
    ]);
    expect(conflicts.map((c) => c.index)).toEqual([2]);
  });
  // The design's rule is about two stops wanting the same light, and a
  // dinner listed between them does not make that any less true. Comparing
  // only neighbours missed exactly that shape.
  it('compares stops that are not next to each other', () => {
    const ridge = spot('Creux du Van', [], ['46.9333', '6.7333']);
    const town = spot('Neuchâtel', [], ['46.9899', '6.9293']);
    const dinner = spot('Le Cardamome', [], ['46.9899', '6.9293']);

    const conflicts = scheduleConflicts([
      timed(ridge, '2026-06-14T20:40', '2026-06-14T21:20'),
      timed(dinner, '2026-06-14T21:00', '2026-06-14T21:05'),
      timed(town, '2026-06-14T21:10', '2026-06-14T21:40'),
    ]);

    // The ridge is 17 km from town: reachable in neither ten minutes nor
    // the fifty the whole evening leaves.
    expect(conflicts.some((conflict) => conflict.index === 2)).toBe(true);
  });

  // Several warnings on one row would say the same thing twice, and the
  // deepest deficit is the one that makes the day impossible.
  it('keeps one conflict per stop, the sharpest one', () => {
    const far = spot('Vestrahorn', [], ['64.2539', '-14.9722']);
    const near = spot('Nachbar', [], ['46.9999', '6.9393']);
    const town = spot('Neuchâtel', [], ['46.9899', '6.9293']);

    const conflicts = scheduleConflicts([
      timed(far, '2026-06-14T09:00', '2026-06-14T09:30'),
      timed(near, '2026-06-14T09:35', '2026-06-14T09:40'),
      timed(town, '2026-06-14T09:45', '2026-06-14T10:00'),
    ]);

    expect(conflicts.filter((conflict) => conflict.index === 2)).toHaveLength(1);
    expect(conflicts.find((conflict) => conflict.index === 2)?.fromIndex).toBe(0);
  });
});
