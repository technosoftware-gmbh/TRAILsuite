/**
 * The place head, written -- and (the part that matters most) what an edit
 * leaves alone.
 *
 * The same split write-photo-spot.test.ts makes: the frontmatter object and
 * the file are two different questions, and the second is where a note loses
 * something nobody meant to touch.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
}));

import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import {
  buildPlaceFrontmatter,
  PlaceInput,
  placeManagedKeys,
  placePropertyNames,
  placeToInput,
  updatePlaceNote,
} from '../src/places/write-place';
import { TravelPlace } from '../src/vault/types';

const settings = DEFAULT_SETTINGS;
const properties = placePropertyNames(settings);
const NOW = new Date(2026, 8, 10, 9, 15);

function input(overrides: Partial<PlaceInput> = {}): PlaceInput {
  return {
    countryTitle: null,
    cityTitle: null,
    geoLocation: null,
    address: null,
    website: null,
    rating: null,
    tags: [],
    accommodationType: null,
    accommodationStatus: null,
    fnbType: null,
    ...overrides,
  };
}

/** A fake whose processFrontMatter mutates a real object, so clear-then-apply is observable. */
function vaultWithFrontmatter(frontmatter: Record<string, unknown>) {
  const file = {
    path: 'Places/Accommodation/Hotel Bristol.md',
    basename: 'Hotel Bristol',
  } as never;
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

describe('buildPlaceFrontmatter', () => {
  it('writes the head every kind shares', () => {
    const yaml = buildPlaceFrontmatter(
      input({
        countryTitle: 'Switzerland',
        cityTitle: 'Brugg',
        geoLocation: ['47.4818', '8.2085'],
        address: 'Bahnhofstrasse 12',
        website: 'https://example.test',
        rating: 4,
        tags: ['quiet', ' early '],
      }),
      'landmark',
      properties
    );

    expect(yaml.country).toBe('[[Switzerland]]');
    expect(yaml.city).toBe('[[Brugg]]');
    expect(yaml.geoLocation).toEqual(['47.4818', '8.2085']);
    expect(yaml.address).toBe('Bahnhofstrasse 12');
    expect(yaml.website).toBe('https://example.test');
    expect(yaml.rating).toBe(4);
    expect(yaml.tags).toEqual(['quiet', 'early']);
  });

  it('omits what was left empty rather than writing it blank', () => {
    const yaml = buildPlaceFrontmatter(
      input({ address: '   ', tags: ['', ' '] }),
      'landmark',
      properties
    );
    expect('address' in yaml).toBe(false);
    expect('tags' in yaml).toBe(false);
    expect(Object.keys(yaml)).toHaveLength(0);
  });

  /** One number without the other is not a position, and it reads back as null anyway. */
  it('does not write half a coordinate', () => {
    const yaml = buildPlaceFrontmatter(
      input({ geoLocation: ['47.4818', '  '] }),
      'landmark',
      properties
    );
    expect('geoLocation' in yaml).toBe(false);
  });

  it('writes a subtype field only for the kind that owns it', () => {
    const carried = input({
      accommodationType: 'Hotel',
      accommodationStatus: 'Booked',
      fnbType: 'Cafe',
    });

    const hotel = buildPlaceFrontmatter(carried, 'accommodation', properties);
    expect(hotel.accommodationType).toBe('Hotel');
    expect(hotel.accommodationStatus).toBe('Booked');
    expect('fnbType' in hotel).toBe(false);

    const cafe = buildPlaceFrontmatter(carried, 'fnb', properties);
    expect(cafe.fnbType).toBe('Cafe');
    expect('accommodationType' in cafe).toBe(false);

    const landmark = buildPlaceFrontmatter(carried, 'landmark', properties);
    expect('accommodationType' in landmark).toBe(false);
    expect('fnbType' in landmark).toBe(false);
  });

  it('honours renamed property names', () => {
    const renamed = placePropertyNames({
      ...settings,
      tagsProperty: 'schlagworte',
      accommodationTypeProperty: 'unterkunftsart',
    });
    const yaml = buildPlaceFrontmatter(
      input({ tags: ['ruhig'], accommodationType: 'Hotel' }),
      'accommodation',
      renamed
    );

    expect(yaml.schlagworte).toEqual(['ruhig']);
    expect(yaml.unterkunftsart).toBe('Hotel');
    expect('tags' in yaml).toBe(false);
  });
});

describe('placeManagedKeys', () => {
  /**
   * Read is not own. A landmark carrying a hand-added `accommodationType:` is
   * carrying something this plugin never reads for a landmark, and clearing
   * it would delete a value on the strength of a field the note was not being
   * asked about.
   */
  it('claims a subtype key for its own kind and for nobody else', () => {
    expect(placeManagedKeys('accommodation', properties)).toContain('accommodationType');
    expect(placeManagedKeys('fnb', properties)).toContain('fnbType');
    expect(placeManagedKeys('landmark', properties)).not.toContain('accommodationType');
    expect(placeManagedKeys('landmark', properties)).not.toContain('fnbType');
  });

  it('never claims visited or lastVisit', () => {
    const keys = placeManagedKeys('accommodation', properties);
    expect(keys).not.toContain(settings.visitedProperty);
    expect(keys).not.toContain(settings.lastVisitProperty);
  });
});

describe('updatePlaceNote', () => {
  it('leaves frontmatter it does not own completely alone', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({
      type: 'accommodation',
      image: 'Attachments/bristol.jpg',
      gallery: [{ image: 'Attachments/room.jpg', caption: 'Room 14' }],
      description: 'On the square, above the arcade.',
      icon: 'bed',
      created: '2026-08-04T16:29',
    });

    await updatePlaceNote(
      app,
      settings,
      file,
      'accommodation',
      input({ rating: 5 }),
      undefined,
      NOW
    );

    expect(frontmatter.type).toBe('accommodation');
    expect(frontmatter.image).toBe('Attachments/bristol.jpg');
    expect(frontmatter.gallery).toEqual([{ image: 'Attachments/room.jpg', caption: 'Room 14' }]);
    expect(frontmatter.description).toBe('On the square, above the arcade.');
    expect(frontmatter.icon).toBe('bed');
    expect(frontmatter.created).toBe('2026-08-04T16:29');
    expect(frontmatter.rating).toBe(5);
  });

  /**
   * The rule this is really guarding: `visited` and `lastVisit` can be
   * DERIVED from the trips that stopped here. A writer that cleared and
   * rewrote them would turn a derived value into a written one as a side
   * effect of somebody fixing a postcode.
   */
  it('never touches visited or lastVisit, which may be derived rather than written', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({
      type: 'accommodation',
      visited: true,
      lastVisit: '2026-05-02',
    });

    await updatePlaceNote(app, settings, file, 'accommodation', input(), undefined, NOW);

    expect(frontmatter.visited).toBe(true);
    expect(frontmatter.lastVisit).toBe('2026-05-02');
  });

  it('clears a key it owns when the new value is empty, rather than letting it linger', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({
      type: 'accommodation',
      website: 'https://old.test',
      rating: 3,
      tags: ['quiet'],
    });

    await updatePlaceNote(app, settings, file, 'accommodation', input(), undefined, NOW);

    expect('website' in frontmatter).toBe(false);
    expect('rating' in frontmatter).toBe(false);
    expect('tags' in frontmatter).toBe(false);
  });

  it('leaves a subtype key belonging to another kind exactly where it found it', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({
      type: 'landmark',
      accommodationType: 'typed here by hand',
    });

    await updatePlaceNote(app, settings, file, 'landmark', input(), undefined, NOW);

    expect(frontmatter.accommodationType).toBe('typed here by hand');
  });

  it('stamps modified on every write', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({ type: 'landmark' });
    await updatePlaceNote(app, settings, file, 'landmark', input(), undefined, NOW);
    expect(frontmatter.modified).toBe('2026-09-10T09:15');
  });

  it('skips the stamp when the setting is blank, rather than falling back to a name', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({ type: 'landmark' });
    await updatePlaceNote(
      app,
      { ...settings, modifiedProperty: '' },
      file,
      'landmark',
      input(),
      undefined,
      NOW
    );
    expect('modified' in frontmatter).toBe(false);
  });
});

