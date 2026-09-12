/**
 * Frontmatter tag reading and matching.
 *
 * The nested-tag rule and the empty-filter rule are the two that carry
 * behaviour beyond the obvious, and both are load-bearing for the person
 * eligibility filter.
 */
import { describe, expect, it } from 'vitest';
import {
  filterByTags,
  matchesAnyTag,
  parseTagFilter,
  readTags,
  tagMatches,
} from '../../src/crm/tags.js';

describe('readTags', () => {
  it('reads a list, which is what Obsidian writes', () => {
    expect(readTags(['Family', 'Work'])).toEqual(['Family', 'Work']);
  });

  it('reads a single bare value, which is what a hand-edited note holds', () => {
    expect(readTags('Family')).toEqual(['Family']);
  });

  it('splits a comma-separated string, which is what an import produces', () => {
    expect(readTags('Family, Work')).toEqual(['Family', 'Work']);
  });

  it('strips a leading hash', () => {
    // Obsidian's property editor writes tags without one, but a person typing
    // a tag by hand writes #Family, because that is what a tag looks like
    // everywhere else in the app. Treating those as two tags is a distinction
    // nobody means.
    expect(readTags(['#Family', 'Work'])).toEqual(['Family', 'Work']);
    expect(readTags('#Family, #Work')).toEqual(['Family', 'Work']);
  });

  it('keeps a nested tag intact', () => {
    expect(readTags('Family/Close')).toEqual(['Family/Close']);
  });

  it('drops blanks and non-strings', () => {
    expect(readTags(['Family', '', '  ', null, 4, '#'])).toEqual(['Family']);
    expect(readTags(undefined)).toEqual([]);
    expect(readTags(null)).toEqual([]);
  });
});

describe('tagMatches', () => {
  it('matches an exact tag regardless of case', () => {
    // Obsidian's own tag search is case-insensitive, so a filter that was not
    // would disagree with what the search bar in the same vault does.
    expect(tagMatches('Family', 'family')).toBe(true);
    expect(tagMatches('family', 'Family')).toBe(true);
  });

  it('matches a nested child against its parent', () => {
    // Filtering on Family and not getting the person tagged Family/Close is
    // the opposite of what somebody typing "Family" means.
    expect(tagMatches('Family/Close', 'Family')).toBe(true);
    expect(tagMatches('Family/Close/Sibling', 'Family')).toBe(true);
  });

  it('does not match a parent against its child', () => {
    // The relationship is one-way: Family/Close is more specific, so asking
    // for it should not return people who are merely Family.
    expect(tagMatches('Family', 'Family/Close')).toBe(false);
  });

  it('does not match a tag that merely starts with the filter', () => {
    // The boundary check. A plain startsWith would pull in FamilyBusiness,
    // which is a different tag entirely.
    expect(tagMatches('FamilyBusiness', 'Family')).toBe(false);
  });

  it('never matches a blank on either side', () => {
    expect(tagMatches('', 'Family')).toBe(false);
    expect(tagMatches('Family', '')).toBe(false);
  });
});

describe('matchesAnyTag', () => {
  it('matches when any tag satisfies any filter entry', () => {
    expect(matchesAnyTag(['Work', 'Family/Close'], ['Family'])).toBe(true);
    expect(matchesAnyTag(['Work'], ['Family', 'Work'])).toBe(true);
  });

  it('does not match when nothing overlaps', () => {
    expect(matchesAnyTag(['Work'], ['Family'])).toBe(false);
    expect(matchesAnyTag([], ['Family'])).toBe(false);
  });

  it('matches everything when the filter is empty', () => {
    // The permissive-empty rule, in the one place it is implemented. Getting
    // this backwards would empty the person selector in every vault that has
    // not configured the filter, which is most of them.
    expect(matchesAnyTag([], [])).toBe(true);
    expect(matchesAnyTag(['Work'], [])).toBe(true);
  });
});

describe('parseTagFilter', () => {
  it('parses the comma-separated settings value', () => {
    expect(parseTagFilter('Family, Work')).toEqual(['Family', 'Work']);
    expect(parseTagFilter('#Family')).toEqual(['Family']);
  });

  it('treats a blank setting as no filter at all', () => {
    expect(parseTagFilter('')).toEqual([]);
    expect(parseTagFilter('   ')).toEqual([]);
    expect(parseTagFilter(', ,')).toEqual([]);
  });
});

describe('filterByTags', () => {
  const people = [
    { title: 'Erika', tags: ['Familie'] },
    { title: 'Piet', tags: ['Familie/Eltern'] },
    { title: 'Gaby', tags: ['Freunde'] },
    { title: 'Nobody', tags: [] },
  ];

  it('admits everyone when the filter is empty, never nobody', () => {
    expect(filterByTags(people, []).map((p) => p.title)).toEqual([
      'Erika',
      'Piet',
      'Gaby',
      'Nobody',
    ]);
  });

  it('keeps the ones a filter tag admits, nested children included', () => {
    expect(filterByTags(people, ['Familie']).map((p) => p.title)).toEqual(['Erika', 'Piet']);
  });

  it('drops an untagged record once a filter is set', () => {
    expect(filterByTags(people, ['Freunde']).map((p) => p.title)).toEqual(['Gaby']);
  });
});
