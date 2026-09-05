/**
 * What a meal field offers, and the one value it must never drop.
 *
 * The rule these pin is `supplier-options.ts`'s, and the cost of breaking it is
 * silent: a `<select>` whose value matches no option falls back to its first,
 * so an option list that omits what the note already says rewrites the note on
 * the next save without anybody pressing anything. A diet lost that way is a
 * badge changing colour; a product line lost that way moves a meal to another
 * range with different prices.
 */
import { describe, expect, it } from 'vitest';
import { companyHasRole } from '@technosoftware/trail-core';
import {
  joinValues,
  splitValues,
  vocabularyChoices,
  vocabularyOptions,
} from '../src/meals/editor/vocabulary';

describe('the options a single-valued field offers', () => {
  it('puts the preferred source first, then what the library uses', () => {
    // A supplier's published lines are the answer for a meal from that
    // supplier; the setting is the answer otherwise.
    expect(vocabularyOptions(['Balance', 'Fitness'], ['Classic'], null)).toEqual([
      'Balance',
      'Fitness',
      'Classic',
    ]);
  });

  it('keeps what the note says even when no source names it', () => {
    // The whole rule in one assertion.
    expect(vocabularyOptions(['Vegan'], ['Vegetarisch'], 'Pescetarisch')).toEqual([
      'Vegan',
      'Vegetarisch',
      'Pescetarisch',
    ]);
  });

  it('does not repeat a value the sources agree on', () => {
    expect(vocabularyOptions(['Vegan'], ['Vegan'], 'Vegan')).toEqual(['Vegan']);
  });

  it('treats two spellings of one value as one, keeping the first', () => {
    // A vault's `Vegan` and `vegan` are one diet and nobody would configure
    // both. The configured spelling wins, because it is the intended one.
    expect(vocabularyOptions(['Vegan'], ['vegan', 'VEGAN'], 'vEgAn')).toEqual(['Vegan']);
  });

  it('ignores blanks from a hand-edited setting', () => {
    expect(vocabularyOptions(['', '  ', 'Vegan'], [], '  ')).toEqual(['Vegan']);
  });

  it('offers nothing when there is nothing to offer', () => {
    expect(vocabularyOptions([], [], null)).toEqual([]);
  });
});

describe('the choices a multi-valued field offers', () => {
  it('keeps every value the note carries, not just one', () => {
    expect(vocabularyChoices(['Gluten', 'Laktose'], ['Nuesse'], ['Sellerie', 'Senf'])).toEqual([
      'Gluten',
      'Laktose',
      'Nuesse',
      'Sellerie',
      'Senf',
    ]);
  });

  it('puts what only this note says at the end, where it is easiest to notice', () => {
    const choices = vocabularyChoices(['Gluten'], ['Laktose'], ['Sellerie']);
    expect(choices.at(-1)).toBe('Sellerie');
  });

  it('does not repeat a value the note shares with a source', () => {
    expect(vocabularyChoices(['Gluten'], [], ['gluten'])).toEqual(['Gluten']);
  });
});

describe('the comma-separated field the values live in', () => {
  it('round-trips', () => {
    expect(splitValues(joinValues(['Gluten', 'Laktose']))).toEqual(['Gluten', 'Laktose']);
  });

  it('survives the spacing a person types', () => {
    expect(splitValues('Gluten,Laktose ,  Nuesse')).toEqual(['Gluten', 'Laktose', 'Nuesse']);
  });

  it('reads an empty field as no values rather than one blank one', () => {
    expect(splitValues('')).toEqual([]);
    expect(splitValues('  ,  ')).toEqual([]);
  });
});

describe('which companies are offered as a supplier', () => {
  // The filter the settings switch drives. Its two states are what matter:
  // blank offers everyone, which is what a vault sees before it has classified
  // anything, and a named role offers only the companies carrying it.
  const marked = { roles: ['meals'] };
  const other = { roles: ['hotel'] };
  const silent = { roles: [] as string[] };

  function offered(role: string): string[] {
    return [
      ['TomTasty', marked],
      ['Hotel Adler', other],
      ['Migros', silent],
    ]
      .filter(([, company]) => companyHasRole((company as { roles: string[] }).roles, role))
      .map(([title]) => title as string);
  }

  it('offers every company while the setting is blank', () => {
    expect(offered('')).toEqual(['TomTasty', 'Hotel Adler', 'Migros']);
  });

  it('offers only the marked ones once the setting names a role', () => {
    // Including dropping the unclassified company, which is the whole point:
    // a vault mid-classification saw all forty-four before this changed.
    expect(offered('meals')).toEqual(['TomTasty']);
  });
});
