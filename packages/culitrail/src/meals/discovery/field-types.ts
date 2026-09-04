/**
 * What kinds of field a meal note has, and how a value is sorted into one.
 *
 * It lived under the suggester, whose filters were written in this vocabulary.
 * The suggester is gone and the vocabulary is not: the field discovery that
 * feeds the badge editor's property picker still has to say what kind of thing
 * a property holds, which is what decides how a badge formats it.
 *
 * The operator list left with the suggester. It described what could be *asked*
 * about a field, and nothing asks any more.
 *
 * App-free.
 */

/** The four types a frontmatter value is sorted into by looking at it. */
export type FieldType = 'number' | 'date' | 'boolean' | 'string';

/** Tags are their own kind: they are a list a note is *in*, not a value it holds. */
export type FilterableType = FieldType | 'tag';

/**
 * The values a derived pseudo-field can take, keyed by the field.
 *
 * A derived field is computed from a meal rather than read off it, so there is
 * no property to name and no scan that could discover its values. Declared here
 * so the property picker can offer them.
 */
export const DERIVED_FILTER_FIELDS = ['reheating'] as const;

export const DERIVED_FIELD_VALUES: Record<string, string[]> = {
  reheating: ['yes', 'no'],
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

/**
 * What kind of thing a frontmatter value is.
 *
 * Order matters: a boolean is checked before a number because JavaScript will
 * happily read `true` as 1, and a date before a string because a date is a
 * string until something looks at it.
 */
function inferValueType(value: unknown): FieldType | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return 'boolean';
  if (value instanceof Date) return 'date';
  if (typeof value === 'number') return 'number';

  if (typeof value === 'string') {
    if (ISO_DATE.test(value.trim())) return 'date';
    // A string that is entirely a number is a number somebody quoted, and
    // offering "contains" for it would be useless.
    return value.trim() !== '' && !Number.isNaN(Number(value)) ? 'number' : 'string';
  }

  return Array.isArray(value) ? 'string' : null;
}

/**
 * One type for a field seen across many notes.
 *
 * The most common answer wins, with ties broken toward the more specific
 * type, because a field that is a date in ninety notes and free text in one
 * is a date field with one note that needs fixing, not a text field.
 */
export function inferFieldType(values: unknown[]): FieldType {
  const counts = new Map<FieldType, number>();

  for (const value of values) {
    const type = inferValueType(value);
    if (type) counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  const order: FieldType[] = ['date', 'number', 'boolean', 'string'];
  let best: FieldType = 'string';
  let bestCount = 0;

  for (const type of order) {
    const count = counts.get(type) ?? 0;
    if (count > bestCount) {
      best = type;
      bestCount = count;
    }
  }

  return best;
}
