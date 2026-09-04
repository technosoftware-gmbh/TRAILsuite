/**
 * What the field picker is allowed to offer.
 *
 * The app-free half of discovery, which is where every decision worth pinning
 * lives: which keys are plumbing rather than metadata, whether a declared type
 * beats an observed one, and the two caps that keep a prose field from filling
 * a menu with paragraphs.
 */
import { describe, expect, it } from 'vitest';
import {
  builtinFields,
  describeField,
  internalPropertyNames,
  summarizeFields,
  type RawFieldObservations,
} from '../src/meals/discovery/field-summary';
import { EMPTY_DISCOVERY } from '../src/meals/discovery/types';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const settings = DEFAULT_SETTINGS;

function raw(values: Record<string, unknown[]>, extra: Partial<RawFieldObservations> = {}) {
  return {
    values: new Map(Object.entries(values)),
    lists: new Set<string>(),
    tags: new Set<string>(),
    scanned: 1,
    ...extra,
  };
}

function find(result: ReturnType<typeof summarizeFields>, key: string) {
  return result.fields.find((field) => field.key === key);
}

describe('internal property names', () => {
  it('excludes the keys that are the plugin talking to itself', () => {
    const skip = internalPropertyNames(settings);

    expect(skip.has(settings.typePropertyName)).toBe(true);
    expect(skip.has(settings.imageProperty)).toBe(true);
    expect(skip.has(settings.eatingHistoryFrontmatterProperty)).toBe(true);
    // Obsidian injects this into the parsed frontmatter object; it is not a
    // property anybody wrote.
    expect(skip.has('position')).toBe(true);
  });

  it('keeps the properties a filter is actually built on', () => {
    const skip = internalPropertyNames(settings);

    for (const name of [
      settings.lastEatenProperty,
      settings.eatenCountProperty,
      settings.favoriteProperty,
      settings.dietProperty,
    ]) {
      expect(skip.has(name)).toBe(false);
    }
  });

  it('skips a blank setting rather than excluding the empty key', () => {
    const blank = { ...settings, imageProperty: '  ' };
    expect([...internalPropertyNames(blank)]).not.toContain('');
  });
});

describe('built-in fields', () => {
  it('offers the three the built-in modes need before any note has them', () => {
    const keys = builtinFields(settings).map((field) => field.key);

    expect(keys).toContain(settings.lastEatenProperty);
    expect(keys).toContain(settings.eatenCountProperty);
    expect(keys).toContain(settings.favoriteProperty);
  });

  it('declares each one a type rather than leaving it to inference', () => {
    const fields = builtinFields(settings);

    expect(fields.find((f) => f.key === settings.lastEatenProperty)?.type).toBe('date');
    expect(fields.find((f) => f.key === settings.eatenCountProperty)?.type).toBe('number');
    expect(fields.find((f) => f.key === settings.favoriteProperty)?.type).toBe('boolean');
  });

  it('lists a property once when two settings happen to name it the same', () => {
    const collided = { ...settings, prepTimeProperty: settings.reheatTimeProperty };

    const keys = builtinFields(collided).map((field) => field.key);
    expect(keys.length).toBe(new Set(keys).size);
  });
});

describe('summarizing a scan', () => {
  it('sorts fields by name, case-insensitively', () => {
    const result = summarizeFields(raw({ zebra: ['x'], Apple: ['y'] }), settings);
    const positions = result.fields.map((field) => field.key);

    expect(positions.indexOf('Apple')).toBeLessThan(positions.indexOf('zebra'));
  });

  it('infers a type from what the notes hold', () => {
    const result = summarizeFields(raw({ effort: [1, 2, 3], season: ['summer'] }), settings);

    expect(find(result, 'effort')?.type).toBe('number');
    expect(find(result, 'season')?.type).toBe('string');
  });

  it('keeps a built-in declared type even when the samples disagree', () => {
    // One note whose lastEaten is free text must not turn the field into a
    // string field for everybody, because the date operators are the whole
    // reason it is offered.
    const result = summarizeFields(raw({ [settings.lastEatenProperty]: ['never'] }), settings);

    expect(find(result, settings.lastEatenProperty)?.type).toBe('date');
    expect(find(result, settings.lastEatenProperty)?.builtin).toBe(true);
  });

  it('does not list a field twice when a note carries a built-in one', () => {
    const result = summarizeFields(raw({ [settings.favoriteProperty]: [true] }), settings);
    const matches = result.fields.filter((field) => field.key === settings.favoriteProperty);

    expect(matches.length).toBe(1);
    expect(matches[0].values).toEqual(['true']);
  });

  it('marks a field a list when any note wrote it as one', () => {
    const result = summarizeFields(
      raw({ allergens: ['nuts', 'dairy'] }, { lists: new Set(['allergens']) }),
      settings
    );

    expect(find(result, 'allergens')?.isList).toBe(true);
    expect(find(result, 'allergens')?.values).toEqual(['dairy', 'nuts']);
  });

  it('offers each distinct value once', () => {
    const result = summarizeFields(raw({ season: ['summer', 'summer', 'winter'] }), settings);
    expect(find(result, 'season')?.values).toEqual(['summer', 'winter']);
  });

  it('drops a value too long to be a category', () => {
    const prose = 'a'.repeat(61);
    const result = summarizeFields(raw({ description: [prose, 'short'] }), settings);

    expect(find(result, 'description')?.values).toEqual(['short']);
  });

  it('caps how many values one field contributes', () => {
    const many = Array.from({ length: 120 }, (_, index) => `value-${index}`);
    const result = summarizeFields(raw({ note: many }), settings);

    expect(find(result, 'note')?.values.length).toBe(50);
  });

  it('renders a date value as its day', () => {
    const result = summarizeFields(raw({ added: [new Date('2026-08-11T09:30:00Z')] }), settings);
    expect(find(result, 'added')?.values).toEqual(['2026-08-11']);
  });

  it('sorts tags and reports how many notes were read', () => {
    const result = summarizeFields(
      raw({}, { tags: new Set(['weeknight', 'Family']), scanned: 12 }),
      settings
    );

    expect(result.tags).toEqual(['Family', 'weeknight']);
    expect(result.scanned).toBe(12);
  });
});

describe('describing a field', () => {
  it('reads a #-prefixed name as a tag without consulting the scan', () => {
    const described = describeField(EMPTY_DISCOVERY, '#weeknight');

    expect(described.type).toBe('tag');
    expect(described.key).toBe('#weeknight');
  });

  it('falls back to string for a property no note carries yet', () => {
    // Not an error case: a filter written ahead of the property is how somebody
    // sets up a mode before entering the data, and string is the type whose
    // operators still mean something for a value nothing has observed.
    expect(describeField(EMPTY_DISCOVERY, 'effort').type).toBe('string');
  });

  it('returns what the scan found when it found it', () => {
    const discovery = summarizeFields(raw({ effort: [1, 2] }), settings);
    expect(describeField(discovery, 'effort').type).toBe('number');
  });
});
