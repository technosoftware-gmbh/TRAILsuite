/**
 * Every translation key `src/` asks for must exist in every shipped
 * locale, and every key must exist in both locales rather than one.
 *
 * This suite exists because of a real bug in the predecessor codebase: the
 * Trip editor's translations were inserted under the wrong parent key, so
 * the whole modal rendered raw key paths instead of labels. Nothing caught
 * it -- `t()` falls back to returning the key itself, the typechecker sees
 * an untyped string, and no test rendered the modal. A missing label is
 * invisible to every other layer of the build, so it needs its own check.
 * It earns its keep a second time here, where the extraction moved every
 * key up one nesting level at once.
 *
 * Deliberately a static scan of the source rather than a typed key union.
 * A union would be stronger, but it would mean regenerating a large type
 * whenever a string is added, and this catches the same failure at a
 * fraction of the cost.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { enTranslations } from '../src/lang/translations/en';
import { deTranslations } from '../src/lang/translations/de';
import { isPluralForms } from '../src/lang/plural';

const SRC = join(__dirname, '..', 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

/**
 * Literal `t('some.key')` calls. Template-literal call sites (e.g.
 * t(`dashboard.stats.status${status}`)) can't be resolved statically and
 * are covered by the explicit DYNAMIC_KEYS list below instead -- listing
 * them by hand is the price of building a key name at runtime, and keeps
 * those call sites honest rather than unchecked.
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

/** Keys built by interpolation at their call sites, enumerated here so they're still checked. */
/**
 * Keys built at runtime rather than written as a literal, listed here because
 * the scan above cannot see them.
 *
 * Listing them is the point rather than a workaround: a dynamic key is exactly
 * the one that fails silently in the other language, because nothing in the
 * source spells it out for a reader to notice.
 */
const DYNAMIC_KEYS = [
  // shared/categories.ts builds `categories.<id>` from the configured list.
  // An id the table does not know is shown verbatim, which is what makes the
  // list a default rather than a boundary; the shipped ids still have to be
  // translated in both tables.
  ...[
    'housing',
    'utilities',
    'insurance',
    'health',
    'transport',
    'food',
    'household',
    'leisure',
    'education',
    'tax',
    'fees',
    'savings',
    'gifts',
    'other',
  ].map((id) => `categories.${id}`),

  // plan/defer-menu.ts builds `plan.until.<level>` from a PeriodLevel, and the
  // day-capture dialog builds `day.kinds.<kind>` and `day.headings.<key>`. All
  // three index a fixed vocabulary, so every member has to be present in both
  // tables even where the current UI only reaches two of them.
  ...['day', 'week', 'month', 'quarter', 'year'].map((level) => `plan.until.${level}`),
  ...['task', 'meeting', 'note', 'idea'].map((kind) => `day.kinds.${kind}`),
  ...['focus', 'schedule', 'notes'].map((key) => `day.headings.${key}`),
  // The calendar preview names what you answered, from the same three values
  // `attendanceOf` produces. Accepted has no key: it says nothing special.
  ...['tentative', 'unanswered', 'declined'].map((key) => `calendar.answer.${key}`),
  ...['backlog', 'planned', 'ongoing', 'blocked', 'done', 'review', 'closed', 'removed'].map(
    (status) => `status.para.${status}`
  ),
  ...['critical', 'high', 'medium', 'low'].map((level) => `priority.${level}`),
];

/** A key resolves when it lands on a string, or on the set of plural forms that stands in for one. */
function resolves(table: unknown, key: string): boolean {
  const value = lookup(table, key);
  return typeof value === 'string' || isPluralForms(value);
}

function lookup(table: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node === null || typeof node !== 'object') return undefined;
    return (node as Record<string, unknown>)[part];
  }, table);
}

/**
 * Every leaf path in a translation table, as dotted keys.
 *
 * A set of plural forms counts as ONE leaf: which categories a language has
 * is a fact about that language, so German writing `one`/`other` where
 * Russian would write four is not a structural difference between the
 * tables.
 */
function flatten(table: unknown, prefix = ''): string[] {
  if (table === null || typeof table !== 'object' || isPluralForms(table)) return [prefix];
  return Object.entries(table as Record<string, unknown>).flatMap(([key, value]) =>
    flatten(value, prefix ? `${prefix}.${key}` : key)
  );
}

describe('translation keys', () => {
  const used = [...literalKeys(), ...DYNAMIC_KEYS].sort();

  it('finds a meaningful number of call sites, so a broken scan fails loudly', () => {
    // Guards the regex itself: if it ever stops matching, the two tests
    // below would pass vacuously.
    expect(used.length).toBeGreaterThan(100);
  });

  it('resolves every key used in src/ against the English table', () => {
    const missing = used.filter((key) => !resolves(enTranslations, key));
    expect(missing).toEqual([]);
  });

  it('resolves every key used in src/ against the German table', () => {
    const missing = used.filter((key) => !resolves(deTranslations, key));
    expect(missing).toEqual([]);
  });

  it('keeps both locales structurally identical', () => {
    // Catches the inverse of the bug above: a key added to one locale and
    // forgotten in the other, which only shows up for users of that
    // language.
    const enKeys = flatten(enTranslations).sort();
    const deKeys = flatten(deTranslations).sort();
    expect(deKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
    expect(enKeys.filter((k) => !deKeys.includes(k))).toEqual([]);
  });
});

/**
 * The keys a view builds from a list rather than writing out.
 *
 * `t(`ledger.tab.${tab}`)` cannot be seen by the scan above, which reads the
 * source for literal keys. So a tab added to the list without a label shipped
 * as the raw key on screen, which is exactly what happened to the budget tab.
 * These lists are short and the cost of naming them here is one line each.
 */
const BUILT_KEYS = [
  ...['accounts', 'statement', 'income', 'balance', 'budget'].map((tab) => `ledger.tab.${tab}`),
  ...[
    'unreadable',
    'no-date',
    'no-amount',
    'no-accounts',
    'split-does-not-sum',
    'orphan-continuation',
    'unknown-account',
  ].map((reason) => `ledger.problem.${reason}`),
  ...['weekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'once'].map(
    (rhythm) => `cadence.${rhythm}`
  ),
  ...['purchases', 'bills', 'recurring'].map((tab) => `finance.${tab}`),
  ...['month', 'quarter', 'year'].map((level) => `period.${level}`),
  ...['asset', 'liability', 'income', 'expense'].map(
    (kind) => `ledger.kind${kind[0].toUpperCase()}${kind.slice(1)}`
  ),
];

describe('keys a view builds rather than writes', () => {
  it('resolves against the English table', () => {
    expect(BUILT_KEYS.filter((key) => !resolves(enTranslations, key))).toEqual([]);
  });

  it('resolves against the German table', () => {
    expect(BUILT_KEYS.filter((key) => !resolves(deTranslations, key))).toEqual([]);
  });
});
