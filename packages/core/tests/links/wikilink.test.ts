/**
 * The two readings, and the fact that they stay two.
 *
 * The strict and lenient readers came from opposite decisions in different
 * plugins. The test that matters most is the pair pinning them apart: if someone
 * later "unifies" them, one plugin starts inventing references out of stray text
 * or the other stops reading properties people wrote by hand.
 */
import { describe, expect, it } from 'vitest';
import {
  formatWikilink,
  linkOrText,
  linkOrTextList,
  stripWikilink,
  titlesMatch,
  toWikilink,
  wikilinkTarget,
  wikilinkTargets,
  wikilinkValue,
} from '../../src/links/wikilink';

describe('strict and lenient disagree, on purpose', () => {
  it('reads a real link identically', () => {
    expect(wikilinkTarget('[[TomTasty AG]]')).toBe('TomTasty AG');
    expect(linkOrText('[[TomTasty AG]]')).toBe('TomTasty AG');
  });

  it('parts company on plain text', () => {
    expect(wikilinkTarget('TomTasty AG')).toBeNull();
    expect(linkOrText('TomTasty AG')).toBe('TomTasty AG');
  });
});

describe('wikilinkTarget', () => {
  it('drops the display alias, which is not the target', () => {
    expect(wikilinkTarget('[[Foo|Bar]]')).toBe('Foo');
  });

  it('follows a heading or block reference to the note itself', () => {
    expect(wikilinkTarget('[[Note#Section]]')).toBe('Note');
    expect(wikilinkTarget('[[Note^block]]')).toBe('Note');
  });

  it('reads an embed as the file it embeds', () => {
    expect(wikilinkTarget('![[photo.jpg]]')).toBe('photo.jpg');
  });

  it('refuses anything that merely contains a link', () => {
    expect(wikilinkTarget('see [[Foo]] for more')).toBeNull();
  });

  it('returns null for an empty target, a non-string and a blank', () => {
    expect(wikilinkTarget('[[]]')).toBeNull();
    expect(wikilinkTarget('[[   ]]')).toBeNull();
    expect(wikilinkTarget(42)).toBeNull();
    expect(wikilinkTarget(null)).toBeNull();
    expect(wikilinkTarget(undefined)).toBeNull();
  });
});

describe('wikilinkTargets', () => {
  it('reads a list', () => {
    expect(wikilinkTargets(['[[A]]', '[[B]]'])).toEqual(['A', 'B']);
  });

  it('accepts a single unwrapped value as a one-element list', () => {
    expect(wikilinkTargets('[[A]]')).toEqual(['A']);
  });

  it('drops entries that are not links rather than guessing at them', () => {
    expect(wikilinkTargets(['[[A]]', 'B', 7])).toEqual(['A']);
  });
});

describe('linkOrTextList', () => {
  it('reads a list of links', () => {
    expect(linkOrTextList(['[[A]]', '[[B]]'])).toEqual(['A', 'B']);
  });

  it('pulls several links out of one string', () => {
    expect(linkOrTextList('[[A]] and [[B]]')).toEqual(['A', 'B']);
  });

  it('treats a string with no links in it as one plain target', () => {
    expect(linkOrTextList('Just a name')).toEqual(['Just a name']);
  });

  it('keeps plain and linked entries side by side', () => {
    expect(linkOrTextList(['[[A]]', 'B'])).toEqual(['A', 'B']);
  });
});

describe('stripWikilink', () => {
  it('unwraps an embed, which is what an image property holds', () => {
    expect(stripWikilink('![[photo.jpg]]')).toBe('photo.jpg');
    expect(stripWikilink('[[photo.jpg]]')).toBe('photo.jpg');
  });

  it('leaves a bare path alone', () => {
    expect(stripWikilink('Attachments/photo.jpg')).toBe('Attachments/photo.jpg');
  });

  it('drops an alias and a subpath', () => {
    expect(stripWikilink('[[photo.jpg|thumb]]')).toBe('photo.jpg');
    expect(stripWikilink('[[Note#Heading]]')).toBe('Note');
  });
});

describe('writing links back', () => {
  it('produces an unquoted value for a serializer to quote', () => {
    expect(wikilinkValue('TomTasty AG')).toBe('[[TomTasty AG]]');
    expect(toWikilink('TomTasty AG')).toBe('[[TomTasty AG]]');
  });

  it('produces a quoted one for hand-built YAML', () => {
    expect(formatWikilink('TomTasty AG')).toBe('"[[TomTasty AG]]"');
  });

  it('round trips through the strict reader', () => {
    expect(wikilinkTarget(wikilinkValue('Zürcher Geschnetzeltes'))).toBe('Zürcher Geschnetzeltes');
  });
});

describe('titlesMatch', () => {
  it('ignores case and surrounding space, as link resolution does', () => {
    expect(titlesMatch('Beef Stroganoff', ' beef stroganoff ')).toBe(true);
  });

  it('is false when either side is missing', () => {
    expect(titlesMatch(null, 'A')).toBe(false);
    expect(titlesMatch('A', undefined)).toBe(false);
    expect(titlesMatch('', 'A')).toBe(false);
  });
});
