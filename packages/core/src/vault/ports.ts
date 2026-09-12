/**
 * What this package needs from a vault, as interfaces rather than as a host.
 *
 * This is the seam. Everything above it is pure; everything below it is one
 * small adapter per host. `src/obsidian/` is the only one today. A standalone
 * application supplies its own over a real filesystem and reuses every module
 * built on these without changing a line of them.
 *
 * **Generic over the file type, deliberately.** A host's own file object
 * (Obsidian's `TFile`) structurally satisfies `VaultFile` already, so an adapter
 * hands the real thing through and a caller gets the real thing back. Without
 * the parameter every call site that holds a `TFile` would need a cast, and a
 * cast at a boundary is where the boundary stops being checked.
 *
 * App-free.
 */

/** A note, reduced to what anything here actually reads off one. */
export interface VaultFile {
  path: string;
  /** The filename without its extension. This, not the path, is what wikilinks resolve against. */
  basename: string;
}

/** Reading and writing notes. */
export interface VaultPort<F extends VaultFile = VaultFile> {
  read(file: F): Promise<string>;
  create(path: string, content: string): Promise<F>;
  modify(file: F, content: string): Promise<void>;
  append(file: F, content: string): Promise<void>;
  /** Creates one folder. Callers create intermediate levels themselves; see `ensureParentFolders`. */
  createFolder(path: string): Promise<void>;
  /** The note at a path, or null. */
  getFile(path: string): F | null;
  /** Whether anything exists at a path, folder or note. Distinct from `getFile`, which answers only about notes. */
  exists(path: string): boolean;
  markdownFiles(): F[];
}

/** Reading a note's parsed frontmatter, which a host caches and this package does not. */
export interface MetadataPort<F extends VaultFile = VaultFile> {
  /** The parsed frontmatter, or null when the note has none. */
  frontmatterOf(file: F): Record<string, unknown> | null;
}

/**
 * Editing a note's frontmatter in place.
 *
 * Separate from `VaultPort` because a host owns the serialisation: it parses the
 * block, hands over the object, and writes it back with its own writer. A
 * package that serialised YAML itself would produce notes that change shape the
 * first time the host edits one.
 */
export interface FrontmatterPort<F extends VaultFile = VaultFile> {
  process(file: F, edit: (frontmatter: Record<string, unknown>) => void): Promise<void>;
}

/** The three ports together, which is what every module below this line takes. */
export interface VaultHost<F extends VaultFile = VaultFile> {
  vault: VaultPort<F>;
  metadata: MetadataPort<F>;
  frontmatter: FrontmatterPort<F>;
}
