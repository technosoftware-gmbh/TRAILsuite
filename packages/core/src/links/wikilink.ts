/**
 * Wikilinks: reading a target out of a frontmatter value, and writing one back.
 *
 * **Two readings, deliberately, and this is the file's whole design.** The
 * plugins had made opposite decisions about the same question, each with a
 * rationale written next to it:
 *
 * - APERtrail returned null for a value that is not a link, so that "a
 *   hand-typed plain string is left alone rather than guessed at".
 * - CULItrail returned the bare text, because "a hand-written
 *   `company: TomTasty AG` means the same thing to a person as
 *   `company: "[[TomTasty AG]]"`, and refusing to read it would make the note
 *   look broken for a reason nobody can see".
 *
 * Both are right for what they do. A Country note's `capital:` should not adopt
 * a stray sentence; an order's `company:` should. So both survive here under
 * names that say which is which, and nothing was silently converted to the
 * other. Picking one would have changed what a plugin reads out of a vault.
 *
 * Resolution against real files is the caller's job, which is what keeps this
 * testable. Wikilinks resolve by note title, never by path.
 *
 * App-free.
 */

/** `[[Target]]` or `[[Target|Alias]]`, anchored so a value has to BE a link rather than merely contain one. */
const WIKILINK = /^!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/;

/** The same shape unanchored, for pulling links out of a line of body text. */
const WIKILINK_GLOBAL = /!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

/** `Note#Heading` and `Note^block` both target `Note`. */
function withoutSubpath(target: string): string {
  return target.split('#')[0]?.split('^')[0]?.trim() ?? '';
}

/**
 * The bare path or title inside a link, or the value unchanged when it is not
 * one.
 *
 * Handles the embed prefix (`![[photo.jpg]]`) as well as a plain link, which is
 * what an image property is actually written as. One of the two implementations
 * this replaces did not, so an image embedded rather than linked resolved to the
 * literal string `![[photo.jpg]]` and no file was found.
 */
export function stripWikilink(value: string): string {
  const match = WIKILINK.exec(value.trim());
  return match ? withoutSubpath(match[1] ?? '') : value.trim();
}

/**
 * STRICT: the link target, or null when the value is not a wikilink.
 *
 * For a property whose value is a reference and nothing else, where reading a
 * stray string as a note title would invent a relationship the vault does not
 * have.
 */
export function wikilinkTarget(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  const match = WIKILINK.exec(raw.trim());
  if (!match) return null;

  const target = withoutSubpath(match[1] ?? '');
  return target === '' ? null : target;
}

/**
 * STRICT, for a property that may hold a list.
 *
 * A bare single value is accepted as a one-element list: a hand-edited note
 * often ends up with one un-wrapped value, and dropping it over that would lose
 * a real reference.
 */
export function wikilinkTargets(raw: unknown): string[] {
  const values = Array.isArray(raw) ? (raw as unknown[]) : [raw];

  const targets: string[] = [];
  for (const value of values) {
    const target = wikilinkTarget(value);
    if (target) targets.push(target);
  }
  return targets;
}

/**
 * LENIENT: the link target, or the plain text when the value is not a link.
 *
 * For a property where a person typing a name without brackets meant the same
 * thing as typing one with them.
 */
export function linkOrText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  const target = stripWikilink(raw);
  return target === '' ? null : target;
}

/**
 * LENIENT, for a property that may hold a list.
 *
 * Three shapes occur in real notes: a list of links, a single link, and one
 * string holding several. The last is what a hand-edited note tends to become,
 * so a value that is not itself a link is scanned for links inside it, and
 * treated as one plain-text target only when it contains none.
 */
export function linkOrTextList(raw: unknown): string[] {
  const entries = Array.isArray(raw) ? (raw as unknown[]) : [raw];

  const targets: string[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'string') continue;

    const single = linkOrText(entry);
    if (WIKILINK.test(entry.trim())) {
      if (single) targets.push(single);
      continue;
    }

    const embedded = [...entry.matchAll(WIKILINK_GLOBAL)]
      .map((match) => withoutSubpath(match[1] ?? ''))
      .filter((target) => target !== '');

    if (embedded.length > 0) {
      targets.push(...embedded);
    } else if (single) {
      targets.push(single);
    }
  }

  return targets;
}

/**
 * A wikilink as a **value**, for a frontmatter object a serializer will quote.
 *
 * Use this when handing an object to a YAML serializer or to Obsidian's
 * `processFrontMatter()`. Those quote a string that would otherwise parse
 * wrongly, so pre-quoting here produces a value with two sets of quotes in it
 * and a link nothing can follow.
 */
export function wikilinkValue(title: string): string {
  return `[[${title}]]`;
}

/** The same function under the name the strict readers' inverse was called. */
export const toWikilink = wikilinkValue;

/**
 * A wikilink for writing into frontmatter **text**, quoted.
 *
 * Only for hand-built YAML, where nothing else is going to quote it. The quotes
 * are not optional there: an unquoted `[[Target]]` is a nested flow sequence, so
 * `company: [[TomTasty AG]]` parses as a list containing a list rather than as a
 * link, and the value the reader gets back is not a string at all.
 *
 * Kept beside `wikilinkValue` despite having one consumer today, because the
 * two are a pair and separating them is how the double-quoting bug comes back.
 */
export function formatWikilink(title: string): string {
  return `"${wikilinkValue(title)}"`;
}

/** True when two note titles refer to the same note. Case-insensitive, because Obsidian's own link resolution is. */
export function titlesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
