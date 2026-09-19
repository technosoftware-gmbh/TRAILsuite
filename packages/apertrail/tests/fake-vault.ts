/**
 * Minimal in-memory fake of the Obsidian App/Vault/MetadataCache surface
 * that src/vault/{read,create}-entities.ts actually touch --
 * getMarkdownFiles(), getFileCache().frontmatter, create()/createFolder()/
 * getAbstractFileByPath(). Not a general Obsidian test harness, just enough
 * surface to drive those two files' real logic without a real Obsidian
 * host (the `obsidian` npm package ships type definitions only, no runtime
 * -- so each suite that needs stringifyYaml/normalizePath mocks the
 * `obsidian` module itself).
 */
import { App, TFile } from 'obsidian';

export interface FakeNote {
  path: string;
  frontmatter: Record<string, unknown>;
}

export interface FakeVault {
  app: App;
  /** Every `fileManager.renameFile()` call, in order -- what a move is asserted on. */
  moved: { from: string; to: string }[];
  /** The frontmatter as it stands now, so a test can read back what `processFrontMatter()` wrote. */
  frontmatterAt: (path: string) => Record<string, unknown> | undefined;
  /** Every `vault.create()` call made during the test, in order -- lets create-entities.ts tests assert on the exact path/content written. */
  created: { path: string; content: string }[];
}

function fileFor(path: string): TFile {
  const segments = path.split('/');
  const name = segments[segments.length - 1];
  const basename = name.replace(/\.md$/, '');
  const parentPath = segments.slice(0, -1).join('/');
  // The parent carries a `name` as well as a `path`, because a trip that owns
  // its folder is archived by renaming that folder, and the code asks the
  // parent for both.
  return {
    path,
    basename,
    name,
    parent: {
      path: parentPath,
      name: parentPath.slice(parentPath.lastIndexOf('/') + 1),
    },
  } as unknown as TFile;
}

export function makeFakeVault(notes: FakeNote[] = []): FakeVault {
  const files: TFile[] = notes.map((n) => fileFor(n.path));
  const frontmatterByPath = new Map(notes.map((n) => [n.path, n.frontmatter]));
  const existingPaths = new Set(notes.map((n) => n.path));
  const created: { path: string; content: string }[] = [];
  const moved: { from: string; to: string }[] = [];

  const app = {
    vault: {
      getMarkdownFiles: () => files,
      getAbstractFileByPath: (path: string) => (existingPaths.has(path) ? fileFor(path) : null),
      createFolder: async () => undefined,
      create: async (path: string, content: string) => {
        created.push({ path, content });
        existingPaths.add(path);
        return fileFor(path);
      },
    },
    metadataCache: {
      getFileCache: (file: TFile) => ({ frontmatter: frontmatterByPath.get(file.path) ?? {} }),
    },
    // Enough of the two write paths for a move to be asserted on. A rename of a
    // FOLDER carries every note under it, which is not a detail this could skip:
    // a trip owns its folder, so archiving one is a folder rename and the note
    // the caller holds is a file inside the thing that moved.
    fileManager: {
      processFrontMatter: async (
        file: TFile,
        fn: (frontmatter: Record<string, unknown>) => void
      ) => {
        const existing = frontmatterByPath.get(file.path) ?? {};
        fn(existing);
        frontmatterByPath.set(file.path, existing);
      },
      renameFile: async (entry: { path: string }, target: string) => {
        moved.push({ from: entry.path, to: target });
        const prefix = `${entry.path}/`;
        for (const path of [...existingPaths]) {
          if (path !== entry.path && !path.startsWith(prefix)) continue;
          const next = path === entry.path ? target : `${target}/${path.slice(prefix.length)}`;
          existingPaths.delete(path);
          existingPaths.add(next);
          const frontmatter = frontmatterByPath.get(path);
          if (frontmatter) {
            frontmatterByPath.delete(path);
            frontmatterByPath.set(next, frontmatter);
          }
          const index = files.findIndex((f) => f.path === path);
          if (index !== -1) files[index] = fileFor(next);
        }
      },
    },
  } as unknown as App;

  return { app, created, moved, frontmatterAt: (path) => frontmatterByPath.get(path) };
}
