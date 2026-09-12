/**
 * Resolving a note's reference to another file in the vault, and pointing at
 * it from a page written beside it.
 *
 * `resolveVaultFile` is the resolution `image-resolve.ts` has always done,
 * lifted out when a second kind of reference needed it: a vehicle's deck plan
 * is a PDF, not a picture, and everything else about finding it is identical.
 * A note may name a file as a wikilink or as a vault path, and Obsidian's own
 * link resolution has to be tried first because a wikilink may be shortened
 * to a basename.
 */
import { App, TFile } from 'obsidian';
import { stripWikilink } from '@technosoftware/trail-core';

/**
 * What counts as "not in this vault, and not meant to be".
 *
 * `data:` and `app:` are here because a picture may legitimately be either,
 * and the point of the list is to tell a reference that points outward from
 * one that points at a file and misses.
 */
export const ABSOLUTE_URL_RE = /^(?:https?|data|app|capacitor):\/\//i;

/**
 * A note's reference to something, resolved as far as it goes.
 *
 * Three answers rather than a file-or-null, because the third one is what the
 * health check exists to report and what a caller must not treat as an error:
 * a value that points out of the vault is not a file anything can read, and is
 * not a mistake either.
 */
export type VaultReference =
  { kind: 'url'; url: string } | { kind: 'file'; file: TFile } | { kind: 'missing' };

export function resolveReference(app: App, value: string): VaultReference {
  const trimmed = value.trim();
  if (!trimmed) return { kind: 'missing' };
  if (ABSOLUTE_URL_RE.test(trimmed)) return { kind: 'url', url: trimmed };
  const file = resolveVaultFile(app, trimmed);
  return file ? { kind: 'file', file } : { kind: 'missing' };
}

export function resolveVaultFile(app: App, value: string): TFile | null {
  const bare = stripWikilink(value);

  const resolved = app.metadataCache.getFirstLinkpathDest(bare, '');
  if (resolved instanceof TFile) return resolved;

  const byPath = app.vault.getFileByPath(bare);
  if (byPath instanceof TFile) return byPath;

  return null;
}

/**
 * `to` as a page sitting at `from` would have to write it.
 *
 * An exported sheet is a file in the vault folder, opened outside Obsidian by
 * whoever it was sent to, so a link in it has to be relative to the sheet
 * itself. An absolute vault path resolves to nothing in a browser, and a
 * `file://` URL to the machine it was written on.
 *
 * Both arguments are vault paths, which are always `/`-separated and never
 * carry a drive letter, so this is string work rather than a path library.
 * Percent-encoding is left to the caller: it is a property of the href, not
 * of the relationship between two files.
 */
export function relativeVaultPath(from: string, to: string): string {
  const fromParts = from.split('/').filter(Boolean);
  const toParts = to.split('/').filter(Boolean);

  let shared = 0;
  while (
    shared < fromParts.length &&
    shared < toParts.length &&
    fromParts[shared] === toParts[shared]
  ) {
    shared += 1;
  }

  const up = fromParts.length - shared;
  // A file directly under the source folder gets a bare name rather than
  // `./name`: it is what a person would write, and both work.
  return [...Array<string>(up).fill('..'), ...toParts.slice(shared)].join('/');
}