describe('a cover written in the same pass', () => {
  /**
   * One dialog edits the note's own fields and its cover, so one write puts
   * both in: two passes over one file are two vault writes and two cache
   * invalidations for one logical edit.
   */
  it('writes the cover beside the fields the type owns', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({ type: 'landmark' });

    await updatePlaceNote(
      app,
      settings,
      file,
      'landmark',
      input({ website: 'https://example.test' }),
      { description: 'On the square.', image: 'Attachments/x.jpg', gallery: [], highlights: [] },
      NOW
    );

    expect(frontmatter.website).toBe('https://example.test');
    expect(frontmatter.description).toBe('On the square.');
    expect(frontmatter.image).toBe('Attachments/x.jpg');
  });

  it('clears a cover key emptied in the dialog', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({
      type: 'landmark',
      image: 'Attachments/old.jpg',
      description: 'Was here.',
    });

    await updatePlaceNote(
      app,
      settings,
      file,
      'landmark',
      input(),
      { description: null, image: null, gallery: [], highlights: [] },
      NOW
    );

    expect('image' in frontmatter).toBe(false);
    expect('description' in frontmatter).toBe(false);
  });

  /** Without a cover to write, those keys are not this call's business and must survive it. */
  it('leaves the cover alone when it was not given one', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({
      type: 'landmark',
      image: 'Attachments/old.jpg',
      description: 'Was here.',
    });

    await updatePlaceNote(app, settings, file, 'landmark', input(), undefined, NOW);

    expect(frontmatter.image).toBe('Attachments/old.jpg');
    expect(frontmatter.description).toBe('Was here.');
  });
});

describe('placeToInput', () => {
  it('round-trips a place read from the vault', () => {
    const place = {
      kind: 'fnb',
      countryTitle: 'Switzerland',
      cityTitle: 'Brugg',
      geoLocation: ['47.4818', '8.2085'],
      address: 'Bahnhofstrasse 12',
      website: 'https://example.test',
      rating: 4,
      tags: ['coffee'],
      accommodationType: null,
      accommodationStatus: null,
      fnbType: 'Cafe',
    } as unknown as TravelPlace;

    expect(placeToInput(place)).toEqual({
      countryTitle: 'Switzerland',
      cityTitle: 'Brugg',
      geoLocation: ['47.4818', '8.2085'],
      address: 'Bahnhofstrasse 12',
      website: 'https://example.test',
      rating: 4,
      tags: ['coffee'],
      accommodationType: null,
      accommodationStatus: null,
      fnbType: 'Cafe',
    });
  });

  /** A copy, not the note's own arrays: an editor that mutates its form state must not reach back into the board. */
  it('copies the arrays it carries', () => {
    const place = { tags: ['coffee'], geoLocation: ['1', '2'] } as unknown as TravelPlace;
    const first = placeToInput(place);
    first.tags.push('late');
    expect(place.tags).toEqual(['coffee']);
    expect(placeToInput(place).geoLocation).not.toBe(place.geoLocation);
  });
});
