/**
 * What saving a trip overview is allowed to touch.
 *
 * The one place APERtrail writes a note's **body** rather than its frontmatter,
 * so the question is not whether the right text comes out but whether anything
 * else moves. A trip note holds the itinerary and cost blocks under its
 * summary, and none of that was ever on the form.
 *
 * The counted `modify` is the point of the suite: a save that changes no text
 * must not write the file at all. An identical rewrite looks the same in the
 * note and different everywhere else -- in its modification time, in what a
 * sync reconciles, in what a backup thinks changed today.
 *
 * NODAtrail carries the same suite over `para/summary-file.ts`. The format they
 * share is one file in `trail-core` now; these two are what each plugin does
 * with it, which is not shared and should not be.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({ TFile: class {}, stringifyYaml: () => '' }));

const { loadTripSummary, writeTripSummary } = await import('../src/trips/write-trip-summary');

const NOTE = [
  '---',
  'type: trip',
  'subtitle: Zugreise in Suedafrika',
  '---',
  '',
  '---',
  '',
  '> [!SUMMARY]+',
  '> Eine Zugreise durch das suedliche Afrika.',
  '',
  '```travel-itinerary',
  '```',
  '',
  '```apt-trip-costs',
  '```',
  '',
].join('\n');

let text = '';
let writes: string[] = [];

const file = { path: 'Trips/Shongololo/Shongololo.md' } as never;
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

describe('loading an overview', () => {
  it('reads the note and gives back the text', async () => {
    expect(await loadTripSummary(app, file)).toBe('Eine Zugreise durch das suedliche Afrika.');
  });

  /**
   * The callout marker is not part of what the note says.
   *
   * Stated here as well as in the core suite because this is the path an
   * export and the trip editor both take, and the failure is silent: the
   * overview simply opens with `[!SUMMARY]+` and reads as if somebody typed
   * it.
   */
  it('leaves the callout marker out of the text', async () => {
    expect(await loadTripSummary(app, file)).not.toContain('[!SUMMARY]');
  });
});

describe('saving an overview', () => {
  it('does not write the note when the text is unchanged', async () => {
    await writeTripSummary(app, file, 'Eine Zugreise durch das suedliche Afrika.');

    expect(writes).toEqual([]);
  });

  it('leaves the frontmatter and both blocks alone', async () => {
    await writeTripSummary(app, file, 'Zwoelf Tage im Nostalgiezug.');

    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain('subtitle: Zugreise in Suedafrika');
    expect(writes[0]).toContain('```travel-itinerary');
    expect(writes[0]).toContain('```apt-trip-costs');
    expect(writes[0]).toContain('> Zwoelf Tage im Nostalgiezug.');
    expect(writes[0]).not.toContain('suedliche Afrika');
  });

  /**
   * The frontmatter is split off before the body is searched. A property whose
   * value opens with `>` reads as a callout to anything looking at the whole
   * file, and the block would be spliced in among the note's properties.
   */
  it('is not fooled by a property that looks like a callout', async () => {
    text = [
      '---',
      'type: trip',
      'subtitle: "> [!SUMMARY]+ nope"',
      '---',
      '',
      '## Notizen',
      '',
    ].join('\n');

    await writeTripSummary(app, file, 'The real one.');

    expect(writes[0]?.split('\n').slice(0, 4)).toEqual([
      '---',
      'type: trip',
      'subtitle: "> [!SUMMARY]+ nope"',
      '---',
    ]);
    expect(writes[0]).toContain('> The real one.');
  });
});
