/**
 * The Obsidian implementation of the vault ports.
 *
 * **The only file in this package allowed to import `obsidian`**, which is what
 * the eslint rule and `tests/obsidian-free.test.ts` between them enforce. Every
 * other module reaches a vault through `vault/ports.ts`, and that is what lets
 * the same code run under vitest and, eventually, inside an application that has
 * never heard of Obsidian.
 *
 * Thin on purpose. There is no logic here to get wrong: each method is one call,
 * and anything that needed a decision belongs above the seam where it can be
 * tested.
 */
import { stringifyYaml } from 'obsidian';
import type { App, TFile } from 'obsidian';
import type { FrontmatterPort, MetadataPort, VaultHost, VaultPort } from '../vault/ports.js';

/**
 * `TFile` satisfies `VaultFile` structurally, so the host is parameterised with
 * the real type and callers get real `TFile`s back with no cast at the boundary.
 */
export type ObsidianHost = VaultHost<TFile>;

function vaultPort(app: App): VaultPort<TFile> {
  return {
    read: (file) => app.vault.read(file),
    create: (path, content) => app.vault.create(path, content),
    modify: (file, content) => app.vault.modify(file, content),
    append: (file, content) => app.vault.append(file, content),
    // Discards the folder Obsidian hands back: the port's contract is that the
    // folder exists afterwards, and a caller that wanted the object would be
    // reaching through the seam for a host type.
    createFolder: async (path) => {
      await app.vault.createFolder(path);
    },
    getFile: (path) => app.vault.getFileByPath(path),
    // Anything at the path, folder or note, which is a different question from
    // getFile and the one folder creation needs to ask.
    exists: (path) => app.vault.getAbstractFileByPath(path) !== null,
    markdownFiles: () => app.vault.getMarkdownFiles(),
  };
}

function metadataPort(app: App): MetadataPort<TFile> {
  return {
    // `frontmatter` is `any` on the cache, which is exactly why reading it is
    // confined to this one line and everything above takes the typed record.
    frontmatterOf: (file) =>
      (app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown>) ?? null,
  };
}

function frontmatterPort(app: App): FrontmatterPort<TFile> {
  return {
    process: (file, edit) =>
      app.fileManager.processFrontMatter(file, (frontmatter) =>
        edit(frontmatter as Record<string, unknown>)
      ),
  };
}

/** The three ports over one `App`. Construct once and pass it where an `App` used to go. */
export function obsidianHost(app: App): ObsidianHost {
  return { vault: vaultPort(app), metadata: metadataPort(app), frontmatter: frontmatterPort(app) };
}

/**
 * A `---` fenced frontmatter block, serialised by Obsidian's own writer.
 *
 * This lives here rather than in `frontmatter/block.ts` because the host owns
 * serialisation in both directions: `processFrontMatter` re-serialises a whole
 * block with this same writer, so a package that produced YAML itself would
 * write notes that change shape the first time anything edits one. Build the
 * object with `frontmatterObject()`, then fence it here.
 */
export function renderFrontmatterBlock(yaml: Record<string, unknown>): string {
  return `---\n${stringifyYaml(yaml).trimEnd()}\n---\n`;
}
