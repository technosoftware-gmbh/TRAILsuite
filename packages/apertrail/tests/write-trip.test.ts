/**
 * The vault-write side of Trip notes -- what actually lands on disk, and
 * (the part that matters most) what an edit leaves alone. trip-note.test.ts
 * covers the frontmatter object; this covers the file.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
  // Deliberately minimal: enough YAML for these assertions, matching the
  // approach the recipe-export exporter tests already take. Quoting every
  // scalar mirrors Obsidian's own stringifyYaml closely enough for the
  // "datetimes must not be bare" property being asserted here.
  stringifyYaml: (obj: Record<string, unknown>) => {
    // Only scalars reach scalar() -- render() recurses into objects and
    // arrays before ever calling it -- so nothing gets stringified as
    // "[object Object]".
    const scalar = (value: unknown): string =>
      typeof value === 'number' ? String(value) : `"${value as string}"`;
    const render = (value: unknown, indent: number): string => {
      const pad = ' '.repeat(indent);
      if (Array.isArray(value)) {
        return (value as unknown[])
          .map((entry) =>
            entry !== null && typeof entry === 'object'
              ? `${pad}- ${render(entry, indent + 4).trimStart()}`
              : `${pad}- ${scalar(entry)}`
          )
          .join('\n');
      }
      return Object.entries(value as Record<string, unknown>)
        .map(([k, v]) =>
          v !== null && typeof v === 'object'
            ? `${pad}${k}:\n${render(v, indent + 2)}`
            : `${pad}${k}: ${scalar(v)}`
        )
        .join('\n');
    };
    return `${render(obj, 0)}\n`;
  },
}));

import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import {
  createTripNote,
  ensureItineraryBlock,
  TripInput,
  tripToInput,
  updateTripNote,
} from '../src/trips/write-trip';
import { TravelTrip } from '../src/vault/types';
import { makeFakeVault } from './fake-vault';
import { aStop, aStopInput } from './fixtures';

const settings = DEFAULT_SETTINGS;
const NOW = new Date(2026, 7, 6, 10, 30);

function tripInput(overrides: Partial<TripInput> = {}): TripInput {
  return {
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
    personTitles: [],
    days: [],
    stops: [],
    nights: [],
    transport: [],
    currency: null,
    budget: [],
    rates: [],
    ...overrides,
  };
}

describe('createTripNote', () => {
  /**
   * **A trip is a folder now.** It used to be a file directly in the Trips
   * folder; a trip accumulates a hero picture, a gallery, its bookings and an
   * exported sheet, and flat those land wherever they happen to.
   *
   * Nothing moves: a trip already flat goes on working where it is, because
   * folder matching recurses. This is a change to where a new note is written
   * and to nothing else.
   */
  it('writes the note into a folder of its own, named after the trip', async () => {
    const { app, created } = makeFakeVault();
    const file = await createTripNote(app, settings, 'Vienna 2026', tripInput(), NOW);
    expect(file.path).toBe(`${settings.tripsFolder}/Vienna 2026/Vienna 2026.md`);
    expect(created).toHaveLength(1);
  });

  // Two blocks and no prose. Both answer a question about the trip from the
  // moment it exists; a "## Review" skeleton would be the plugin deciding
  // how somebody writes.
  it('seeds the body with the itinerary and costs blocks, and nothing else', async () => {
    const { app, created } = makeFakeVault();
    await createTripNote(app, settings, 'Someday trip', tripInput(), NOW);
    const body = created[0].content.split('---\n')[2];
    expect(body.trim()).toBe('```travel-itinerary\n```\n\n```apt-trip-costs\n```');
  });

  // Creation stamps `created` and nothing else: a note whose two stamps
  // would be identical says nothing a single stamp does not, so `modified`
  // waits for the first real edit.
  it('stamps created, and deliberately not modified', async () => {
    const { app, created } = makeFakeVault();
    await createTripNote(app, settings, 'Vienna 2026', tripInput(), NOW);
    expect(created[0].content).toContain('created: "2026-08-06T10:30"');
    expect(created[0].content).not.toContain('modified:');
  });

  it('puts created directly after type', async () => {
    const { app, created } = makeFakeVault();
    await createTripNote(app, settings, 'Vienna 2026', tripInput(), NOW);
    const keys = created[0].content
      .split('---\n')[1]
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split(':')[0]);
    expect(keys.slice(0, 2)).toEqual(['type', 'created']);
  });

  it('writes nothing when the created property name has been cleared', async () => {
    const { app, created } = makeFakeVault();
    await createTripNote(
      app,
      { ...settings, createdProperty: '' },
      'Vienna 2026',
      tripInput(),
      NOW
    );
    expect(created[0].content).not.toContain('created');
  });

  it('writes datetimes quoted, so YAML cannot coerce them into a Date', async () => {
    const { app, created } = makeFakeVault();
    await createTripNote(
      app,
      settings,
      'Day trip',
      tripInput({ departure: '2026-02-13T09:00', return: '2026-02-13T14:00' }),
      NOW
    );
    expect(created[0].content).toContain('departure: "2026-02-13T09:00"');
    // The failure mode being guarded against: a bare timestamp.
    expect(created[0].content).not.toContain('departure: 2026-02-13T09:00\n');
  });

  it('writes a full day trip with persons and timed stops', async () => {
    const { app, created } = makeFakeVault();
    await createTripNote(
      app,
      settings,
      'Landquart - Maienfeld',
      tripInput({
        countryTitle: 'Switzerland',
        cityTitles: ['Landquart', 'Maienfeld'],
        departure: '2026-02-13T09:00',
        personTitles: ['Erika Muster', 'Stefan Muster'],
        stops: [
          aStopInput({
            placeTitle: 'Restaurant Falknis',
            from: '2026-02-13T12:00',
            to: '2026-02-13T13:30',
            note: 'Angus beef fillet',
            rating: 5,
          }),
        ],
      }),
      NOW
    );
    const content = created[0].content;
    expect(content).toContain('country: "[[Switzerland]]"');
    expect(content).toContain('- "[[Erika Muster]]"');
    expect(content).toContain('place: "[[Restaurant Falknis]]"');
    expect(content).toContain('note: "Angus beef fillet"');
    expect(content).toContain('rating: 5');
  });

  it('refuses to overwrite an existing trip note', async () => {
    const { app } = makeFakeVault([
      {
        path: `${settings.tripsFolder}/Vienna 2026/Vienna 2026.md`,
        frontmatter: { type: 'trip' },
      },
    ]);
    await expect(createTripNote(app, settings, 'Vienna 2026', tripInput(), NOW)).rejects.toThrow(
      /already exists/
    );
  });
});

