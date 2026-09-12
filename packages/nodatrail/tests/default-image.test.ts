/**
 * The picture a project falls back to when it has none.
 *
 * A convention over a folder: `Default` claims every project, `CN-Default`
 * claims the ones whose title starts with `CN-`, and the longest matching
 * prefix wins. It exists because the work arrives in families -- fifteen
 * company projects all wanting one picture is fifteen notes to edit by hand and
 * a sixteenth to forget.
 *
 * The cases below are the ones where a convention like this goes wrong: a
 * prefix that matches the middle of a title rather than its start, two families
 * where one name contains the other, and the word appearing in a filename that
 * was never meant as a default at all.
 */
import { describe, expect, it } from 'vitest';
import { defaultImageStem } from '../src/para/default-image';

const WORD = 'Default';

describe('choosing a fallback picture', () => {
  it('takes the general one when that is all there is', () => {
    expect(defaultImageStem('CN-1097838', ['Default'], WORD)).toBe('Default');
  });

  it('prefers the family over the general one', () => {
    expect(defaultImageStem('CN-1097838', ['Default', 'CN-Default'], WORD)).toBe('CN-Default');
  });

  /** The whole reason prefixes are compared by length rather than found first. */
  it('takes the longest prefix that claims the title', () => {
    const stems = ['Default', 'C-Default', 'CN-Default'];

    expect(defaultImageStem('CN-1097838', stems, WORD)).toBe('CN-Default');
    expect(defaultImageStem('C-4711', stems, WORD)).toBe('C-Default');
    expect(defaultImageStem('Umbau Küche', stems, WORD)).toBe('Default');
  });

  it('ignores a family the title does not belong to', () => {
    expect(defaultImageStem('Umbau Küche', ['CN-Default'], WORD)).toBeNull();
  });

  /**
   * A prefix claims the *start* of a title. Matching anywhere would give every
   * project with `CN-` in the middle of its name somebody else's picture.
   */
  it('matches the start of the title and not the middle', () => {
    expect(defaultImageStem('Umbau CN-Halle', ['CN-Default'], WORD)).toBeNull();
  });

  it('ignores case, because a folder does', () => {
    expect(defaultImageStem('cn-1097838', ['CN-Default'], WORD)).toBe('CN-Default');
    expect(defaultImageStem('CN-1097838', ['cn-default'], WORD)).toBe('cn-default');
  });

  /** A picture called `Defaults for the team` is not a default. */
  it('wants the word at the end of the name', () => {
    expect(defaultImageStem('CN-1097838', ['Default notes', 'CN-Defaults'], WORD)).toBeNull();
  });

  it('finds nothing among pictures that are not defaults at all', () => {
    expect(defaultImageStem('CN-1097838', ['Complaint', 'Fotografie'], WORD)).toBeNull();
  });

  describe('switching it off', () => {
    it('is a blank word, which claims nothing', () => {
      expect(defaultImageStem('CN-1097838', ['Default', 'CN-Default'], '')).toBeNull();
      expect(defaultImageStem('CN-1097838', ['Default'], '   ')).toBeNull();
    });

    /**
     * The case that actually proves the guard. With a blank word every name
     * ends with it, so the whole stem becomes the prefix -- and a picture
     * called `CN` would then claim `CN-1097838` on a setting somebody had
     * cleared precisely to stop that happening. The two assertions above pass
     * with the guard deleted; this one does not.
     */
    it('does not turn every picture into a prefix match', () => {
      expect(defaultImageStem('CN-1097838', ['CN'], '')).toBeNull();
    });

    it('is not the same as having no pictures, which also claims nothing', () => {
      expect(defaultImageStem('CN-1097838', [], WORD)).toBeNull();
    });
  });

  it('answers nothing for a project with no title', () => {
    expect(defaultImageStem('   ', ['Default'], WORD)).toBeNull();
  });

  /** The vault this was written for, spelled out. */
  it('gives the fifteen CN projects one picture from one file', () => {
    const stems = ['CN-Default'];

    for (const title of ['CN-1097838', 'CN-10945145', 'CN-4711']) {
      expect(defaultImageStem(title, stems, WORD)).toBe('CN-Default');
    }
    expect(defaultImageStem('365 Tage, jeden Tag ein Bild', stems, WORD)).toBeNull();
  });
});
