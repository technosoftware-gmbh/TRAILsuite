/**
 * The values a meal field offers, from three places that may all be incomplete.
 *
 * The rule is `supplier-options.ts`'s, applied to the fields that have a
 * vocabulary rather than a list of notes behind them. A `<select>` whose value
 * matches no option falls back to its first, so **an option list that omits
 * what the note already says is a list that silently rewrites the note on the
 * next save**. Diet lost that way is a badge quietly changing colour; a product
 * line lost that way is a meal moving to another range with different prices.
 *
 * So every source is a suggestion and the note's own value is not. Configured
 * values come first because they are the intended vocabulary, then whatever the
 * library actually uses, and anything the note says that neither names is kept
 * regardless.
 *
 * App-free: the caller reads the vault and hands the values in.
 */

/** Case-insensitive, because a vault's `Vegan` and `vegan` are one diet and nobody would configure both. */
function key(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * The options for a single-valued field, in the order they should be offered.
 *
 * `preferred` is offered above `known`: a supplier's own published lines are
 * the answer for a meal from that supplier, and the setting is the answer
 * otherwise. Duplicates across the three sources collapse on their first
 * spelling, so the list never offers the same word twice in two cases.
 */
export function vocabularyOptions(
  preferred: readonly string[],
  known: readonly string[],
  current: string | null | undefined
): string[] {
  const seen = new Set<string>();
  const options: string[] = [];

  for (const value of [...preferred, ...known]) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(key(trimmed))) continue;
    seen.add(key(trimmed));
    options.push(trimmed);
  }

  // Last, and unconditionally. Everything above is a suggestion; this is what
  // the note actually says, and dropping it is how a form rewrites a note
  // nobody asked it to touch.
  const named = current?.trim();
  if (named && !seen.has(key(named))) options.push(named);

  return options;
}

/**
 * The options for a field holding several values at once, such as allergens.
 *
 * Same rule, with every value the note carries kept rather than one. The order
 * puts the suggestions first and anything only this note says at the end, which
 * is where an unusual value is easiest to notice.
 */
export function vocabularyChoices(
  preferred: readonly string[],
  known: readonly string[],
  current: readonly string[]
): string[] {
  const options = vocabularyOptions(preferred, known, null);
  const seen = new Set(options.map(key));

  for (const value of current) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(key(trimmed))) continue;
    seen.add(key(trimmed));
    options.push(trimmed);
  }

  return options;
}

/** A comma-separated field as the values it holds. */
export function splitValues(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

/** The values back as the field holds them, in the order they were chosen. */
export function joinValues(values: readonly string[]): string {
  return values.join(', ');
}
