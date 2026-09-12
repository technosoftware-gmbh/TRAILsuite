/**
 * Creating and writing notes, over the vault port.
 *
 * Every write goes through here so that "create the folder if it is missing" is
 * decided once, and so no area grows its own slightly different idea of what
 * happens when a note is not there.
 *
 * These take a `VaultHost`, not a host's own app object. See `ports.ts`.
 */
import { createdEntry, stampModified, type NoteStampProperties } from '../frontmatter/stamps.js';
import { normalizePath, sanitizeTitle } from '../paths/folders.js';
import type { VaultFile, VaultHost } from './ports.js';

/** A note's text, or '' when there is no such note. Absent and empty are the same to every caller. */
export async function readNoteOrEmpty<F extends VaultFile>(
  host: VaultHost<F>,
  path: string
): Promise<string> {
  const file = host.vault.getFile(normalizePath(path));
  return file ? host.vault.read(file) : '';
}

/**
 * Creates one folder if it is missing.
 *
 * A failure is swallowed rather than raised: it means a race with another
 * creation, or a folder that already exists under different casing, and the
 * write that follows will surface a clearer error if the folder genuinely is not
 * usable.
 */
export async function ensureFolder<F extends VaultFile>(
  host: VaultHost<F>,
  path: string
): Promise<void> {
  const normalized = normalizePath(path);
  if (!normalized || host.vault.exists(normalized)) return;

  try {
    await host.vault.createFolder(normalized);
  } catch {
    // See above.
  }
}

/**
 * Creates every folder above a path that does not exist yet.
 *
 * One segment at a time rather than one call for the deepest folder, because a
 * host's `createFolder` fails rather than creating intermediate levels, and a
 * year-nested path routinely has the intermediate level missing.
 */
export async function ensureParentFolders<F extends VaultFile>(
  host: VaultHost<F>,
  path: string
): Promise<void> {
  const segments = normalizePath(path).split('/').slice(0, -1);

  let current = '';
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    await ensureFolder(host, current);
  }
}

/**
 * Writes a new note at `folder/title.md`.
 *
 * Refuses rather than overwriting: every caller is creating something, and a
 * silent clobber of a note that happens to share a title is not a failure mode
 * worth having.
 */
export async function createNote<F extends VaultFile>(
  host: VaultHost<F>,
  folder: string,
  title: string,
  content: string
): Promise<F> {
  await ensureFolder(host, folder);

  const path = normalizePath(`${folder}/${sanitizeTitle(title)}.md`);
  if (host.vault.exists(path)) throw new NoteExistsError(path);

  return host.vault.create(path, content);
}

/** A note already exists at the path a creation wanted. Typed so a caller can translate it; this package ships no user-facing strings. */
export class NoteExistsError extends Error {
  constructor(readonly path: string) {
    super(`A note already exists at "${path}".`);
    this.name = 'NoteExistsError';
  }
}

/**
 * Writes a note, creating it and its folders if need be, and stamping it.
 *
 * `content` replaces the file outright, frontmatter included, so a caller
 * rewriting an existing note has to carry that note's own properties across in
 * the text it passes. `splitFrontmatterBlock()` exists for the ones that rebuild
 * a note from its sections and would otherwise start at the title and drop
 * `created` on the way.
 *
 * The stamp is a second pass rather than part of that text, because splicing a
 * property into a YAML block by hand is how a quoting bug is born. The host owns
 * serialisation; this owns content.
 */
export async function writeNote<F extends VaultFile>(
  host: VaultHost<F>,
  properties: NoteStampProperties,
  path: string,
  content: string
): Promise<void> {
  const normalized = normalizePath(path);
  const existing = host.vault.getFile(normalized);

  if (existing) {
    await host.vault.modify(existing, content);
    await touchModified(host, properties, existing);
    return;
  }

  await ensureParentFolders(host, normalized);
  const created = await host.vault.create(normalized, content);
  await touchCreated(host, properties, created);
}

/**
 * The note at a path, created with `initialContent` if it is not there yet.
 *
 * A note that was already there is handed back untouched, stamp included: not
 * writing to it is exactly what makes this different from `writeNote`.
 */
export async function getOrCreateNote<F extends VaultFile>(
  host: VaultHost<F>,
  properties: NoteStampProperties,
  path: string,
  initialContent: string
): Promise<F> {
  const normalized = normalizePath(path);
  const existing = host.vault.getFile(normalized);
  if (existing) return existing;

  await ensureParentFolders(host, normalized);
  const created = await host.vault.create(normalized, initialContent);
  await touchCreated(host, properties, created);
  return created;
}

/**
 * Stamps `created` on a note that was written as text.
 *
 * A pass of its own, because a note built as a string has no frontmatter object
 * to spread into and writing YAML by hand is how a quoting bug is born. The
 * guard is not an optimisation: a host's frontmatter editor gives a note with no
 * block an empty one, so running it with nothing to write would add `---\n---`
 * to every note in a vault that had turned the setting off.
 */
export async function touchCreated<F extends VaultFile>(
  host: VaultHost<F>,
  properties: NoteStampProperties,
  file: F,
  now: Date = new Date()
): Promise<void> {
  const entry = createdEntry(properties, now);
  if (Object.keys(entry).length === 0) return;

  await host.frontmatter.process(file, (frontmatter) => Object.assign(frontmatter, entry));
}

/** Stamps `modified` on a note whose write touched only its body. Same guard, same reason. */
export async function touchModified<F extends VaultFile>(
  host: VaultHost<F>,
  properties: NoteStampProperties,
  file: F,
  now: Date = new Date()
): Promise<void> {
  if (!properties.modifiedProperty.trim()) return;

  await host.frontmatter.process(file, (frontmatter) =>
    stampModified(frontmatter, properties, now)
  );
}
