/**
 * Which day notes link to which note, built from the text on disk.
 *
 * Inside Obsidian this is `metadataCache.resolvedLinks`, read by
 * `src/vault/day-visits.ts`. Outside it nothing has built that index, so this
 * builds the part of it the board reader needs: for each note whose title is a
 * day, every `[[link]]` in it, frontmatter included, resolved to a note path.
 *
 * Resolution follows Obsidian's for the cases a vault here uses: a bare title
 * resolves by folded title, a `folder/title` link by the end of the path, an
 * alias (`|`) or a heading (`#`) is cut off first, and a link to anything that
 * is not a markdown note in the vault resolves to nothing. Where two notes share
 * a title Obsidian prefers the one nearest the linking note; this takes the
 * first by path, which is the one case where the two can differ.
 */
import {
  caseFold,
  detectPeriodLevel,
  type VaultFile,
  type VaultHost,
} from '@technosoftware/trail-core';

const LINK = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;

export async function dayVisitsOnDisk<F extends VaultFile>(
  host: VaultHost<F>
): Promise<Map<string, string[]>> {
  const files = [...host.vault.markdownFiles()].sort((a, b) => (a.path < b.path ? -1 : 1));
  const byTitle = new Map<string, string>();
  for (const file of files) {
    const key = caseFold(file.basename);
    if (!byTitle.has(key)) byTitle.set(key, file.path);
  }

  const resolve = (target: string): string | null => {
    const clean = target.trim().replace(/\.md$/, '');
    if (!clean.includes('/')) return byTitle.get(caseFold(clean)) ?? null;
    const suffix = `/${caseFold(clean)}.md`;
    const found = files.find((file) => caseFold(`/${file.path}`).endsWith(suffix));
    return found?.path ?? null;
  };

  const visits = new Map<string, string[]>();
  for (const file of files) {
    if (detectPeriodLevel(file.basename) !== 'day') continue;
    const text = await host.vault.read(file);
    // One entry per target per day, as the resolved-link index holds it.
    const targets = new Set<string>();
    for (const match of text.matchAll(LINK)) {
      const path = resolve(match[1]);
      if (path && path !== file.path) targets.add(path);
    }
    for (const path of targets) visits.set(path, [...(visits.get(path) ?? []), file.basename]);
  }
  return visits;
}
