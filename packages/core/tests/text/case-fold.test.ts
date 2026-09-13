/**
 * The fold, and the bug it exists for.
 *
 * The two spellings are written with escapes rather than with the characters
 * themselves, because a test file is a file: an editor, a formatter or a copy
 * through a clipboard could normalize the source and quietly turn the pair into
 * one string, at which point every assertion below would pass for the wrong
 * reason.
 */
import { describe, expect, it } from 'vitest';
import { caseFold } from '../../src/text/case-fold';

/** "Beef Stroganoff mit Spaetzli", as a file name saved on macOS: a plus a combining diaeresis. */
const DECOMPOSED = 'Beef Stroganoff mit Spätzli';
/** The same title, as it arrives pasted into frontmatter: one composed character. */
const COMPOSED = 'Beef Stroganoff mit Spätzli';

describe('the two spellings are really two', () => {
  it('does not compare equal without folding', () => {
    expect(DECOMPOSED).not.toBe(COMPOSED);
    expect(DECOMPOSED.trim().toLowerCase()).not.toBe(COMPOSED.trim().toLowerCase());
  });

  it('has the same length to a reader and a different one to the runtime', () => {
    expect([...DECOMPOSED].length).toBe([...COMPOSED].length + 1);
  });
});

describe('caseFold', () => {
  it('folds both spellings to one key', () => {
    expect(caseFold(DECOMPOSED)).toBe(caseFold(COMPOSED));
  });

  it('composes rather than decomposes, so one code point comes out', () => {
    expect(caseFold(DECOMPOSED)).toBe('beef stroganoff mit spätzli');
  });

  it('still trims and lower-cases, which is what every caller wanted from it', () => {
    expect(caseFold('  Zürcher Geschnetzeltes  ')).toBe(caseFold('zürcher geschnetzeltes'));
  });

  it('leaves an ASCII value exactly where trim and lower-case left it', () => {
    // The reason it is safe to fold a fixed vocabulary as well as a name: on
    // 'true', 'none' or 'outbound' the fold is the old expression to the letter.
    for (const value of ['true', ' None ', 'outbound', 'personNight']) {
      expect(caseFold(value)).toBe(value.trim().toLowerCase());
    }
  });

  it('folds a nullish name to the empty string rather than to undefined', () => {
    // So a caller may compare two optional names without deciding first whether
    // absent equals absent. It does not: '' is falsy, and every caller here
    // guards on that before treating a fold as a key.
    expect(caseFold(null)).toBe('');
    expect(caseFold(undefined)).toBe('');
    expect(caseFold('   ')).toBe('');
  });

  it('folds the Norwegian place names a trip is full of', () => {
    // Ålesund, Svolvær and Tromsø resolve today only because those note files
    // happen to be composed. The fold is what stops a rename deciding it.
    for (const name of ['Ålesund', 'Svolvær', 'Tromsø']) {
      expect(caseFold(name)).toBe(caseFold(name.normalize('NFD')));
    }
  });
});
