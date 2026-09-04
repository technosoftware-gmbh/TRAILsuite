/**
 * What saving a summary is allowed to touch.
 *
 * This is the first PARA dialog that writes a note's **body**, so the question
 * is not whether the right text comes out but whether anything else moves. A
 * project note holds tasks, meeting links and whatever somebody typed under the
 * summary, and none of that was ever on the form.
 *
 * The counted `modify` is the point of the suite: a save that changes no text
 * must not write the file at all. An identical rewrite looks the same in the
 * note and different everywhere else -- in its modification time, in what a
 * sync reconciles, in what a backup thinks changed today.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({ TFile: class {}, stringifyYaml: () => '' }));

const { loadSummary, writeSummary } = await import('../src/para/summary-file');

const NOTE = [
  '---',
  'type: project',
  'status: ongoing',
  '---',
  '',
  '---',
  '',
  '> [!SUMMARY]+',
  '> Reconstitution not triggered after the upgrade.',
  '',
  '## Notizen',
  '',
  '- [ ] mit Support klaeren',
  '',
].join('\n');

let text = '';
let writes: string[] = [];

const file = { path: '3 Projekte/CN-1097838/CN-1097838.md' } as never;
const app = {
  vault: {
    read: async () => text,
    modify: async (_file: unknown, content: string) => {
      writes.push(content);
      text = content;
    },
  },
} as never;

beforeEach(() => {
  text = NOTE;
  writes = [];
});

describe('loading a summary', () => {
  it('reads the note and gives back the text', async () => {
    expect(await loadSummary(app, file)).toBe('Reconstitution not triggered after the upgrade.');
  });
});

describe('saving a summary', () => {
  it('does not write the note when the text is unchanged', async () => {
    await writeSummary(app, file, 'Reconstitution not triggered after the upgrade.');

    expect(writes).toEqual([]);
  });

  it('leaves the frontmatter and everything under the summary alone', async () => {
    await writeSummary(app, file, 'Reconstitution triggers, the minimum is wrong.');

    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain('status: ongoing');
    expect(writes[0]).toContain('- [ ] mit Support klaeren');
    expect(writes[0]).toContain('> Reconstitution triggers, the minimum is wrong.');
    expect(writes[0]).not.toContain('not triggered after the upgrade');
  });

  /**
   * The frontmatter is split off before the body is searched. A property whose
   * value opens with `>` reads as a callout to anything looking at the whole
   * file, and the block would be spliced in among the note's properties.
   */
  it('is not fooled by a property that looks like a callout', async () => {
    text = ['---', 'type: project', 'note: "> [!SUMMARY]+ nope"', '---', '', '## Notizen', ''].join(
      '\n'
    );

    await writeSummary(app, file, 'The real one.');

    expect(writes[0]?.split('\n').slice(0, 4)).toEqual([
      '---',
      'type: project',
      'note: "> [!SUMMARY]+ nope"',
      '---',
    ]);
    expect(writes[0]).toContain('> The real one.');
  });
});
