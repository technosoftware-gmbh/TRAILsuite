/**
 * Resolving a wikilink target to a note, without Obsidian's link index.
 *
 * Inside Obsidian a plugin asks `metadataCache.getFirstLinkpathDest`. An export
 * runs outside it, over a host that has nothing but the list of notes, and a
 * record that hands the app a title instead of the note behind it leaves the
 * app to resolve titles it has no index for. So this builds the part of the
 * index a reader needs, once per export.
 *
 * Resolution follows Obsidian's for the cases a vault here uses: a bare title
 * resolves by folded title, a `folder/title` target by the end of the path, an
 * alias (`|`) or a heading (`#`) is cut off first, and a target that is not a
 * markdown note in the vault resolves to nothing. **Where two notes share a
 * title Obsidian prefers the one nearest the linking note; this takes the
 * first by path**, which is the one case where the two can differ.
 *
 * App-free.
 */
import { caseFold } from '../text/case-fold.js';
import type { VaultFile } from './ports.js';

/** Finds the note a link target names, or null. */
export type LinkResolver<F extends VaultFile = VaultFile> = (target: string) => F | null;

/** The target inside `[[...]]`, without its alias, heading or block reference. */
export function linkTargetOf(raw: string): string {
  const inner = raw.trim().replace(/^\[\[/, '').replace(/\]\]$/, '');
  return (inner.split(/[|#^]/)[0] ?? '').trim();
}

export function linkResolver<F extends VaultFile>(files: readonly F[]): LinkResolver<F> {
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const byTitle = new Map<string, F>();
  for (const file of sorted) {
    const key = caseFold(file.basename);
    if (!byTitle.has(key)) byTitle.set(key, file);
  }

  return (target: string) => {
    const clean = linkTargetOf(target).replace(/\.md$/i, '');
    if (!clean) return null;
    if (!clean.includes('/')) return byTitle.get(caseFold(clean)) ?? null;
    const suffix = `/${caseFold(clean)}.md`;
    return sorted.find((file) => caseFold(`/${file.path}`).endsWith(suffix)) ?? null;
  };
}
