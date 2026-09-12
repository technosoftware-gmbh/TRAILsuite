/**
 * Plural forms, and the one rule that matters: the call site passes a
 * count and says nothing about grammar.
 *
 * The `{plural}` placeholder this replaces held an English "s". It was
 * already wrong in the other locale this plugin ships ("Notizs"), and no
 * amount of it can reach a language with four categories.
 */
import { describe, expect, it } from 'vitest';
import { isPluralForms, selectPluralForm } from '../src/lang/plural';
import { t } from '../src/lang/I18nManager';

describe('selectPluralForm', () => {
  const forms = { one: 'one note', other: 'many notes' };

  it('picks the category the language asks for', () => {
    expect(selectPluralForm(forms, 1, 'en')).toBe('one note');
    expect(selectPluralForm(forms, 2, 'en')).toBe('many notes');
    expect(selectPluralForm(forms, 0, 'en')).toBe('many notes');
  });

  // A translator who has written only `other` still gets a sentence rather
  // than a key path, which is what makes a partial translation usable.
  it('falls back to other for a category the table has not filled in', () => {
    expect(selectPluralForm({ other: 'заметки' }, 2, 'ru')).toBe('заметки');
  });

  it('survives a locale tag Intl cannot parse', () => {
    expect(selectPluralForm(forms, 2, 'not a locale')).toBe('many notes');
  });
});

describe('isPluralForms', () => {
  it('recognizes a set of forms', () => {
    expect(isPluralForms({ one: 'a', other: 'b' })).toBe(true);
    expect(isPluralForms({ zero: 'a', two: 'b', few: 'c', many: 'd', other: 'e' })).toBe(true);
  });

  // A nested group of keys is not a plural set, however small it is.
  it('does not mistake an ordinary group for one', () => {
    expect(isPluralForms({ main: 'a', secondary: 'b' })).toBe(false);
    expect(isPluralForms({})).toBe(false);
    expect(isPluralForms('a string')).toBe(false);
    expect(isPluralForms(null)).toBe(false);
  });
});

describe('t() over a plural key', () => {
  // The suite runs in English (tests/setup.ts).
  it('renders the singular for one and the plural for the rest', () => {
    expect(t('dashboard.stopCount', { count: 1 })).toBe('1 stop');
    expect(t('dashboard.stopCount', { count: 4 })).toBe('4 stops');
  });

  // Without a count there is no category to select, and a plural key
  // rendered as an object would be worse than rendering the key itself.
  it('returns the key when a plural entry is asked for without a count', () => {
    expect(t('dashboard.stopCount')).toBe('dashboard.stopCount');
  });
});
