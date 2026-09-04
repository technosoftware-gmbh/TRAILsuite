/**
 * A meal's `source:` as something to show.
 *
 * The field holds whatever the vault puts there. An import writes a URL; a
 * person writing by hand writes "Grandma's blue notebook". Both are valid and
 * both have to render.
 *
 * App-free.
 */

export interface SourceLink {
  /** The URL to link to, or null when the source is not a link at all. */
  href: string | null;
  /** What to show: a hostname for a URL, the text itself otherwise. */
  label: string;
}

/**
 * Reads the source field.
 *
 * The URL parse is guarded rather than assumed. `new URL()` **throws** on
 * anything that is not a URL, so parsing a hand-written source unguarded
 * takes the whole meal view down with it, and a meal from a cookbook is
 * not an unusual meal.
 */
export function readSourceLink(value: string | null): SourceLink | null {
  const text = value?.trim();
  if (!text) return null;

  if (!/^https?:\/\//i.test(text)) return { href: null, label: text };

  try {
    // The hostname rather than the full URL: a link to a meal site is
    // typically long enough to wrap three times on a phone, and the domain is
    // the part a reader recognises.
    return { href: text, label: new URL(text).hostname };
  } catch {
    return { href: null, label: text };
  }
}