describe('updateTripNote', () => {
  /** A fake whose processFrontMatter mutates a real object, so the clear-then-apply behaviour is observable. */
  function vaultWithFrontmatter(frontmatter: Record<string, unknown>) {
    const file = { path: 'Trips/Trip.md', basename: 'Trip' } as never;
    const app = {
      fileManager: {
        processFrontMatter: async (
          _f: unknown,
          fn: (fm: Record<string, unknown>) => void
        ): Promise<void> => {
          fn(frontmatter);
        },
      },
    } as never;
    return { app, file, frontmatter };
  }

  it('leaves frontmatter it does not own completely alone', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({
      type: 'trip',
      icon: 'mi-card_travel',
      color: '#8a4b2a',
      created: '2026-08-04T16:29',
      travelStatus: 'Planned',
    });
    await updateTripNote(app, settings, file, tripInput({ travelStatus: 'Over' }), NOW);
    expect(frontmatter.icon).toBe('mi-card_travel');
    expect(frontmatter.color).toBe('#8a4b2a');
    expect(frontmatter.created).toBe('2026-08-04T16:29');
    expect(frontmatter.travelStatus).toBe('Over');
  });

  /**
   * **`image` used to be in the test above**, as a key the plugin never
   * touched. It is owned now: the trip form offers a picture, so the writer
   * has to be able to clear one, which means listing it in `tripManagedKeys()`
   * and rewriting it on every save.
   *
   * That changes what happens to a hand-written `image:`. It survives, because
   * the form loads it and writes it back -- but only through the form. A save
   * driven by an input that does not carry it removes it, which is the same
   * contract every other owned key has and the reason this is stated here
   * rather than left to be discovered.
   *
   * `icon` and `color` stay cosmetic and untouched. They have no field.
   */
  it('carries a hand-written picture through a save, and can clear one', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({
      type: 'trip',
      image: '4 Ressourcen/Reisen/_resources/Trip.png',
    });

    await updateTripNote(
      app,
      settings,
      file,
      tripInput({ image: '4 Ressourcen/Reisen/_resources/Trip.png' }),
      NOW
    );
    expect(frontmatter.image).toBe('4 Ressourcen/Reisen/_resources/Trip.png');

    await updateTripNote(app, settings, file, tripInput({ image: null }), NOW);
    expect(frontmatter.image).toBeUndefined();
  });

  it('clears a key the edit emptied rather than leaving the old value behind', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({
      type: 'trip',
      stops: [{ place: '[[Basel]]' }],
      persons: ['[[Erika Muster]]'],
      rating: 4,
    });
    await updateTripNote(app, settings, file, tripInput(), NOW);
    expect(frontmatter.stops).toBeUndefined();
    expect(frontmatter.persons).toBeUndefined();
    expect(frontmatter.rating).toBeUndefined();
  });

  it('removes a legacy state property once the trip is saved through the editor', async () => {
    // The reference vault's trips carried `state: Done`, colliding with
    // the property a City uses to link to its State. It is not part of
    // the Trip schema, so an edit does not clear it -- this asserts the
    // deliberate boundary rather than a behaviour: migration removes it,
    // the editor does not silently rewrite unrelated keys.
    const { app, file, frontmatter } = vaultWithFrontmatter({ type: 'trip', state: 'Done' });
    await updateTripNote(app, settings, file, tripInput(), NOW);
    expect(frontmatter.state).toBe('Done');
  });

  it('restamps modified on every save', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({
      type: 'trip',
      modified: '2020-01-01T00:00',
    });
    await updateTripNote(app, settings, file, tripInput(), NOW);
    expect(frontmatter.modified).toBe('2026-08-06T10:30');
  });

  // The rule that makes `created` trustworthy: an edit reports when the
  // note changed, never guesses when it began.
  it('never invents created on a note that has none', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({ type: 'trip' });
    await updateTripNote(app, settings, file, tripInput(), NOW);
    expect(frontmatter.created).toBeUndefined();
    expect(frontmatter.modified).toBe('2026-08-06T10:30');
  });

  it('leaves an existing created stamp exactly as it was', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({
      type: 'trip',
      created: '2024-03-01T08:00',
    });
    await updateTripNote(app, settings, file, tripInput(), NOW);
    expect(frontmatter.created).toBe('2024-03-01T08:00');
  });

  it('stamps nothing when the modified property name has been cleared', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({ type: 'trip' });
    await updateTripNote(app, { ...settings, modifiedProperty: '' }, file, tripInput(), NOW);
    expect(frontmatter.modified).toBeUndefined();
    expect(Object.keys(frontmatter)).not.toContain('');
  });
});

