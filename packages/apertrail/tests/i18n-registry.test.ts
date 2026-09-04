/**
 * The locale registry: the one list a language is declared in.
 *
 * The rule worth pinning down is that English is the base language in both
 * directions. Every other table is measured against it by the type system,
 * and this suite checks the same thing at runtime, because a table that
 * reaches the plugin through a cast or a hand-edited file would otherwise
 * carry keys nothing ever reads.
 */
import { describe, expect, it } from 'vitest';
import { FALLBACK_LOCALE, LOCALES, localeEntry } from '../src/lang/translations';
import { LocaleData } from '../src/lang/types';

function keyPaths(table: LocaleData, prefix = ''): string[] {
  return Object.entries(table).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : keyPaths(value, path);
  });
}

describe('the registry', () => {
  it('registers English, and registers it as the fallback', () => {
    expect(LOCALES.some((locale) => locale.code === FALLBACK_LOCALE)).toBe(true);
  });

  it('has no duplicate codes', () => {
    const codes = LOCALES.map((locale) => locale.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  // A locale without a table cannot be registered: that state is what the
  // three old lists disagreed about.
  it('gives every registered locale a table with something in it', () => {
    for (const locale of LOCALES) {
      expect(Object.keys(locale.table).length).toBeGreaterThan(0);
    }
  });
});

describe('localeEntry', () => {
  it('matches an exact code', () => {
    expect(localeEntry('de')?.code).toBe('de');
  });

  it('matches regardless of case', () => {
    expect(localeEntry('DE')?.code).toBe('de');
  });

  // Obsidian reports de-AT and en-GB; a table for the plain language should
  // answer both, and a future region-specific table should answer a vault
  // that reports only the language.
  it('matches a region tag against the language, and the other way round', () => {
    expect(localeEntry('de-AT')?.code).toBe('de');
    expect(localeEntry('en-GB')?.code).toBe('en');
  });

  it('answers nothing for a language nobody has translated', () => {
    expect(localeEntry('es')).toBeUndefined();
    expect(localeEntry('')).toBeUndefined();
  });
});

describe('every locale against English', () => {
  const english = LOCALES.find((locale) => locale.code === FALLBACK_LOCALE);
  const englishKeys = new Set(keyPaths(english?.table ?? {}));

  for (const locale of LOCALES.filter((entry) => entry.code !== FALLBACK_LOCALE)) {
    // A key English does not have can never be read: every t() call site is
    // written against English, and the lookup falls back to it.
    it(`${locale.code} invents no keys of its own`, () => {
      const unknown = keyPaths(locale.table).filter((key) => !englishKeys.has(key));
      expect(unknown).toEqual([]);
    });
  }
});
