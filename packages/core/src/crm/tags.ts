/**
 * Reading and matching frontmatter tags.
 *
 * Only **frontmatter** tags, from a configured property. Body tags (`#Family`
 * written into the prose) are deliberately not read: every value the plugins
 * read comes from a property whose name is a setting, and a body tag has no
 * property name to configure. A vault that wants a person included by tag puts
 * the tag in frontmatter, which is also where Obsidian's own property editor
 * puts it.
 *
 * Here rather than in a plugin because two of them narrow a person list by tag
 * and had drifted into two implementations of it: one case-insensitive with
 * nested-tag support, one an exact string match that quietly dropped anybody
 * whose tag was capitalised differently. Two copies of a comparison agree until
 * one of them is fixed.
 *
 * App-free: no `obsidian` import.
 */

/**
 * Every tag in a frontmatter value, normalized.
 *
 * Handles the three shapes real notes carry, because all three occur: a list
 * (what Obsidian writes), a single bare value (what a hand-edited note often
 * holds), and one comma-separated string (what an import tends to produce).
 *
 * A leading `#` is stripped. Obsidian's property editor writes tags without
 * one, but a person typing a tag by hand writes `#Family` because that is
 * what a tag looks like everywhere else in the app, and treating those as two
 * different tags is a distinction nobody means.
 */
export function readTags(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : [value];
  return entries
    .flatMap((entry) => (typeof entry === 'string' ? entry.split(',') : []))
    .map((entry) => entry.trim().replace(/^#/, '').trim())
    .filter((entry) => entry !== '');
}

/** Parses a comma-separated settings value, such as `eligiblePersonTags`, into a list of tags. */
export function parseTagFilter(value: string): string[] {
  return readTags(value);
}

/**
 * True when a tag satisfies a filter tag.
 *
 * Case-insensitive, matching how Obsidian's own tag search behaves, and
 * **a parent tag matches its nested children**: filtering on `Family` matches
 * a note tagged `Family/Close`. That is what someone filtering by `Family`
 * means, and it mirrors what typing `tag:#Family` into Obsidian's search
 * already does. The reverse is not true, so filtering on `Family/Close` does
 * not match a note tagged only `Family`.
 *
 * The boundary check on the prefix is what stops `Family` from also matching
 * `FamilyBusiness`, which a plain `startsWith` would.
 */
export function tagMatches(tag: string, filter: string): boolean {
  const candidate = tag.trim().toLowerCase();
  const wanted = filter.trim().toLowerCase();
  if (!candidate || !wanted) return false;
  return candidate === wanted || candidate.startsWith(`${wanted}/`);
}

/** True when any of a note's tags satisfies any of the filter tags. An empty filter matches everything, never nothing. */
export function matchesAnyTag(tags: string[], filter: string[]): boolean {
  if (filter.length === 0) return true;
  return tags.some((tag) => filter.some((wanted) => tagMatches(tag, wanted)));
}

/**
 * The subset of `items` whose tags satisfy the filter.
 *
 * Generic over anything carrying tags, because the two callers hold different
 * records and neither should have to unwrap and rewrap a list to be filtered.
 * **An empty filter admits everything, never nothing**, which is the rule that
 * matters most: turning a filter on must not silently empty a picker before
 * anybody has configured it.
 */
export function filterByTags<T extends { tags: string[] }>(
  items: readonly T[],
  filter: readonly string[]
): T[] {
  if (filter.length === 0) return [...items];
  return items.filter((item) => matchesAnyTag(item.tags, [...filter]));
}
