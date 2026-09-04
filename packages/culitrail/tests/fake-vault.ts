/**
 * A minimal in-memory stand-in for the slice of Obsidian's App that
 * src/vault/ and src/shared/vault-scan.ts actually touch:
 * `vault.getMarkdownFiles()` and `metadataCache.getFileCache().frontmatter`.
 *
 * Not a general Obsidian test harness. Just enough surface to drive the real
 * reading logic without a real host, since the `obsidian` npm package ships
 * type definitions and no runtime.
 */
import { App, TFile } from 'obsidian';

export interface FakeNote {
  path: string;
  frontmatter?: Record<string, unknown>;
  /**
   * The note's raw contents, including its frontmatter block if it has one.
   *
   * Kept separate from `frontmatter` rather than derived from it, because
   * that mirrors the real split: Obsidian parses frontmatter into the
   * metadata cache, and the readers get the parsed values from there and the
   * body from `cachedRead()`. A test can therefore give a note a body with no
   * frontmatter block, or frontmatter with no body, exactly as a real vault
   * can.
   */
  contents?: string;
}

function fileFor(path: string): TFile {
  const segments = path.split('/');
  const name = segments[segments.length - 1];
  return {
    path,
    name,
    basename: name.replace(/\.md$/, ''),
    extension: 'md',
    parent: { path: segments.slice(0, -1).join('/') },
  } as unknown as TFile;
}

export function makeFakeVault(notes: FakeNote[] = []): App {
  const files = notes.map((note) => fileFor(note.path));
  const frontmatterByPath = new Map(
    notes.map((note) => [note.path, note.frontmatter ?? {}] as const)
  );
  const contentsByPath = new Map(notes.map((note) => [note.path, note.contents ?? ''] as const));

  return {
    vault: {
      getMarkdownFiles: () => files,
      cachedRead: (file: TFile) => Promise.resolve(contentsByPath.get(file.path) ?? ''),
    },
    metadataCache: {
      // Returning undefined frontmatter for an unknown file mirrors Obsidian,
      // where a file with no frontmatter block has no `frontmatter` key at all
      // rather than an empty object.
      getFileCache: (file: TFile) => {
        const frontmatter = frontmatterByPath.get(file.path);
        return frontmatter && Object.keys(frontmatter).length > 0 ? { frontmatter } : {};
      },
    },
  } as unknown as App;
}

/** The TFile a fake vault would produce for a path, for the single-file readers. */
export function fakeFile(path: string): TFile {
  return fileFor(path);
}
