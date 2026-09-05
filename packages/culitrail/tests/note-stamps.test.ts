/**
 * The note header as CULItrail's writers produce it, through the shim onto
 * `trail-core`'s vault host.
 *
 * The stamp rules are the core's and are tested there against its own in-memory
 * host. Two of them are re-checked here against an Obsidian-shaped app, because
 * that wiring is this plugin's: `hostFor()` builds the ports out of `app.vault`
 * and `app.fileManager`, and nothing else would notice if a port reached for a
 * method Obsidian does not have. The third test is CULItrail's own rule: one
 * logical save is one stamp, however many passes it takes.
 */
import { describe, expect, it } from 'vitest';
import type { App, TFile } from 'obsidian';
import { mergeSettings } from '../src/settings/validate';
import { splitFrontmatterBlock } from '@technosoftware/trail-core';
import { writeNote } from '../src/shared/vault-io';
import { writeMealDraft } from '../src/meals/editor/write-draft';
import { emptyMealNutrition, type MealDraft } from '../src/meals/editor/types';

const settings = mergeSettings({});

/**
 * A vault that can be written to.
 *
 * Frontmatter is held as an object beside the body, which is how Obsidian
 * itself splits a note, and re-serialised on write as flat `key: value` lines.
 * Nothing here needs a real YAML implementation: these tests are about which
 * keys end up in the block and how many times, never about how a nested value
 * is spelled.
 */
function writableVault(initial: Record<string, string> = {}): {
  app: App;
  contents: Map<string, string>;
  frontmatterPasses: () => number;
} {
  const contents = new Map(Object.entries(initial));
  let passes = 0;

  const fileFor = (path: string): TFile =>
    ({
      path,
      name: path.split('/').pop(),
      basename: (path.split('/').pop() ?? '').replace(/\.md$/, ''),
      extension: 'md',
    }) as unknown as TFile;

  const parseBlock = (text: string): Record<string, unknown> => {
    const { header } = splitFrontmatterBlock(text);
    if (!header) return {};

    const entries: Record<string, unknown> = {};
    for (const line of header.split('\n').slice(1)) {
      if (line.trim() === '---' || !line.trim()) continue;
      const at = line.indexOf(':');
      if (at < 0) continue;
      entries[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
    return entries;
  };

  const app = {
    vault: {
      getFileByPath: (path: string) => (contents.has(path) ? fileFor(path) : null),
      getAbstractFileByPath: (path: string) => (contents.has(path) ? fileFor(path) : null),
      createFolder: () => Promise.resolve(),
      create: (path: string, text: string) => {
        contents.set(path, text);
        return Promise.resolve(fileFor(path));
      },
      modify: (file: TFile, text: string) => {
        contents.set(file.path, text);
        return Promise.resolve();
      },
      read: (file: TFile) => Promise.resolve(contents.get(file.path) ?? ''),
      process: (file: TFile, fn: (text: string) => string) => {
        contents.set(file.path, fn(contents.get(file.path) ?? ''));
        return Promise.resolve(contents.get(file.path) ?? '');
      },
    },
    fileManager: {
      processFrontMatter: (file: TFile, fn: (frontmatter: Record<string, unknown>) => void) => {
        passes += 1;
        const text = contents.get(file.path) ?? '';
        const frontmatter = parseBlock(text);
        fn(frontmatter);

        const rows = Object.entries(frontmatter).map(
          ([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`
        );
        contents.set(
          file.path,
          `---\n${rows.join('\n')}\n---\n${splitFrontmatterBlock(text).body}`
        );
        return Promise.resolve();
      },
    },
  } as unknown as App;

  return { app, contents, frontmatterPasses: () => passes };
}

/** The frontmatter of a note in a writable vault, as an object. */
function frontmatterOf(contents: Map<string, string>, path: string): Record<string, string> {
  const { header } = splitFrontmatterBlock(contents.get(path) ?? '');
  const entries: Record<string, string> = {};

  for (const line of header.split('\n').slice(1)) {
    if (line.trim() === '---' || !line.trim()) continue;
    const at = line.indexOf(':');
    if (at > 0) entries[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return entries;
}

const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

describe('creating a note', () => {
  it('stamps created and nothing else', async () => {
    const { app, contents } = writableVault();
    await writeNote(app, settings, 'Plans/2026-W32.md', '# Meal Plan\n');

    const frontmatter = frontmatterOf(contents, 'Plans/2026-W32.md');
    expect(frontmatter.created).toMatch(STAMP);
    // Modified belongs to the first real edit. A note that has only ever been
    // created has not been changed.
    expect(frontmatter.modified).toBeUndefined();
  });
});

describe('changing a note', () => {
  it('stamps modified and leaves created as it found it', async () => {
    const { app, contents } = writableVault({
      'Plans/2026-W32.md': '---\ncreated: 2026-01-02T09:00\n---\n# Meal Plan\n',
    });

    // The note's own frontmatter travels in the text, as it does from every
    // caller: `writeNote` replaces the file rather than merging into it.
    await writeNote(
      app,
      settings,
      'Plans/2026-W32.md',
      '---\ncreated: 2026-01-02T09:00\n---\n# Meal Plan\n\n## Monday\n'
    );

    const frontmatter = frontmatterOf(contents, 'Plans/2026-W32.md');
    expect(frontmatter.created).toBe('2026-01-02T09:00');
    expect(frontmatter.modified).toMatch(STAMP);
  });
});

describe('a save made of several passes', () => {
  const draft: MealDraft = {
    description: 'mit hausgemachter Pasta',
    prepTime: 10,
    reheatTime: null,
    totalTime: null,
    servings: 2,
    price: null,
    line: null,
    priceCurrency: null,
    supplier: null,
    diet: '',
    allergens: '',
    image: '',
    hasPer100g: false,
    per100g: emptyMealNutrition(),
    servingGrams: null,
    totals: { calories: null, protein: null, fat: null, carbs: null },
  };

  it('stamps modified exactly once', async () => {
    // The editor writes frontmatter, then makes a pass over the body for the
    // description and another for the sections it takes out. A stamp per pass
    // would put several different times into one note for one click, and the
    // last one would win by accident rather than by design.
    const { app, contents, frontmatterPasses } = writableVault({
      'Meals/Risotto.md': '---\ntype: meal\n---\n\nold\n\n# Notes\n\nWorks with rigatoni.\n',
    });
    const file = app.vault.getFileByPath('Meals/Risotto.md');

    await writeMealDraft(app, file, settings, draft);

    expect(frontmatterPasses()).toBe(1);
    expect(frontmatterOf(contents, 'Meals/Risotto.md').modified).toMatch(STAMP);
  });
});
