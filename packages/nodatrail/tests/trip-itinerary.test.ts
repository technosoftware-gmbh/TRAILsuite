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
import { planTripImport, type TripImportPlan } from '../src/plan/trip-import-plan';
import { linesFor } from '../src/plan/write-trip-import';
import { meetingsIn } from '../src/plan/read-day';

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

  it('carries who the stop names, and never fills in the trip travellers', () => {
    // A stop naming nobody on a two-person trip does mean both went. That is a
    // derived fact, and this codebase does not write derived facts into notes:
    // the trip note says who is travelling and goes on saying it, where a day
    // line repeating it would be a second copy to disagree with the first the
    // moment somebody drops out.
    const plan = planTripImport({ trip, existing: [] });
    expect(plan.proposals[0]?.persons).toEqual([]);
    expect(plan.proposals[1]?.persons).toEqual(['Anna Muster']);
  });
});

describe('the lines a seeded stop becomes', () => {
  const trip = itineraryOf('Nordkap 2027', NORDKAP, S);

  /** What the writer would hand the composer: the marked proposals and no others. */
  const written = (plan: TripImportPlan) => plan.proposals.filter((one) => one.writes);

  it('names the trip on the line and puts the place and the people underneath', () => {
    const plan = planTripImport({ trip, existing: [] });
    expect(linesFor(S, written(plan))).toEqual([
      '- 👥 14:00-16:00 Bergen [[Nordkap 2027]]',
      '    - 📍 [[Bergen]]',
      '- 👥 09:00-12:30 Hundeschlittenfahrt [[Nordkap 2027]]',
      '    - 📍 [[Tromso]]',
      '    - 🧑 [[Anna Muster]]',
      '- 👥 Schneehotel [[Nordkap 2027]]',
      '    - 📍 [[Kirkenes]]',
    ]);
  });

  it('writes the place even where the headline already reads like it', () => {
    // The text is words and the child is a link, and only the link resolves to
    // a note, draws a chip and appears in that place's backlinks.
    const plan = planTripImport({ trip, existing: [] });
    const lines = linesFor(S, plan.proposals.slice(0, 1));
    expect(lines).toEqual(['- 👥 14:00-16:00 Bergen [[Nordkap 2027]]', '    - 📍 [[Bergen]]']);
  });

  it('composes whatever it is handed, because the writer holds the filter', () => {
    // `linesFor` does not re-decide what writes. An offered excursion composes
    // to a line here and never reaches a note, because `writeTripImport` skips
    // it. One rule, one place -- the same split the calendar import makes.
    const plan = planTripImport({ trip, existing: [] });
    expect(linesFor(S, plan.proposals)).toHaveLength(11);
    expect(written(plan)).toHaveLength(3);
  });

  it('composes the same line the dialog would, so a seeded stop is editable', () => {
    // The derived key only works while a seeded line and a typed one are the
    // same thing, and being editable is how that shows.
    const plan = planTripImport({ trip, existing: [] });
    const body = ['## 📅 Schedule', ...linesFor(S, plan.proposals.slice(1, 2)), ''].join('\n');
    const [record] = meetingsIn(body, S);
    expect(record?.editable).toBe(true);
    expect(record?.draft.place).toBe('Tromso');
    expect(record?.draft.persons).toEqual(['Anna Muster']);
    expect(record?.draft.context).toBe('Nordkap 2027');
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
