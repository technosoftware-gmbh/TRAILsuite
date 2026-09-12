/**
 * What a note's cover writes, and what it is allowed to clear.
 *
 * `description`, `image` and `gallery` were read by everything and owned by
 * nothing: the vehicle editor deliberately left the last two out of its
 * managed keys, because an editor that cleared what it did not put there would
 * delete a picture nobody asked it to touch. This is the editor whose whole
 * job is those three, so it owns them -- which is what makes removing the last
 * gallery row remove the property rather than leave an empty list behind, and
 * is exactly the behaviour worth pinning.
 */
import { describe, expect, it } from 'vitest';
import { buildCoverFrontmatter, coverManagedKeys } from '../src/vault/write-cover';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const S = DEFAULT_SETTINGS;

describe('what a cover writes', () => {
  it('writes the three keys a note carries', () => {
    const yaml = buildCoverFrontmatter(
      {
        description: 'The Hurtigruten flagship.',
        image: 'Places/Vehicles/_resources/ship.jpg',
        gallery: [{ image: 'a.jpg', caption: 'On deck' }],
        highlights: [],
      },
      S
    );

    expect(yaml).toEqual({
      description: 'The Hurtigruten flagship.',
      image: 'Places/Vehicles/_resources/ship.jpg',
      gallery: [{ image: 'a.jpg', caption: 'On deck' }],
    });
  });

  /** Absent rather than empty, the rule every builder here follows: a note that says nothing about its picture says nothing. */
  it('omits what the note says nothing about', () => {
    const yaml = buildCoverFrontmatter(
      { description: null, image: null, gallery: [], highlights: [] },
      S
    );

    expect(yaml).toEqual({});
  });

  it('omits a blank description rather than writing an empty line', () => {
    const yaml = buildCoverFrontmatter(
      { description: '   ', image: null, gallery: [], highlights: [] },
      S
    );

    expect(yaml).not.toHaveProperty('description');
  });

  /** A caption pointing at nothing is a row nothing could ever render, so it does not survive the save. */
  it('drops a gallery row with no picture', () => {
    const yaml = buildCoverFrontmatter(
      {
        description: null,
        image: null,
        gallery: [
          { image: '', caption: 'nothing to show' },
          { image: 'b.jpg', caption: null },
        ],
        highlights: [],
      },
      S
    );

    expect(yaml.gallery).toEqual([{ image: 'b.jpg' }]);
  });

  it('omits a caption nobody wrote rather than writing it empty', () => {
    const yaml = buildCoverFrontmatter(
      {
        description: null,
        image: null,
        gallery: [{ image: 'b.jpg', caption: '  ' }],
        highlights: [],
      },
      S
    );

    expect(yaml.gallery).toEqual([{ image: 'b.jpg' }]);
  });

  it('trims what somebody pasted with a space on the end', () => {
    const yaml = buildCoverFrontmatter(
      { description: ' A line. ', image: ' a.jpg ', gallery: [], highlights: [] },
      S
    );

    expect(yaml).toEqual({ description: 'A line.', image: 'a.jpg' });
  });

  it('writes through the configured property names rather than literals', () => {
    const yaml = buildCoverFrontmatter(
      {
        description: 'x',
        image: 'a.jpg',
        gallery: [{ image: 'b.jpg', caption: 'c' }],
        highlights: [],
      },
      { ...S, descriptionProperty: 'kurz', imageProperty: 'bild', tripGalleryProperty: 'bilder' }
    );

    expect(Object.keys(yaml).sort()).toEqual(['bild', 'bilder', 'kurz']);
  });
});

describe('what a cover owns', () => {
  /** Cleared before the write, which is what makes an emptied gallery remove the property. */
  it('owns exactly the keys it writes', () => {
    expect(coverManagedKeys(S).sort()).toEqual(['description', 'gallery', 'highlights', 'image']);
  });

  /** A ship's cabins, a place's rating, anything hand-added: this must not name them. */
  it('owns nothing else on the note', () => {
    const owned = coverManagedKeys(S);

    expect(owned).not.toContain(S.vehicleCabinsProperty);
    expect(owned).not.toContain(S.ratingProperty);
    expect(owned).not.toContain(S.vehicleDeckPlanProperty);
  });

  it('follows the settings when the names are changed', () => {
    expect(coverManagedKeys({ ...S, imageProperty: 'bild' })).toContain('bild');
  });
});

/**
 * The highlights, which were a trip's alone until an excursion's page wanted
 * the same three lines.
 *
 * They ride here rather than on each type's own schema for the reason the
 * other keys do: read by everything, owned by nothing, and an editor that
 * cleared what it did not put there would delete somebody's list. This is the
 * editor whose job they are, so it owns them -- which is what makes emptying
 * the box remove the property rather than leave `highlights: []` behind.
 */
describe('what a cover writes for highlights', () => {
  const cover = (highlights: string[]) => ({
    description: null,
    image: null,
    gallery: [],
    highlights,
  });

  it('writes the lines in the order they were given', () => {
    expect(buildCoverFrontmatter(cover(['Nordkap', 'Hammerfest']), S).highlights).toEqual([
      'Nordkap',
      'Hammerfest',
    ]);
  });

  /** The box is one line each, so a blank line is somebody pressing return rather than a highlight. */
  it('drops a blank line and trims the rest', () => {
    expect(buildCoverFrontmatter(cover([' Nordkap ', '', '   ']), S).highlights).toEqual([
      'Nordkap',
    ]);
  });

  it('omits the property rather than writing an empty list', () => {
    expect(buildCoverFrontmatter(cover([]), S)).not.toHaveProperty('highlights');
    expect(buildCoverFrontmatter(cover(['  ']), S)).not.toHaveProperty('highlights');
  });

  it('writes through the configured name rather than a literal', () => {
    const yaml = buildCoverFrontmatter(cover(['Nordkap']), {
      ...S,
      tripHighlightsProperty: 'hoehepunkte',
    });

    expect(yaml).toEqual({ hoehepunkte: ['Nordkap'] });
  });

  /** The trip's own property, so a vault that renames it renames it once. */
  it("shares the trip's property, rather than inventing a second name", () => {
    expect(coverManagedKeys(S)).toContain(S.tripHighlightsProperty);
  });
});
