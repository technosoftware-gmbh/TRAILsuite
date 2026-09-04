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
  /** Every `vault.create()` call made during the test, in order -- lets create-entities.ts tests assert on the exact path/content written. */
  created: { path: string; content: string }[];
}

function fileFor(path: string): TFile {
  const segments = path.split('/');
  const name = segments[segments.length - 1];
  const basename = name.replace(/\.md$/, '');
  const parentPath = segments.slice(0, -1).join('/');
  return { path, basename, name, parent: { path: parentPath } } as unknown as TFile;
}

export function makeFakeVault(notes: FakeNote[] = []): FakeVault {
  const files: TFile[] = notes.map((n) => fileFor(n.path));
  const frontmatterByPath = new Map(notes.map((n) => [n.path, n.frontmatter]));
  const existingPaths = new Set(notes.map((n) => n.path));
  const created: { path: string; content: string }[] = [];

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
  } as unknown as App;

  return { app, created };
}
