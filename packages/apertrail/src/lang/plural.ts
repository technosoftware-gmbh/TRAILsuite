/**
 * Plural forms, in the categories the language actually has.
 *
 * English has two and German has two, which is why this was an `{plural}`
 * placeholder holding an "s" for a long time. Russian has four, Polish
 * four, Arabic six, and none of them can be reached by appending a letter:
 * "1 Notiz" and "2 Notizen" already break the trick in the one other locale
 * this plugin ships.
 *
 * The categories are CLDR's and the selection is `Intl.PluralRules`, so a
 * translator writes the forms their language has and nothing here needs to
 * know which those are. `other` is required because it is the one category
 * every language defines, and therefore the only safe fallback.
 */
export interface PluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

const CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

/** Whether a translation node is a set of plural forms rather than a nested group of keys. */
export function isPluralForms(value: unknown): value is PluralForms {
  if (value === null || typeof value !== 'object') return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => (CATEGORIES as readonly string[]).includes(key));
}

/**
 * The form for a count, falling back to `other` when the table has not
 * filled in the category the runtime selected. A locale whose translator
 * wrote only `other` still renders a sentence rather than a key path.
 */
export function selectPluralForm(forms: PluralForms, count: number, locale: string): string {
  let category: string;
  try {
    category = new Intl.PluralRules(locale).select(count);
  } catch {
    // An unusable locale tag is not a reason to render nothing.
    category = 'other';
  }
  return forms[category as keyof PluralForms] ?? forms.other;
}
