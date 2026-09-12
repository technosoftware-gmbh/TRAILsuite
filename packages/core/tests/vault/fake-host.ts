/**
 * An in-memory `VaultHost`, which is the point of the ports existing.
 *
 * No Obsidian, no filesystem, no mock library. Every module in `src/vault/` is
 * exercised against this, and the Obsidian adapter is thin enough that what it
 * adds is one call per method.
 */
import type { VaultFile, VaultHost } from '../../src/vault/ports';

export interface FakeFile extends VaultFile {
  path: string;
  basename: string;
}

export interface FakeVault {
  host: VaultHost<FakeFile>;
  /** Note text by path. */
  notes: Map<string, string>;
  /** Parsed frontmatter by path, as a host's cache would hold it. */
  frontmatter: Map<string, Record<string, unknown>>;
  folders: Set<string>;
  /** Every write, in order, so a test can assert how many passes a save made. */
  writes: { kind: 'create' | 'modify' | 'append' | 'frontmatter' | 'folder'; path: string }[];
}

function fileFor(path: string): FakeFile {
  const name = path.split('/').pop() ?? path;
  return { path, basename: name.replace(/\.md$/, '') };
}

export function makeFakeVault(
  seed: { path: string; content?: string; frontmatter?: Record<string, unknown> }[] = []
): FakeVault {
  const notes = new Map<string, string>();
  const frontmatter = new Map<string, Record<string, unknown>>();
  const folders = new Set<string>();
  const writes: FakeVault['writes'] = [];

  for (const note of seed) {
    notes.set(note.path, note.content ?? '');
    if (note.frontmatter) frontmatter.set(note.path, note.frontmatter);

    const parts = note.path.split('/').slice(0, -1);
    for (let i = 1; i <= parts.length; i++) folders.add(parts.slice(0, i).join('/'));
  }

  const host: VaultHost<FakeFile> = {
    vault: {
      read: (file) => Promise.resolve(notes.get(file.path) ?? ''),
      create: (path, content) => {
        notes.set(path, content);
        writes.push({ kind: 'create', path });
        return Promise.resolve(fileFor(path));
      },
      modify: (file, content) => {
        notes.set(file.path, content);
        writes.push({ kind: 'modify', path: file.path });
        return Promise.resolve();
      },
      append: (file, content) => {
        notes.set(file.path, (notes.get(file.path) ?? '') + content);
        writes.push({ kind: 'append', path: file.path });
        return Promise.resolve();
      },
      createFolder: (path) => {
        folders.add(path);
        writes.push({ kind: 'folder', path });
        return Promise.resolve();
      },
      getFile: (path) => (notes.has(path) ? fileFor(path) : null),
      exists: (path) => notes.has(path) || folders.has(path),
      markdownFiles: () =>
        [...notes.keys()].filter((path) => path.endsWith('.md')).map((path) => fileFor(path)),
    },
    metadata: {
      frontmatterOf: (file) => frontmatter.get(file.path) ?? null,
    },
    frontmatter: {
      process: (file, edit) => {
        const current = frontmatter.get(file.path) ?? {};
        edit(current);
        frontmatter.set(file.path, current);
        writes.push({ kind: 'frontmatter', path: file.path });
        return Promise.resolve();
      },
    },
  };

  return { host, notes, frontmatter, folders, writes };
}
