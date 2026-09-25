/**
 * The interchange format: what a vault looks like when it leaves for an
 * application that does not read markdown.
 *
 * Here rather than in a plugin on both of the core's tests. It is a format, a
 * statement about a file that outlives the code writing it, and it has more
 * than one writer: each plugin writes its own section file, and CULItrail will
 * write one from its own repository. The reader is the standalone app.
 *
 * **One vault export is a folder of files, never one file.** `vault.json` holds
 * every note raw; each plugin's file holds the records it parsed out of the
 * notes it recognises, keyed by path. That split is what lets each plugin write
 * its own file without knowing about the others, and what lets a note no
 * plugin recognises still arrive, raw, instead of being dropped.
 *
 * App-free.
 */

/** The value every interchange file carries in `format`, so a stray JSON file is refused. */
export const INTERCHANGE_FORMAT = 'trail-interchange';

/**
 * Bumped on any change a reader has to know about. A reader refuses a version
 * it does not know rather than guessing, because a field it misreads is a
 * value silently lost in a one-way import.
 */
export const INTERCHANGE_VERSION = 1;

/** The source name of the file that carries every note raw. */
export const VAULT_SOURCE = 'vault';

/** What every interchange file starts with. */
export interface InterchangeHeader {
  format: typeof INTERCHANGE_FORMAT;
  version: typeof INTERCHANGE_VERSION;
  /** `vault`, or the id of the plugin that wrote the file (`nodatrail`, `apertrail`). */
  source: string;
  /** The writer's own version, for telling apart two exports of one vault. */
  sourceVersion: string;
  /** When the export ran, as the caller's clock says. Passed in: the core reads no clock. */
  generatedAt: string;
}

/** One note exactly as the vault holds it. */
export interface RawNote {
  /** Vault-relative and NFC-normalised. The key every other file refers to a note by. */
  path: string;
  /** The filename without `.md`, which is what a wikilink resolves against. */
  title: string;
  /** The parsed frontmatter, or null when the note has none. */
  frontmatter: Record<string, unknown> | null;
  /** Everything after the frontmatter block. */
  body: string;
}

/** `vault.json`: every markdown note, raw. */
export interface VaultManifest extends InterchangeHeader {
  source: typeof VAULT_SOURCE;
  notes: RawNote[];
}

/**
 * A reference from one record to the note behind another.
 *
 * Records in a plugin's own model point at each other as objects, and the
 * travel board is a real cycle (a country lists its cities, a city names its
 * country). JSON cannot hold a cycle, and an app should not have to resolve
 * titles a plugin already resolved, so every such pointer leaves as the path of
 * the note it pointed at.
 */
export interface InterchangeRef {
  ref: string;
}

/** One parsed record, and the note it was parsed from. */
export interface FamilyEntry {
  path: string;
  record: Record<string, unknown>;
}

/** A plugin's file: its note families, each a list of parsed records. */
export interface SectionFile extends InterchangeHeader {
  families: Record<string, FamilyEntry[]>;
}
