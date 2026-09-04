/**
 * The thin layer between the vault and the App-free readers behind it.
 *
 * Everything here needs an Obsidian `App`, which is exactly why it is only
 * this small: keeping the boundary narrow is what leaves the readers it feeds
 * unit-testable without mocking the app. The folder predicates that used to
 * sit beside it are `trail-core`'s now.
 */
import { App, TFile } from 'obsidian';
import { isUnderAnyFolder } from 'trail-core';
import { hostFor } from './vault-host';

/**
 * A file's frontmatter, or null.
 *
 * The cast off `metadataCache.getFileCache()`, whose frontmatter is `any`,
 * happens once inside the core's Obsidian adapter. Every call site goes through
 * here rather than reaching into `cache?.frontmatter?.[x]`, so the defensive
 * readers in `trail-core` are never bypassed.
 */
export function frontmatterOf(app: App, file: TFile): Record<string, unknown> | null {
  return hostFor(app).metadata.frontmatterOf(file);
}

/** Every Markdown file under any of the given folders, with its frontmatter read once. */
export function markdownFilesUnder(
  app: App,
  folders: string[]
): { file: TFile; frontmatter: Record<string, unknown> }[] {
  const scoped = folders.map((f) => f.trim()).filter((f) => f !== '');
  if (scoped.length === 0) return [];

  return app.vault
    .getMarkdownFiles()
    .filter((file) => isUnderAnyFolder(file.path, scoped))
    .map((file) => ({ file, frontmatter: frontmatterOf(app, file) ?? {} }));
}
