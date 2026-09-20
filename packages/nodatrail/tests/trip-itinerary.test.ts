/**
 * Reading a trip's itinerary, and deciding what seeding it would write.
 *
 * The cases that matter are the ones where a stop produces nothing, because
 * each of them is a way for somebody to lose an afternoon without being told:
 * an offered excursion nobody bought, a stop no date can be worked out for, and
 * a line the day note already carries.
 *
 * **The relative stop is the one to keep an eye on.** A trip is a shape before
 * it is a set of dates, so a stop may say `day: 3` and a bare `14:00`, and a
 * reader that did not know the convention would skip it rather than mis-date
 * it. That is the quietest failure the trip contract exists to prevent.
 */
import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { itineraryOf, readTrips } from '../src/plan/read-trip-itinerary';
import { planTripImport } from '../src/plan/trip-import-plan';

vi.mock('obsidian', () => import('./obsidian-stub'));

const S = DEFAULT_SETTINGS;

/** A trip note's frontmatter, as APERtrail writes it. */
const NORDKAP = {
  type: 'trip',
  travelStatus: 'Booked',
  departure: '2027-02-13T09:00',
  return: '2027-02-27T18:30',
  persons: ['[[Thomas]]', '[[Anna Muster]]'],
  stops: [
    { place: '[[Bergen]]', from: '2027-02-13T14:00', to: '2027-02-13T16:00' },
    {
      place: '[[Tromso]]',
      excursion: '[[Hundeschlittenfahrt]]',
      day: 5,
      from: '09:00',
      to: '12:30',
      persons: ['[[Anna Muster]]'],
    },
    { place: '[[Nordkap]]', excursion: '[[Bus zum Nordkap]]', day: 8, optional: true },
    { place: '[[Kirkenes]]', excursion: '[[Schneehotel]]', day: 9, optional: true, chosen: true },
    { place: '[[Irgendwo]]' },
  ],
};

describe('itineraryOf', () => {
  const trip = itineraryOf('Nordkap 2027', NORDKAP, S);

  it('reads the trip and every stop it can place', () => {
    expect(trip.status).toBe('Booked');
    expect(trip.persons).toEqual(['Thomas', 'Anna Muster']);
    expect(trip.stops).toHaveLength(5);
  });

  it('dates an absolute stop from its own stamp', () => {
    expect(trip.stops[0]).toMatchObject({
      day: '2027-02-13',
      from: '14:00',
      to: '16:00',
      text: 'Bergen',
      place: 'Bergen',
    });
  });

  it('dates a relative stop from the departure, day one being the departure day', () => {
    // Day 5 of a trip leaving on the 13th is the 17th, not the 18th.
    expect(trip.stops[1]).toMatchObject({ day: '2027-02-17', from: '09:00', to: '12:30' });
  });

  it('says the excursion rather than the place, because that is what the afternoon was', () => {
    expect(trip.stops[1]?.text).toBe('Hundeschlittenfahrt');
    expect(trip.stops[1]?.place).toBe('Tromso');
  });

  it('marks an optional stop nobody took, and does not mark one that was taken', () => {
    expect(trip.stops[2]?.offered).toBe(true);
    expect(trip.stops[3]?.offered).toBe(false);
  });

  it('leaves a stop with neither a date nor a day number unplaced', () => {
    expect(trip.stops[4]?.day).toBeNull();
  });

  it('places nothing at all when the trip has no departure', () => {
    const undated = itineraryOf('Irgendwann', { ...NORDKAP, departure: null }, S);
    expect(undated.stops[1]?.day).toBeNull();
    // The absolute stop still has its own date: it never needed the departure.
    expect(undated.stops[0]?.day).toBe('2027-02-13');
  });
});

describe('planTripImport', () => {
  const trip = itineraryOf('Nordkap 2027', NORDKAP, S);

  it('writes the stops it can place and nothing else', () => {
    const plan = planTripImport({ trip, existing: [] });
    expect(plan.proposals.map((one) => one.status)).toEqual([
      'new',
      'new',
      'not-chosen',
      'new',
      'undated',
    ]);
    expect(plan.toWrite).toBe(3);
    expect(plan.days).toEqual(['2027-02-13', '2027-02-17', '2027-02-21']);
  });

  it('leaves a line the day note already says alone', () => {
    const plan = planTripImport({
      trip,
      existing: [{ day: '2027-02-13', from: '14:00', text: 'Bergen' }],
    });
    expect(plan.proposals[0]?.status).toBe('already-present');
    expect(plan.alreadyPresent).toBe(1);
    expect(plan.toWrite).toBe(2);
  });

  it('matches an existing line on case and spacing alone', () => {
    // The same forgiveness the calendar import's key has, and no more:
    // anything looser starts matching two genuinely different afternoons.
    const plan = planTripImport({
      trip,
      existing: [{ day: '2027-02-13', from: '14:00', text: 'bergen' }],
    });
    expect(plan.proposals[0]?.status).toBe('already-present');
  });

  it('reports a trip that says the same thing twice rather than writing it twice', () => {
    const twice = itineraryOf(
      'Doppelt',
      { ...NORDKAP, stops: [NORDKAP.stops[0], NORDKAP.stops[0]] },
      S
    );
    const plan = planTripImport({ trip: twice, existing: [] });
    expect(plan.proposals.map((one) => one.status)).toEqual(['new', 'duplicate-in-file']);
    expect(plan.toWrite).toBe(1);
  });

  it("gives a stop the trip's travellers when it names nobody", () => {
    const plan = planTripImport({ trip, existing: [] });
    expect(plan.proposals[0]?.persons).toEqual(['Thomas', 'Anna Muster']);
    expect(plan.proposals[1]?.persons).toEqual(['Anna Muster']);
  });
});

describe('readTrips', () => {
  it('reads what is in the trips folder and ignores what is not', () => {
    const notes: Record<string, Record<string, unknown>> = {
      [`${S.tripsFolder}/Nordkap 2027.md`]: NORDKAP,
      // Right type, wrong folder: a trip note somebody keeps elsewhere is not
      // claimed, which is the vault's own folder-and-type rule.
      'Irgendwo/Sardinien.md': { type: 'trip' },
      // Right folder, wrong type.
      [`${S.tripsFolder}/Packliste.md`]: { type: 'resource' },
    };
    const files = Object.keys(notes).map((path) => ({
      path,
      basename: path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''),
    }));
    const app = {
      vault: { getMarkdownFiles: () => files },
      metadataCache: {
        getFileCache: (file: { path: string }) => ({ frontmatter: notes[file.path] ?? {} }),
      },
    } as unknown as App;

    expect(readTrips(app, S).map((trip) => trip.title)).toEqual(['Nordkap 2027']);
  });

  it('reads nothing at all when the trips folder is blank, which is how it is switched off', () => {
    const app = {
      vault: { getMarkdownFiles: () => [] },
      metadataCache: { getFileCache: () => ({ frontmatter: {} }) },
    } as unknown as App;
    expect(readTrips(app, { ...S, tripsFolder: '' })).toEqual([]);
  });
});