describe('tripToInput', () => {
  /** A trip as the reader hands it back, with resolved cross-references the input shape doesn't carry. */
  function readTrip(overrides: Partial<TravelTrip> = {}): TravelTrip {
    return {
      file: { path: 'Trips/T.md', basename: 'T' },
      title: 'T',
      subtitle: 'Zugreise in Suedafrika',
      image: 'Trips/T/_resources/hero.jpg',
      highlights: ['Nostalgische Zugreise', 'Fish River Canyon'],
      gallery: [{ image: 'Trips/T/_resources/1.jpg', caption: 'Sossusvlei' }],
      countryTitle: 'Switzerland',
      country: { title: 'Switzerland' },
      cityTitles: ['Basel'],
      cities: [{ title: 'Basel' }],
      departure: '2026-02-13T09:00',
      return: '2026-02-13T14:00',
      travelType: 'Private - Couple',
      travelStatus: 'Over',
      effectiveStatus: 'Over',
      reviewStatus: 'Done',
      rating: 4,
      currency: 'CHF',
      budget: [{ category: 'food', amount: 120 }],
      rates: [],
      personTitles: ['Erika Muster'],
      days: [{ day: 1, title: 'Basel', note: null }],
      stops: [
        {
          placeTitle: 'Falknis',
          target: { title: 'Falknis' },
          targetKind: 'fnb',
          from: '2026-02-13T12:00',
          to: '2026-02-13T13:30',
          note: 'Beef fillet',
          rating: 5,
          cost: null,
          currency: null,
          costUnit: 'total',
          persons: [],
        },
      ],
      nights: [
        {
          accommodationTitle: 'Hotel',
          accommodation: null,
          checkIn: '2026-02-13',
          checkOut: null,
          cost: null,
          currency: null,
          costUnit: 'night',
          persons: [],
        },
      ],
      transport: [
        {
          direction: 'outbound',
          mode: 'car',
          from: '2026-02-13T09:00',
          to: null,
          reference: null,
          cost: null,
          currency: null,
          costUnit: 'person',
          persons: ['Erika Muster'],
        },
      ],
      ...overrides,
      // The fixture only fills the fields tripToInput reads; the resolved
      // cross-references (country/target/accommodation objects) are the
      // reader's business, not the writer's.
    } as unknown as TravelTrip;
  }

  it('round-trips every field the writer owns', () => {
    const input = tripToInput(readTrip());
    expect(input.countryTitle).toBe('Switzerland');
    expect(input.cityTitles).toEqual(['Basel']);
    expect(input.departure).toBe('2026-02-13T09:00');
    expect(input.travelStatus).toBe('Over');
    expect(input.rating).toBe(4);
    expect(input.personTitles).toEqual(['Erika Muster']);
    expect(input.stops[0]).toEqual({
      placeTitle: 'Falknis',
      from: '2026-02-13T12:00',
      to: '2026-02-13T13:30',
      note: 'Beef fillet',
      rating: 5,
      cost: null,
      currency: null,
      costUnit: 'total',
      persons: [],
      motifName: undefined,
      day: undefined,
      // The three shared sub-keys arrive on every line, saying nothing: this
      // stop is not optional and is sold at one price. Asserted rather than
      // ignored, because a hand-built line that arrived without them is
      // exactly the shape that broke twice before.
      variants: [],
      optional: false,
      chosen: false,
    });
    expect(input.nights[0].accommodationTitle).toBe('Hotel');
    expect(input.transport[0].mode).toBe('car');
  });

  it('carries a derived status back as null, so it never gets written into the note', () => {
    // effectiveStatus is a read-time fallback. If tripToInput promoted it,
    // editing one stop would silently stamp a guessed status onto the note.
    const input = tripToInput(readTrip({ travelStatus: null, effectiveStatus: 'Over' }));
    expect(input.travelStatus).toBeNull();
  });

  it('keeps a stop whose link never resolved, as its raw text', () => {
    const input = tripToInput(
      readTrip({
        stops: [aStop({ placeTitle: null, note: 'typo row' })],
      })
    );
    // Dropped here, an unrelated edit elsewhere on the trip would delete
    // the broken row behind the user's back.
    expect(input.stops).toHaveLength(1);
    expect(input.stops[0].placeTitle).toBe('');
    expect(input.stops[0].note).toBe('typo row');
  });

  it('copies the lists rather than aliasing them', () => {
    const trip = readTrip();
    const input = tripToInput(trip);
    input.stops.push(aStopInput({ placeTitle: 'X' }));
    input.cityTitles.push('Bern');
    expect(trip.stops).toHaveLength(1);
    expect(trip.cityTitles).toEqual(['Basel']);
  });
});

