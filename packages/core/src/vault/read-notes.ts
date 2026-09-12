/**
 * Reading notes out of a vault by folder and type.
 *
 * Nothing is cached: each call re-reads, so what a view renders can never drift
 * from what is on disk. The cost of that choice is visible rather than subtle,
 * and it is worth stating plainly: the data is never stale, the pixels can be.
 *
 * Takes resolved folders and a type value rather than a settings object and an
 * entity-type name. Which folders a kind lives in is each plugin's own registry;
 * this only knows how to ask.
 */
import { readString } from '../frontmatter/read.js';
import { stripWikilink } from '../links/wikilink.js';
import { isUnderAnyFolder } from '../paths/folders.js';
import type { VaultFile, VaultHost } from './ports.js';

export interface VaultNote<F extends VaultFile = VaultFile> {
  file: F;
  /** The note's title, which is its filename without the extension. This, not the path, is what wikilinks resolve against. */
  title: string;
  frontmatter: Record<string, unknown>;
}

/** Where one kind of note lives and what marks it as that kind. */
export interface NoteKindQuery {
  folders: readonly string[];
  typePropertyName: string;
  typeValue: string;
}

/**
 * True when a note's type property carries the expected value.
 *
 * **A blank expected value never matches.** An unset setting therefore hides its
 * folder rather than claiming every note in it, which is the safer of the two
 * failure modes by a wide margin: a folder that shows nothing prompts someone to
 * check the setting, whereas a folder that claims every note in the vault
 * silently fills a gallery with meeting minutes.
 *
 * The comparison is exact after trimming, not case-insensitive. A vault whose
 * notes say `type: Person` sets its type value to `Person`; that is what the
 * setting is for, and matching loosely would mean a vault could never
 * deliberately distinguish `person` from `Person`.
 *
 * The *shape* of the value is read leniently even though its text is not. A
 * property editor types a property as a list the moment somebody adds a second
 * value, so `type: [meal]` and `type: [meal, draft]` are both things a real
 * vault produces without anybody deciding to, and a note that vanished for that
 * reason would be near impossible to attribute. A wikilink-shaped value is
 * unwrapped for the same reason: a vault that keeps a note per type and links to
 * it still means `meal`.
 */
export function matchesType(
  frontmatter: Record<string, unknown>,
  typePropertyName: string,
  expected: string
): boolean {
  if (!expected) return false;

  const raw = frontmatter[typePropertyName || 'type'];
  const candidates = Array.isArray(raw) ? (raw as unknown[]) : [raw];

  return candidates.some((candidate) => {
    const text = readString(candidate);
    return text !== null && stripWikilink(text) === expected;
  });
}

/**
 * Every note of one kind, title-sorted.
 *
 * Folder AND type, both required. There is no folder-only fallback for a note
 * missing its type, and no vault-wide search for a type outside its folder.
 * Requiring both is what keeps an unrelated note that happens to say
 * `type: meal` out of the library, and it is also why a health check over
 * these folders is worth running now and then: a note that gets moved, or whose
 * type gets typo'd, drops out silently by design.
 */
export function readNotesOfType<F extends VaultFile>(
  host: VaultHost<F>,
  query: NoteKindQuery
): VaultNote<F>[] {
  const folders = query.folders.map((folder) => folder.trim()).filter((folder) => folder !== '');
  if (folders.length === 0) return [];
  if (!query.typeValue) return [];

  return host.vault
    .markdownFiles()
    .filter((file) => isUnderAnyFolder(file.path, folders))
    .map((file) => ({
      file,
      title: file.basename,
      frontmatter: host.metadata.frontmatterOf(file) ?? {},
    }))
    .filter((note) => matchesType(note.frontmatter, query.typePropertyName, query.typeValue))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * True when one specific file counts as a given kind.
 *
 * The single-file question, for code paths that already hold a file and only
 * need to know whether to act on it. Answered on exactly the same terms as the
 * bulk read above, so the two can never disagree about what a meal is.
 */
export function isNoteOfType<F extends VaultFile>(
  host: VaultHost<F>,
  file: F,
  query: NoteKindQuery
): boolean {
  const folders = query.folders.map((folder) => folder.trim()).filter((folder) => folder !== '');
  if (!isUnderAnyFolder(file.path, folders)) return false;

  const frontmatter = host.metadata.frontmatterOf(file) ?? {};
  return matchesType(frontmatter, query.typePropertyName, query.typeValue);
}

/** Notes indexed by title, for resolving wikilinks. The first of a duplicate pair wins, so a title-sorted input resolves deterministically. */
export function indexByTitle<F extends VaultFile>(
  notes: readonly VaultNote<F>[]
): Map<string, VaultNote<F>> {
  const index = new Map<string, VaultNote<F>>();

  for (const note of notes) {
    const key = note.title.trim().toLowerCase();
    if (!index.has(key)) index.set(key, note);
  }
  return index;
}

/**
 * Resolves a wikilink target against an index.
 *
 * Null for a link that matches nothing, which is the normal case for a note that
 * was renamed or deleted, and every caller is expected to render one fewer row
 * rather than treat it as an error.
 */
export function resolveByTitle<F extends VaultFile>(
  index: Map<string, VaultNote<F>>,
  target: string | null | undefined
): VaultNote<F> | null {
  if (!target) return null;
  return index.get(target.trim().toLowerCase()) ?? null;
}
