/**
 * The days a Person note's block lists.
 *
 * Two properties carry the whole feature. It must find an entry by the **link**
 * rather than by the text, because saying it in a way a reader can be sure
 * about is the entire reason the person went on a child line. And it must reach
 * only the notes that actually name them: a block that read every day note in
 * the vault would make opening a Person note slow in exactly the vault where it
 * has most to say.
 */
import { describe, expect, it, vi } from 'vitest';
import type { App, TFile } from 'obsidian';
import { TFile as StubFile } from './obsidian-stub';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { readPersonDays } from '../src/plan/read-person-days';

vi.mock('obsidian', () => import('./obsidian-stub'));

const S = DEFAULT_SETTINGS;
const PERSON = 'CRM/People/Anna Muster.md';

function fileAt(path: string): TFile {
  const file = new StubFile();
  file.path = path;
  file.basename = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '');
  return file as unknown as TFile;
}

/** A day note's path under the shipped template. */
function dayPath(iso: string): string {
  return `0 Plan/1 Daily/${iso.slice(0, 4)}/${iso}.md`;
}

interface Vault {
  /** Path to body. */
  notes: Record<string, string>;
  /** Which of them link to the person note. */
  links: string[];
}

function appWith(vault: Vault): { app: App; reads: string[] } {
  const reads: string[] = [];
  const resolvedLinks: Record<string, Record<string, number>> = {};
  for (const path of Object.keys(vault.notes)) {
    resolvedLinks[path] = vault.links.includes(path) ? { [PERSON]: 1 } : {};
  }

  const app = {
    vault: {
      getMarkdownFiles: () => Object.keys(vault.notes).map(fileAt),
      getAbstractFileByPath: (path: string) => (path in vault.notes ? fileAt(path) : null),
      read: (file: TFile) => {
        reads.push(file.path);
        return Promise.resolve(vault.notes[file.path] ?? '');
      },
      cachedRead: (file: TFile) => Promise.resolve(vault.notes[file.path] ?? ''),
    },
    metadataCache: {
      resolvedLinks,
      getFileCache: () => ({ frontmatter: {} }),
      getFirstLinkpathDest: () => null,
    },
  } as unknown as App;

  return { app, reads };
}

const LUNCH = [
  '## 📅 Schedule',
  '- 👥 12:00-13:30 Mittagessen [[Beruf]]',
  '    - 📍 [[Gifthüttli]]',
  '    - 🧑 [[Anna Muster]]',
  '',
].join('\n');

describe('readPersonDays', () => {
  it('finds the entry that links to the person, newest day first', async () => {
    const { app } = appWith({
      notes: { [dayPath('2026-09-14')]: LUNCH, [dayPath('2026-09-18')]: LUNCH },
      links: [dayPath('2026-09-14'), dayPath('2026-09-18')],
    });

    const found = await readPersonDays(app, S, fileAt(PERSON));
    expect(found.entries.map((one) => one.day)).toEqual(['2026-09-18', '2026-09-14']);
    expect(found.entries[0]?.record.label).toBe('Mittagessen');
    expect(found.more).toBe(0);
  });

  it('reads only the notes that link there', async () => {
    // The point of asking the metadata cache rather than the day folder. A
    // vault of a thousand days costs as many reads as there are days naming
    // this person, which for most people is a handful.
    const { app, reads } = appWith({
      notes: {
        [dayPath('2026-09-14')]: LUNCH,
        [dayPath('2026-09-15')]: LUNCH,
        [dayPath('2026-09-16')]: LUNCH,
      },
      links: [dayPath('2026-09-15')],
    });

    const found = await readPersonDays(app, S, fileAt(PERSON));
    expect(reads).toEqual([dayPath('2026-09-15')]);
    expect(found.entries).toHaveLength(1);
  });

  it('ignores a note that links there and is not a day note', async () => {
    // A person can be named in a project or a bill. This block answers one
    // question, and those are not answers to it.
    const { app } = appWith({
      notes: { '3 Projects/Umzug.md': LUNCH },
      links: ['3 Projects/Umzug.md'],
    });
    expect((await readPersonDays(app, S, fileAt(PERSON))).entries).toEqual([]);
  });

  it('does not match a name that is only in the text', async () => {
    const mentioned = [
      '## 📅 Schedule',
      '- 👥 12:00-13:30 Mittagessen mit Anna Muster [[Beruf]]',
      '',
    ].join('\n');
    const { app } = appWith({
      notes: { [dayPath('2026-09-14')]: mentioned },
      links: [dayPath('2026-09-14')],
    });
    expect((await readPersonDays(app, S, fileAt(PERSON))).entries).toEqual([]);
  });

  it('counts what it does not draw rather than cutting off silently', async () => {
    const notes: Record<string, string> = {};
    for (let day = 1; day <= 6; day += 1) {
      notes[dayPath(`2026-09-0${day}`)] = LUNCH;
    }
    const { app } = appWith({ notes, links: Object.keys(notes) });

    const found = await readPersonDays(app, S, fileAt(PERSON), 4);
    expect(found.entries).toHaveLength(4);
    expect(found.more).toBe(2);
    // Newest kept, oldest dropped: what somebody is looking for is the last
    // time, not the first.
    expect(found.entries[0]?.day).toBe('2026-09-06');
  });
});
