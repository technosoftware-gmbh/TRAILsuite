/**
 * The excursion note's own format, read and written.
 *
 * Round-tripped against the builder rather than against a hand-written
 * fixture, for the reason the vehicle's suite gives: a fixture drifts from
 * what is really written and the two halves stop being each other's mirror.
 *
 * The one thing worth stating out loud here is what is NOT in the schema. An
 * excursion carries no price and no catalogue: the same tour is sold at a
 * different figure on every trip that offers it, so the money lives on the
 * stop. A test cannot assert the absence of a field somebody has yet to add,
 * so what it asserts instead is that the managed-key list -- the set an edit
 * clears before writing -- stays exactly the fields this note owns.
 */
import { describe, expect, it } from 'vitest';
import {
  buildExcursionFrontmatter,
  ExcursionPropertyNames,
  excursionManagedKeys,
  excursionToInput,
  parseExcursion,
} from '../src/places/excursion-note';
import { excursionProperties } from '../src/vault/read-entities';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const P: ExcursionPropertyNames = excursionProperties(DEFAULT_SETTINGS);

const FULL = {
  description: 'Chapman’s Peak and the penguins, in one day.',
  operatorTitle: 'Peninsula Tours',
  duration: 'About 8 hours',
  countryTitle: 'South Africa',
  cityTitle: 'Cape Town',
  website: 'https://example.invalid/by-road',
};

describe('an excursion note', () => {
  it('round-trips everything a form collects', () => {
    const yaml = buildExcursionFrontmatter(FULL, P);
    const parsed = parseExcursion(yaml, P);

    expect(excursionToInput(parsed)).toEqual(FULL);
  });

  it('writes its three links as wikilinks and reads them back down to titles', () => {
    const yaml = buildExcursionFrontmatter(FULL, P);

    expect(yaml[P.operatorProperty]).toBe('[[Peninsula Tours]]');
    expect(yaml[P.countryProperty]).toBe('[[South Africa]]');
    expect(yaml[P.cityProperty]).toBe('[[Cape Town]]');
    expect(parseExcursion(yaml, P).operatorTitle).toBe('Peninsula Tours');
  });

  it('omits what it has nothing to say about rather than writing it empty', () => {
    const yaml = buildExcursionFrontmatter(
      { ...FULL, duration: null, website: '   ', operatorTitle: null },
      P
    );

    expect(P.durationProperty in yaml).toBe(false);
    expect(P.websiteProperty in yaml).toBe(false);
    expect(P.operatorProperty in yaml).toBe(false);
  });

  it('reads an absent field as unset rather than throwing', () => {
    const parsed = parseExcursion({}, P);

    expect(parsed.description).toBeNull();
    expect(parsed.duration).toBeNull();
    expect(parsed.operatorTitle).toBeNull();
    expect(parsed.gallery).toEqual([]);
  });

  it('takes an operator written as plain text, not only as a link', () => {
    // The vehicle reads it the same way, and for the same reason: an operator
    // typed before the Company note exists is still who runs the tour.
    expect(parseExcursion({ [P.operatorProperty]: 'Peninsula Tours' }, P).operatorTitle).toBe(
      'Peninsula Tours'
    );
  });

  it('reads a gallery entry only when it names a picture', () => {
    const parsed = parseExcursion(
      {
        [P.galleryProperty]: [
          { [P.galleryImageField]: 'a.png', [P.galleryCaptionField]: 'The cape' },
          { [P.galleryCaptionField]: 'A caption with no picture' },
          'not an entry at all',
        ],
      },
      P
    );

    expect(parsed.gallery).toEqual([{ image: 'a.png', caption: 'The cape' }]);
  });

  it('owns its own six fields and neither the picture nor the gallery', () => {
    const managed = excursionManagedKeys(P);

    expect(managed).toEqual([
      P.descriptionProperty,
      P.operatorProperty,
      P.durationProperty,
      P.countryProperty,
      P.cityProperty,
      P.websiteProperty,
    ]);
    // The boundary that keeps an edit from deleting a picture nobody asked it
    // to touch. Both are read by this schema and written by other hands.
    expect(managed).not.toContain(P.imageProperty);
    expect(managed).not.toContain(P.galleryProperty);
  });
});

/**
 * The highlights, read but not owned.
 *
 * They are the cover's to write and clear -- `write-cover.ts` -- and this
 * schema only reads them, exactly as it reads `image` and `gallery`. Asserted
 * here because reading them is what the prospect prints from, and because the
 * managed-key list must NOT grow: an excursion editor that cleared them would
 * delete a list the note cover had just written.
 */
describe("an excursion's highlights", () => {
  it('reads the lines the note carries, in its own order', () => {
    expect(parseExcursion({ highlights: ['Viking House', 'Domsteinene'] }, P).highlights).toEqual([
      'Viking House',
      'Domsteinene',
    ]);
  });

  /** A highlight is a sentence: splitting on a comma would make one of these two. */
  it('keeps a line that has a comma in it whole', () => {
    expect(parseExcursion({ highlights: ['Oslo, die Hauptstadt'] }, P).highlights).toEqual([
      'Oslo, die Hauptstadt',
    ]);
  });

  it('reads a hand-typed single value as one highlight', () => {
    expect(parseExcursion({ highlights: 'Viking House' }, P).highlights).toEqual(['Viking House']);
  });

  it('reads a note that says nothing as none', () => {
    expect(parseExcursion({}, P).highlights).toEqual([]);
  });

  /** The cover owns and clears them. This list growing would mean two owners. */
  it('is not a key this schema clears', () => {
    expect(excursionManagedKeys(P)).not.toContain(P.highlightsProperty);
  });
});
