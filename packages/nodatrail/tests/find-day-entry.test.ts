/**
 * Finding the meeting a week-view click meant.
 *
 * This is the lookup that stands between a click in the week and a rewrite of
 * somebody's day note, so what is asserted here is mostly the ways it must
 * refuse.
 *
 * The reason it exists at all: the week reads a day with `readSchedule`, which
 * parses every bullet under the schedule heading -- the notes indented under a
 * meeting included -- while the editor reads the same section with
 * `readDayEntries`, which folds those into their parent. The two do not agree
 * about how many entries a day has, so counting to the nth one would sooner or
 * later open the wrong line. It matches on what both of them parsed out of the
 * line instead, and refuses whenever that is not unique.
 *
 * The positions are read fresh on every call and never kept, which is the
 * other half of the point: a week holds seven notes and a month thirty-one,
 * and a line number captured when the view was drawn is a line number that can
 * be wrong by the time anybody clicks it.
 */
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
// From 'obsidian' rather than from the stub, because this file hands the
// result to a function that wants a real TFile: vitest resolves the specifier
// to the mock below at runtime, and the typecheck sees Obsidian's own class.
import { TFile } from 'obsidian';

vi.mock('obsidian', async () => {
  const stub = await vi.importActual<typeof import('./obsidian-stub')>('./obsidian-stub');
  return { TFile: stub.TFile, normalizePath: (path: string) => path };
});

const { findDayEntry } = await import('../src/plan/read-day');

const SCHEDULE = '## 📅 Schedule';
const FILE = Object.assign(new TFile(), { path: 'day.md', basename: 'day', extension: 'md' });

function noteOf(...body: string[]) {
  const text = ['---', 'type: daily', '---', '', SCHEDULE, '', ...body, ''].join('\n');
  return { vault: { read: () => Promise.resolve(text) }, metadataCache: {} } as never;
}

const want = (from: string, to: string, text: string) => ({ from, to, text });

describe('findDayEntry', () => {
  it('finds the meeting a line names', async () => {
    const app = noteOf('- 👥 09:00-09:30 Standup', '- 👥 11:00 Review');
    const found = await findDayEntry(app, DEFAULT_SETTINGS, FILE, want('11:00', '', 'Review'));
    expect(found?.draft.text).toBe('Review');
    // The positions are the point of looking it up at all: they are what the
    // editor rewrites, and they have to be this read's, not an older one's.
    // Counted in the body, so the frontmatter is not in the number: blank,
    // heading, blank, Standup, Review.
    expect(found?.from).toBe(4);
  });

  it('finds a meeting with no time at all', async () => {
    const app = noteOf('- 👥 Zuhause');
    expect(
      (await findDayEntry(app, DEFAULT_SETTINGS, FILE, want('', '', 'Zuhause')))?.draft.text
    ).toBe('Zuhause');
  });

  it('refuses when two lines on the day say exactly the same thing', async () => {
    // Two identical lines give no way to say which was clicked, and picking
    // the first would be a coin toss with somebody's note as the stake.
    const app = noteOf('- 👥 09:00 Standup', '- 👥 09:00 Standup');
    expect(
      await findDayEntry(app, DEFAULT_SETTINGS, FILE, want('09:00', '', 'Standup'))
    ).toBeNull();
  });

  it('tells two meetings of one name apart by their times', async () => {
    const app = noteOf('- 👥 09:00 Standup', '- 👥 16:00 Standup');
    const found = await findDayEntry(app, DEFAULT_SETTINGS, FILE, want('16:00', '', 'Standup'));
    expect(found?.draft.startTime).toBe('16:00');
  });

  it('does not match a note indented under a meeting', async () => {
    // The week lists these as entries of their own; the editor does not have
    // them at all. Counting to the nth entry would be off by one from here on.
    const app = noteOf('- 👥 09:00 Standup', '    - 📝 Budget besprochen', '- 👥 11:00 Review');
    expect(
      await findDayEntry(app, DEFAULT_SETTINGS, FILE, want('', '', 'Budget besprochen'))
    ).toBeNull();
    // And the meeting after it is still found, by name rather than by position.
    expect(
      (await findDayEntry(app, DEFAULT_SETTINGS, FILE, want('11:00', '', 'Review')))?.draft.text
    ).toBe('Review');
  });

  it('does not match a follow-up task under a meeting', async () => {
    const app = noteOf('- 👥 09:00 Standup', '    - [ ] Angebot schreiben 📅 2026-09-15');
    expect(
      await findDayEntry(app, DEFAULT_SETTINGS, FILE, want('', '', 'Angebot schreiben'))
    ).toBeNull();
  });

  it('looks among the meetings and not among the thoughts', async () => {
    // A thought and an untimed meeting can read identically -- "Zuhause" is
    // both a thing you note and a thing you are. Searching both sections would
    // find two, refuse, and send somebody to the note for a line the editor
    // could have opened.
    const text = [
      '---',
      'type: daily',
      '---',
      '',
      SCHEDULE,
      '',
      '- 👥 Zuhause',
      '',
      '## 🧠 Thoughts',
      '',
      '- 📝 Zuhause',
      '',
    ].join('\n');
    const app = { vault: { read: () => Promise.resolve(text) }, metadataCache: {} } as never;
    const found = await findDayEntry(app, DEFAULT_SETTINGS, FILE, want('', '', 'Zuhause'));
    expect(found?.kind).toBe('meeting');
  });

  it('says nothing matched rather than guessing at the nearest thing', async () => {
    const app = noteOf('- 👥 09:00 Standup');
    expect(
      await findDayEntry(app, DEFAULT_SETTINGS, FILE, want('09:00', '', 'Standdup'))
    ).toBeNull();
    expect(
      await findDayEntry(app, DEFAULT_SETTINGS, FILE, want('10:00', '', 'Standup'))
    ).toBeNull();
  });

  it('finds a meeting the dialog cannot rewrite, and says so on the record', async () => {
    // Returned rather than hidden: whether a line round-trips is the caller's
    // decision to act on, and the answer to it is what `editable` is for.
    //
    // An unmarked bullet under the meeting is the case. The dialog would write
    // it back carrying the note marker, so composing the meeting does not
    // reproduce what is in the note, and rewriting it would quietly add a 📝
    // somebody did not type.
    const app = noteOf('- 👥 09:00 Standup', '    - Budget besprochen');
    const found = await findDayEntry(app, DEFAULT_SETTINGS, FILE, want('09:00', '', 'Standup'));
    expect(found).not.toBeNull();
    expect(found?.editable).toBe(false);
  });

  it('reads the note on every call rather than answering from anything kept', async () => {
    // A week holds seven notes' worth of positions and a month thirty-one, and
    // any of them can go stale while the view sits there. So there is nothing
    // to go stale: it asks the note again at the moment of the click.
    const read = vi.fn(() =>
      Promise.resolve(
        ['---', 'type: daily', '---', '', SCHEDULE, '', '- 👥 09:00 Standup'].join('\n')
      )
    );
    const app = { vault: { read }, metadataCache: {} } as never;
    await findDayEntry(app, DEFAULT_SETTINGS, FILE, want('09:00', '', 'Standup'));
    await findDayEntry(app, DEFAULT_SETTINGS, FILE, want('09:00', '', 'Standup'));
    expect(read).toHaveBeenCalledTimes(2);
  });
});
