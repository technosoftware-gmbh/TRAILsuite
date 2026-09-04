/**
 * Every translation key `src/` asks for must exist in both shipped locales,
 * and neither table may carry a key the other lacks or the code never asks
 * for.
 *
 * This suite exists because a missing translation is invisible to every other
 * layer of the build. `t()` falls back to returning the key itself, the
 * typechecker only ever sees an untyped string, and no test renders a modal,
 * so a label inserted under the wrong parent key ships as a screen full of
 * dotted paths. That is a real failure mode in the codebase CULItrail is being
 * split out of, not a hypothetical one.
 *
 * Deliberately a static scan of the source rather than a typed key union. A
 * union would be stronger, but it would mean regenerating a large type
 * whenever a string is added, and this catches the same failure for a
 * fraction of the cost.
 *
 * The orphan check at the bottom is the one CULItrail adds beyond what its
 * sibling plugins do, and it is load-bearing while the plugin is being built
 * area by area. The temptation during a port is to bring the whole previous
 * project's translation tables across at once, ahead of the code that uses
 * them; the result is thousands of strings nobody can verify, quietly
 * drifting from what the code eventually asks for. Failing on an unused key
 * is what makes "every string lands with its code" enforceable rather than
 * merely stated in CLAUDE.md.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MACRONUTRIENT_IDS, MICRONUTRIENT_IDS } from 'trail-core';
import { enTranslations } from '../src/lang/translations/en';
import { deTranslations } from '../src/lang/translations/de';
import { DEFAULT_APPLIANCE_IDS, DEFAULT_SETTINGS } from '../src/settings/defaults';
import { MEAL_SLOT_KEYS, WEEKDAY_KEYS } from '../src/lang/vocabulary';
import { DERIVED_FILTER_FIELDS } from '../src/meals/discovery/field-types';

const SRC = join(__dirname, '..', 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

/**
 * Literal `t('some.key')` call sites.
 *
 * Template-literal calls (`t(\`vocabulary.weekdays.${key}\`)`) cannot be
 * resolved statically and are covered by DYNAMIC_KEYS below instead. Listing
 * them is the price of building a key name at runtime, and it keeps those
 * call sites checked rather than silently exempt.
 */
function literalKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
      keys.add(match[1]);
    }
  }
  return keys;
}

/**
 * Keys reached at runtime rather than written literally.
 *
 * Every entry is DERIVED from the constant that drives it rather than typed
 * out by hand. That is the difference between a list that documents an
 * invariant and one that decays: add a meal slot without a label, or a
 * built-in badge without a `labelKey`, and this fails on the next run
 * instead of shipping a raw key into someone's meal header.
 */
const DYNAMIC_KEYS = [
  // src/lang/vocabulary.ts builds one key per member of each fixed vocabulary.
  ...WEEKDAY_KEYS.map((key) => `vocabulary.weekdays.${key}`),
  ...MEAL_SLOT_KEYS.map((key) => `vocabulary.mealSlots.${key}`),
  // Built-in badges store a translation key rather than a label, so the key
  // reaches t() as a value out of data.json. See settings/types.ts's
  // CustomBadge for why they are not frozen strings.
  ...DEFAULT_SETTINGS.headerBadges.map((badge) => badge.labelKey).filter(isPresent),
  // One label per default appliance, reached through the id when a fresh install
  // seeds the appliance list. Derived from DEFAULT_APPLIANCE_IDS, so an appliance
  // added to the defaults without a label fails here rather than seeding a raw
  // key as somebody's appliance name.
  ...DEFAULT_APPLIANCE_IDS.map((id) => `settings.reheating.applianceLabels.${id}`),
  // One label per computed pseudo-field, reached through the field name with the
  // `@` stripped. Derived from the constant the picker iterates, so a derived
  // field added without a label fails here rather than showing a raw key.
  ...DERIVED_FILTER_FIELDS.map((field) => `ui.fieldPicker.derived.${field}`),
  // One label per known nutrient, reached through the id by
  // `nutrientDisplayName()` when the meal editor draws a row of either list.
  // Derived from the same two constants the form iterates, so a nutrient added
  // to trail-core without a label fails here rather than putting a raw key in
  // front of somebody editing a meal. A nutrient the tables do not know keeps
  // the name the note gave it and asks for no key at all.
  ...MACRONUTRIENT_IDS.map((id) => `meals.nutrients.${id}`),
  ...MICRONUTRIENT_IDS.map((id) => `meals.nutrients.${id}`),
];

function isPresent(value: string | undefined): value is string {
  return typeof value === 'string' && value !== '';
}

function lookup(table: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node === null || typeof node !== 'object') return undefined;
    return (node as Record<string, unknown>)[part];
  }, table);
}

/** Every leaf path in a translation table, as dotted keys. */
function flatten(table: unknown, prefix = ''): string[] {
  if (table === null || typeof table !== 'object') return [prefix];
  return Object.entries(table as Record<string, unknown>).flatMap(([key, value]) =>
    flatten(value, prefix ? `${prefix}.${key}` : key)
  );
}

describe('translation keys', () => {
  const used = [...new Set([...literalKeys(), ...DYNAMIC_KEYS])].sort();

  it('actually finds the call sites, so the checks below cannot pass vacuously', () => {
    // Guards the regex itself. A count floor alone would need bumping on every
    // commit, so this also names a key that is genuinely resolved by a literal
    // t() call in src/settings/defaults.ts. If the scan breaks, this fails
    // rather than every other test quietly passing over an empty set.
    expect([...literalKeys()]).toContain('settings.folders.defaults.eatingFolderName');
    expect(used.length).toBeGreaterThan(30);
  });

  it('resolves every key used in src/ against the English table', () => {
    const missing = used.filter((key) => typeof lookup(enTranslations, key) !== 'string');
    expect(missing).toEqual([]);
  });

  it('resolves every key used in src/ against the German table', () => {
    const missing = used.filter((key) => typeof lookup(deTranslations, key) !== 'string');
    expect(missing).toEqual([]);
  });

  it('keeps both locales structurally identical', () => {
    // Catches the inverse failure: a key added to one locale and forgotten in
    // the other, which only ever shows up for users of that language, and
    // then only as an untranslated string rather than as an error.
    const enKeys = flatten(enTranslations).sort();
    const deKeys = flatten(deTranslations).sort();
    expect(deKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
    expect(enKeys.filter((k) => !deKeys.includes(k))).toEqual([]);
  });

  it('carries no key the code never asks for', () => {
    // See this file's header. If this fails because a string was added just
    // ahead of the code that uses it, the fix is to land the two together,
    // not to weaken the check.
    const orphans = flatten(enTranslations).filter((key) => !used.includes(key));
    expect(orphans).toEqual([]);
  });
});

describe('the vocabularies that get written into notes', () => {
  it('has a label for every weekday and meal slot in both locales', () => {
    // A weekday with no label would render its raw key in the meal-plan grid,
    // which is exactly the failure this whole suite exists to catch, and the
    // vocabularies are the most likely place to add a member and forget.
    for (const table of [enTranslations, deTranslations]) {
      for (const key of WEEKDAY_KEYS) {
        expect(typeof lookup(table, `vocabulary.weekdays.${key}`)).toBe('string');
      }
      for (const key of MEAL_SLOT_KEYS) {
        expect(typeof lookup(table, `vocabulary.mealSlots.${key}`)).toBe('string');
      }
    }
  });

  it('gives every built-in badge a translation key rather than a frozen label', () => {
    expect(DEFAULT_SETTINGS.headerBadges.filter((b) => !b.labelKey)).toEqual([]);
  });
});