/**
 * The repair path. It appends to a note that already exists, so it is a
 * modification -- but a call made straight after creation finds the block
 * createTripNote() already seeded and writes nothing, which is what keeps
 * "creation does not stamp modified" true without needing a flag.
 */
describe('ensureItineraryBlock', () => {
  function vaultWithBody(body: string) {
    const frontmatter: Record<string, unknown> = { type: 'trip' };
    const appended: string[] = [];
    const file = { path: 'Trips/Trip.md', basename: 'Trip' } as never;
    const app = {
      vault: {
        read: async () => body,
        append: async (_f: unknown, text: string) => {
          appended.push(text);
        },
      },
      fileManager: {
        processFrontMatter: async (
          _f: unknown,
          fn: (fm: Record<string, unknown>) => void
        ): Promise<void> => {
          fn(frontmatter);
        },
      },
    } as never;
    return { app, file, frontmatter, appended };
  }

  it('appends the block and stamps modified on a trip that lacks it', async () => {
    const { app, file, frontmatter, appended } = vaultWithBody('---\ntype: trip\n---\n');
    expect(await ensureItineraryBlock(app, settings, file, NOW)).toBe(true);
    expect(appended).toHaveLength(1);
    expect(frontmatter.modified).toBe('2026-08-06T10:30');
  });

  it('writes nothing at all when the block is already there, as it is right after creation', async () => {
    const { app, file, frontmatter, appended } = vaultWithBody('```travel-itinerary\n```\n');
    expect(await ensureItineraryBlock(app, settings, file, NOW)).toBe(false);
    expect(appended).toHaveLength(0);
    expect('modified' in frontmatter).toBe(false);
  });
});
