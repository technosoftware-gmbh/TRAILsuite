/**
 * A read-only `VaultHost` over a vault folder on disk, for the interchange
 * export. Not part of the plugin: nothing in `src/` imports it, and it never
 * reaches `main.js`.
 *
 * **A copy of this file lives in NODAtrail's `scripts/interchange/`.** The
 * package boundary keeps the two plugins from sharing source, and the core
 * reads no filesystem by rule, so each export carries its own. Change both.
 *
 * It reads the vault the way Obsidian presents it, which is not the way the
 * disk stores it:
 *
 * - **Paths are NFC.** macOS and iCloud store names decomposed, while a
 *   wikilink typed into a note is precomposed. Obsidian normalises before
 *   anything sees a path; a host that did not would fail every link to a title
 *   with an umlaut in it.
 * - **Dot folders are not in the vault.** `.obsidian`, `.trash` and friends
 *   are invisible to Obsidian and to this.
 * - **Frontmatter is parsed with a YAML 1.2 reader**, which keeps a date as the
 *   string written, as Obsidian's cache does. A block that does not parse is a
 *   note with no frontmatter, reported in `unparsable`, never thrown.
 *
 * Every write throws. An export reads a vault; it has no reason to change one.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { splitFrontmatterBlock, type VaultFile, type VaultHost } from '@technosoftware/trail-core';

export interface DiskFile extends VaultFile {
  path: string;
  basename: string;
}

export interface DiskVault {
  host: VaultHost<DiskFile>;
  /** Vault paths whose frontmatter block did not parse. */
  unparsable: string[];
  /** Vault folders, NFC, for checking that a folder setting points somewhere. */
  folders: Set<string>;
}

function refuse(): never {
  throw new Error('The interchange export does not write to the vault.');
}

export function diskVault(root: string): DiskVault {
  const diskPath = new Map<string, string>();
  const folders = new Set<string>();

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.')) continue;
      const full = join(dir, entry);
      const vaultPath = relative(root, full).split(sep).join('/').normalize('NFC');
      if (statSync(full).isDirectory()) {
        folders.add(vaultPath);
        walk(full);
      } else if (entry.endsWith('.md')) {
        diskPath.set(vaultPath, full);
      }
    }
  };
  walk(root);

  const text = (path: string): string => readFileSync(diskPath.get(path) ?? '', 'utf8');
  const fileAt = (path: string): DiskFile => ({
    path,
    basename: (path.split('/').pop() ?? path).replace(/\.md$/, ''),
  });

  const frontmatter = new Map<string, Record<string, unknown>>();
  const unparsable: string[] = [];
  for (const path of diskPath.keys()) {
    const { header } = splitFrontmatterBlock(text(path));
    if (!header) continue;
    try {
      const parsed: unknown = parseYaml(header.split('\n').slice(1, -2).join('\n'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        frontmatter.set(path, parsed as Record<string, unknown>);
      }
    } catch {
      unparsable.push(path);
    }
  }

  const host: VaultHost<DiskFile> = {
    vault: {
      read: (file) => Promise.resolve(text(file.path)),
      create: refuse,
      modify: refuse,
      append: refuse,
      createFolder: refuse,
      getFile: (path) => (diskPath.has(path) ? fileAt(path) : null),
      exists: (path) => diskPath.has(path) || folders.has(path),
      markdownFiles: () => [...diskPath.keys()].map(fileAt),
    },
    metadata: { frontmatterOf: (file) => frontmatter.get(file.path) ?? null },
    frontmatter: { process: refuse },
  };

  return { host, unparsable, folders };
}
