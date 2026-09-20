/**
 * Which notes a day note links to, and what is deliberately not asked.
 *
 * The whole read is a title and a link: a note whose title has the day shape
 * links to a place, and its title is the date. Nothing here parses a body, and
 * that is the point -- the format of a day note belongs to another plugin, and
 * reading it for one flag on a card would have meant a contract over it.
 */
import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { TFile } from './obsidian-stub';
import { readDayVisits } from '../src/vault/day-visits';

vi.mock('obsidian', () => import('./obsidian-stub'));

function fileAt(path: string): TFile {
  const file = new TFile();
  file.path = path;
  file.basename = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '');
  return file;
}

function appWith(links: Record<string, string[]>): App {
  const resolvedLinks: Record<string, Record<string, number>> = {};
  for (const [source, targets] of Object.entries(links)) {
    resolvedLinks[source] = Object.fromEntries(targets.map((target) => [target, 1]));
  }

  return {
    vault: { getAbstractFileByPath: (path: string) => fileAt(path) },
    metadataCache: { resolvedLinks },
  } as unknown as App;
}

const KEPPEL = 'Plätze/Essen & Trinken/Landgasthof Keppel.md';

describe('readDayVisits', () => {
  it('takes the day from the note title, because that is what a day note is called', () => {
    const app = appWith({ '0 Plan/1 Daily/2026/2026-09-20.md': [KEPPEL] });
    expect(readDayVisits(app).get(KEPPEL)).toEqual(['2026-09-20']);
  });

  it('collects every day that names it', () => {
    const app = appWith({
      '0 Plan/1 Daily/2026/2026-09-20.md': [KEPPEL],
      '0 Plan/1 Daily/2026/2026-07-04.md': [KEPPEL],
    });
    expect(readDayVisits(app).get(KEPPEL)?.sort()).toEqual(['2026-07-04', '2026-09-20']);
  });

  it('ignores a note that is not a day', () => {
    // A week, a month and a project all link to places and none of them is a
    // day somebody was there.
    const app = appWith({
      '0 Plan/2 Weekly/2026-W38.md': [KEPPEL],
      '0 Plan/3 Monthly/2026-09.md': [KEPPEL],
      '3 Projects/Ausflüge.md': [KEPPEL],
    });
    expect(readDayVisits(app).size).toBe(0);
  });

  it('is not fooled by a folder, only by the shape of the title', () => {
    // A vault that renames its day notes gets no day visits rather than wrong
    // ones, which is the direction every narrowing in this package fails in.
    const app = appWith({ '0 Plan/1 Daily/2026/Tag 2026-09-20.md': [KEPPEL] });
    expect(readDayVisits(app).size).toBe(0);
  });

  it('keys by path, so two notes of one title stay apart', () => {
    const other = 'Plätze/Sonstige Orte/Landgasthof Keppel.md';
    const app = appWith({ '0 Plan/1 Daily/2026/2026-09-20.md': [KEPPEL, other] });

    const found = readDayVisits(app);
    expect(found.get(KEPPEL)).toEqual(['2026-09-20']);
    expect(found.get(other)).toEqual(['2026-09-20']);
  });
});
