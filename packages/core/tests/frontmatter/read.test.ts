/**
 * The defensive readers, and the merged `findValue`.
 *
 * `findValue` came from two implementations that disagreed: one matched keys
 * without regard to case, the other took a list of aliases and skipped blanks.
 * The merged one does all three, so the tests worth reading are the ones showing
 * each side gained the other's behaviour rather than losing its own.
 */
import { describe, expect, it } from 'vitest';
import {
  findValue,
  readBooleanLike,
  readNumberLike,
  readString,
  readStringList,
} from '../../src/frontmatter/read';

describe('readString', () => {
  it('trims, and treats blank as unset', () => {
    expect(readString('  Basel  ')).toBe('Basel');
    expect(readString('   ')).toBeNull();
    expect(readString('')).toBeNull();
  });

  it('refuses anything that is not a string', () => {
    expect(readString(4)).toBeNull();
    expect(readString(['a'])).toBeNull();
    expect(readString(null)).toBeNull();
  });
});

describe('readNumberLike', () => {
  it('reads a number stored either way', () => {
    expect(readNumberLike(4)).toBe(4);
    expect(readNumberLike('4')).toBe(4);
    expect(readNumberLike(' 17.50 ')).toBe(17.5);
  });

  it('reads zero, which is a value and not an absence', () => {
    expect(readNumberLike(0)).toBe(0);
    expect(readNumberLike('0')).toBe(0);
  });

  it('does not read a blank as zero', () => {
    // Number('') is 0, which is the trap this guards.
    expect(readNumberLike('')).toBeNull();
    expect(readNumberLike('   ')).toBeNull();
  });

  it('refuses text and non-finite values', () => {
    expect(readNumberLike('four')).toBeNull();
    expect(readNumberLike(Number.NaN)).toBeNull();
    expect(readNumberLike(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('readBooleanLike', () => {
  it('reads the spellings a person actually types', () => {
    for (const yes of [true, 'true', 'Yes', 'y', '1']) expect(readBooleanLike(yes)).toBe(true);
    for (const no of [false, 'false', 'No', 'n', '0']) expect(readBooleanLike(no)).toBe(false);
  });

  it('is null for anything else, rather than guessing', () => {
    expect(readBooleanLike('maybe')).toBeNull();
    expect(readBooleanLike(2)).toBeNull();
    expect(readBooleanLike(null)).toBeNull();
  });
});

describe('readStringList', () => {
  it('reads a list, a single value, and a comma-separated string', () => {
    expect(readStringList(['a', 'b'])).toEqual(['a', 'b']);
    expect(readStringList('a')).toEqual(['a']);
    expect(readStringList('vegetarian, gluten-free')).toEqual(['vegetarian', 'gluten-free']);
  });

  it('drops blanks and non-strings', () => {
    expect(readStringList(['a', '', '  ', 7, null])).toEqual(['a']);
    expect(readStringList(undefined)).toEqual([]);
  });
});

describe('findValue', () => {
  const fm = { country: '[[Switzerland]]', servings: 4, blank: '', Yield: 6 };

  it('finds a key by its exact name', () => {
    expect(findValue(fm, 'country')).toBe('[[Switzerland]]');
  });

  it('finds a key whose case differs from the configured name', () => {
    // The behaviour one side had: a note is hand-edited, so `Yield:` should
    // answer to `yield`.
    expect(findValue(fm, 'yield')).toBe(6);
  });

  it('tries names in order, so a vault name wins over an alias', () => {
    expect(findValue(fm, 'servings', 'yield')).toBe(4);
    expect(findValue(fm, 'portions', 'yield')).toBe(6);
  });

  it('falls through a blank value to the next alias', () => {
    // The behaviour the other side had: a property left blank is unset rather
    // than an answer.
    expect(findValue(fm, 'blank', 'servings')).toBe(4);
    expect(findValue(fm, 'blank')).toBeUndefined();
  });

  it('is undefined for no match, no names, and no frontmatter', () => {
    expect(findValue(fm, 'nothing')).toBeUndefined();
    expect(findValue(fm)).toBeUndefined();
    expect(findValue(null, 'country')).toBeUndefined();
    expect(findValue(undefined, 'country')).toBeUndefined();
  });

  it('ignores an empty name rather than matching an empty key', () => {
    expect(findValue({ '': 'x' }, '')).toBeUndefined();
  });

  it('resolves a case collision the same way every time', () => {
    // First key in the note's own order wins, so two properties differing only
    // in case cannot make the reading depend on lookup order.
    expect(findValue({ Servings: 1, servings: 2 }, 'servings')).toBe(1);
    expect(findValue({ servings: 2, Servings: 1 }, 'servings')).toBe(2);
  });
});
