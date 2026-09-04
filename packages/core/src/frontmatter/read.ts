/**
 * Defensive readers for frontmatter values.
 *
 * Every one takes `unknown` and returns a usable value or null. That is the
 * whole contract: an absent field means "unset", never an error, and a field of
 * the wrong shape means "unset" too rather than throwing three layers up while
 * a card is rendering.
 *
 * They exist because YAML frontmatter is edited by hand. A property editor types
 * a number as a Number or leaves it a string depending on how it was entered, a
 * list may be a list or a single value, and a date may arrive as a string or as
 * a native Date. Date reading lives in `dates/read.ts`; everything else is here.
 *
 * App-free.
 */

/** A non-empty trimmed string, or null. */
export function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * A number, whether it was stored as one or as a numeric string.
 *
 * A property editor types a value as a Number only when the property is declared
 * numeric; a note written by hand, or imported before the property existed,
 * holds `servings: "4"`. Both have to work, or scaling silently stops.
 */
export function readNumberLike(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Guarded, because Number('') and Number(' ') are both 0.
    if (trimmed === '') return null;

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * A boolean, tolerating the strings a hand-edited note ends up with.
 *
 * `favorite: yes` and `favorite: true` mean the same thing to a person typing
 * them, and a checkbox that ignores one of them reads as a bug.
 */
export function readBooleanLike(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
    if (['false', 'no', 'n', '0'].includes(normalized)) return false;
  }
  return null;
}

/**
 * A list of strings, from a list, a single value, or a comma-separated string.
 *
 * All three shapes occur in real notes: a property editor writes a list, a
 * hand-edited note often holds one bare value, and an imported one often holds
 * `diet: vegetarian, gluten-free`.
 */
export function readStringList(value: unknown): string[] {
  const values = Array.isArray(value) ? (value as unknown[]) : [value];

  return values
    .flatMap((entry) => (typeof entry === 'string' ? entry.split(',') : []))
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

/**
 * A list of paths, from a list or from a single value.
 *
 * Deliberately not `readStringList`. That one splits on commas, which is right
 * for `diet: vegetarian, gluten-free` and wrong for a filename: a document
 * called `Rechnung, Mahnung.pdf` would silently become two paths, neither of
 * which names a file. A path is only ever a whole entry.
 *
 * Order is the note's order, because it is the only thing that says which
 * document is the invoice and which is the slip that came with it.
 */
export function readPathList(value: unknown): string[] {
  const values = Array.isArray(value) ? (value as unknown[]) : [value];

  return values
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry !== '');
}

/**
 * The first usable value among several property names, matched without regard to
 * case.
 *
 * This merges two implementations that had drifted apart. One was
 * case-insensitive and returned whatever it found, including an empty string;
 * the other matched exactly, took a list of aliases, and skipped empty values so
 * a blank property falls through to the next alias. Both behaviours are wanted,
 * and neither loses anything by gaining the other: a note is hand-edited, so
 * `Country:` should answer to `country`, and a property left blank is unset
 * rather than an answer.
 *
 * The configured name is always tried first, so a vault's own naming wins over
 * any alias. Within one name, the first matching key in the note's own key order
 * wins, so a note carrying both `Servings` and `servings` resolves the same way
 * every time.
 */
export function findValue(
  frontmatter: Record<string, unknown> | null | undefined,
  ...names: string[]
): unknown {
  if (!frontmatter) return undefined;

  const byLowerName = new Map<string, string>();
  for (const key of Object.keys(frontmatter)) {
    const lower = key.toLowerCase();
    if (!byLowerName.has(lower)) byLowerName.set(lower, key);
  }

  for (const name of names) {
    if (!name) continue;

    const key = byLowerName.get(name.trim().toLowerCase());
    if (key === undefined) continue;

    const value = frontmatter[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}
