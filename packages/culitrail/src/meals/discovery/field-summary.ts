/**
 * Turning raw observations of the meal library into the field list a picker
 * can show: which keys are the plugin's own plumbing, which keys the settings
 * already promise exist, and how a bag of observed values becomes one type and
 * a short list of suggestions.
 *
 * App-free, which is the point of keeping it out of `scan-fields.ts`.
 */
import { DERIVED_FIELD_VALUES } from './field-types';
import type { CULItrailSettings } from '../../settings/types';
import { inferFieldType } from './field-types';
import type { DiscoveredField, FieldDiscovery } from './types';

/**
 * How many distinct values one field contributes to its suggestion list.
 *
 * A cap, because the field that needs it is `description`: a hundred meals
 * mean a hundred distinct paragraphs, and a menu of those is neither usable
 * nor worth the memory. A field with more values than this is one nobody picks
 * a value from anyway, they type one.
 */
const MAX_VALUES = 50;

/** Longer than this is prose, not a category, so it is not offered as a choice. */
const MAX_VALUE_LENGTH = 60;

/**
 * Frontmatter keys that are the plugin talking to itself rather than metadata
 * anybody would filter on.
 *
 * The type property is excluded because every meal carries the same value,
 * so a filter on it either matches everything or nothing. The image property
 * holds a path, and the eating-history property holds a list of record objects
 * whose values would flood the suggestion list without any of them being
 * pickable.
 *
 * `position` is not a property at all: Obsidian injects it into the parsed
 * frontmatter object to record where in the file the block sits.
 */
export function internalPropertyNames(settings: CULItrailSettings): Set<string> {
  return new Set(
    [
      settings.typePropertyName,
      settings.imageProperty,
      settings.eatingHistoryFrontmatterProperty,
      'position',
    ]
      .map((name) => name?.trim())
      .filter((name): name is string => !!name)
  );
}

/**
 * Fields the settings promise exist, whether or not any note has one yet.
 *
 * Offered ahead of the scan so a fresh vault is not a blank picker: the three
 * that make the built-in modes work are exactly the three nothing has written
 * before the first cook. Their type comes from what the setting means rather
 * than from observation, which is also more reliable than inference over a
 * single sample.
 */
export function builtinFields(settings: CULItrailSettings): DiscoveredField[] {
  const declared: Array<[string, DiscoveredField['type']]> = [
    [settings.lastEatenProperty, 'date'],
    [settings.eatenCountProperty, 'number'],
    [settings.favoriteProperty, 'boolean'],
    [settings.servingsProperty, 'number'],
    [settings.prepTimeProperty, 'number'],
    [settings.reheatTimeProperty, 'number'],
    [settings.totalTimeProperty, 'number'],
    [settings.caloriesProperty, 'number'],
    [settings.dietProperty, 'string'],
    [settings.allergensProperty, 'string'],
  ];

  const seen = new Set<string>();
  const fields: DiscoveredField[] = [];

  for (const [key, type] of declared) {
    const name = key?.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    fields.push({ key: name, type, values: [], isList: false, builtin: true });
  }

  return fields;
}

const byName = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

/** A value as the text a picker would show, or null when it is not worth showing. */
function suggestionText(value: unknown): string | null {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== 'string') return null;

  const text = value.trim();
  return text !== '' && text.length <= MAX_VALUE_LENGTH ? text : null;
}

export interface RawFieldObservations {
  /** Field key to every value seen for it, list entries counted individually. */
  values: Map<string, unknown[]>;
  /** Keys written as a list by at least one note. */
  lists: Set<string>;
  tags: Set<string>;
  scanned: number;
}

/**
 * The scan's observations as a sorted field list.
 *
 * A built-in field that notes also carry keeps its declared type and gains the
 * observed values, rather than appearing twice: the settings know what
 * `lastEaten` is better than a sample of it does.
 */
export function summarizeFields(
  raw: RawFieldObservations,
  settings: CULItrailSettings
): FieldDiscovery {
  const fields = new Map<string, DiscoveredField>();
  for (const field of builtinFields(settings)) fields.set(field.key, field);

  for (const [key, values] of raw.values) {
    const existing = fields.get(key);
    const suggestions = [
      ...new Set(
        values.map((value) => suggestionText(value)).filter((text): text is string => text !== null)
      ),
    ]
      .sort(byName)
      .slice(0, MAX_VALUES);

    fields.set(key, {
      key,
      type: existing?.type ?? inferFieldType(values),
      values: suggestions,
      isList: raw.lists.has(key),
      builtin: existing?.builtin,
    });
  }

  return {
    fields: [...fields.values()].sort((a, b) => byName(a.key, b.key)),
    tags: [...raw.tags].sort(byName),
    scanned: raw.scanned,
  };
}

/**
 * What is known about one field, whether or not the scan saw it.
 *
 * A field nobody has written yet falls back to `string`, which offers equals
 * and contains: the two operators that mean anything for a value nothing has
 * observed. A `#`-prefixed name is a tag by construction and never needs the
 * scan at all.
 */
export function describeField(discovery: FieldDiscovery, field: string): DiscoveredField {
  if (field.startsWith('#')) {
    return { key: field, type: 'tag', values: [], isList: false };
  }

  // A computed field: a string whose values are declared rather than discovered,
  // so the value input offers the four it can take instead of a blank box.
  if (field.startsWith('@')) {
    return {
      key: field,
      type: 'string',
      values: DERIVED_FIELD_VALUES[field.slice(1)] ?? [],
      isList: false,
      builtin: true,
    };
  }

  return (
    discovery.fields.find((entry) => entry.key === field) ?? {
      key: field,
      type: 'string',
      values: [],
      isList: false,
    }
  );
}
