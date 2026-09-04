/**
 * Reading a month of meetings.
 *
 * The parsing of one line is `parseScheduleLine`'s and is covered next door.
 * What is asserted here is the range half: that a day with no note is skipped
 * rather than reported empty, that a folder sitting where a note should be
 * does not reach the reader, and that a day whose note exists but holds no
 * schedule is absent too -- because every caller draws "nothing on this day"
 * from the absence, and a day present with an empty list would be a second way
 * of saying the same thing.
 */
import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { readScheduleRange } from '../src/plan/read-schedule-range';

const SCHEDULE = '## 📅 Schedule';

/**
 * A vault holding the given notes by path, and nothing else.
 *
 * Only the two members the reader touches: looking a path up, and reading it.
 * Notes come back as real `TFile` instances -- the stub exports the class for
 * exactly this -- because the reader narrows with `instanceof`, and a plain
 * object would be rejected as if it were a folder and pass the tests for the
 * wrong reason. A folder comes back as a plain object, which is what one is
 * here: not a TFile.
 */
function vaultOf(notes: Record<string, string>, folders: string[] = []) {
  return {
    vault: {
      getAbstractFileByPath: (path: string) => {
        if (folders.includes(path)) return { path };
        if (notes[path] === undefined) return null;
        return Object.assign(new TFile(), { path, basename: path, extension: 'md' });
      },
      // Rejects for anything that is not a file, as Obsidian's own read does
      // when handed a folder. Resolving '' instead made the folder case pass
      // whether or not the reader guarded against it -- an empty note and an
      // unreadable one look the same once both end up with no entries.
      read: (file: TFile | { path: string }) => {
        if (!(file instanceof TFile)) {
          return Promise.reject(new Error(`not a file: ${file.path}`));
        }
        return Promise.resolve(notes[file.path] ?? '');
      },
    },
    metadataCache: {},
  } as never;
}

/** The path DEFAULT_SETTINGS writes a given day's note at. */
function dayPath(iso: string): string {
  const [year] = iso.split('-');
  return `0 Plan/1 Daily/${year}/${iso}.md`;
}

const DAYS = ['2026-09-01', '2026-09-02', '2026-09-03'];

describe('readScheduleRange', () => {
  it('finds the meetings of the days that have them', async () => {
    const app = vaultOf({
      [dayPath('2026-09-02')]:
        `---\ntype: day\n---\n${SCHEDULE}\n\n- 👥 11:00-12:00 PMQ [[Beruf]]\n- 👥 14:30 Zahnarzt\n`,
    });

    const found = await readScheduleRange(app, DEFAULT_SETTINGS, DAYS);
    expect([...found.keys()]).toEqual(['2026-09-02']);
    expect(found.get('2026-09-02')?.entries.map((entry) => entry.text)).toEqual([
      'PMQ',
      'Zahnarzt',
    ]);
    expect(found.get('2026-09-02')?.entries[0]?.from).toBe('11:00');
  });

  it('skips a day with no note at all', async () => {
    // The common case by a wide margin: most days have no daily note, and a
    // month that reported thirty-one empty days would make every caller check
    // for emptiness twice.
    const found = await readScheduleRange(vaultOf({}), DEFAULT_SETTINGS, DAYS);
    expect(found.size).toBe(0);
  });

  it('skips a note that has no schedule section', async () => {
    const app = vaultOf({
      [dayPath('2026-09-02')]: `---\ntype: day\n---\n## 🎯 Focus\n\n- [ ] etwas\n`,
    });
    expect((await readScheduleRange(app, DEFAULT_SETTINGS, DAYS)).size).toBe(0);
  });

  it('does not try to read a folder sitting at the note path', async () => {
    // A vault where somebody made a folder named like the day note. Passing it
    // to the reader would ask Obsidian to read a directory.
    const app = vaultOf({}, [dayPath('2026-09-02')]);
    expect((await readScheduleRange(app, DEFAULT_SETTINGS, DAYS)).size).toBe(0);
  });

  it('ignores a day string that is not a date', async () => {
    const found = await readScheduleRange(vaultOf({}), DEFAULT_SETTINGS, ['not a day']);
    expect(found.size).toBe(0);
  });

  it('keeps the note order rather than sorting by time', async () => {
    // readSchedule's own rule, asserted here because the range reader is where
    // somebody would be tempted to tidy the list on the way past.
    const app = vaultOf({
      [dayPath('2026-09-02')]:
        `---\ntype: day\n---\n${SCHEDULE}\n\n- 👥 16:00 spät\n- 👥 09:00 früh\n`,
    });
    const found = await readScheduleRange(app, DEFAULT_SETTINGS, DAYS);
    expect(found.get('2026-09-02')?.entries.map((entry) => entry.text)).toEqual(['spät', 'früh']);
  });
});
