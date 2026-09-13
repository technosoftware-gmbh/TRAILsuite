/**
 * Writing a line over a range of days, and finding it again afterwards.
 *
 * **The finding is the half worth testing.** Writing fourteen lines is a loop.
 * Recovering which fourteen they were, from nothing but the lines themselves,
 * is the claim this feature rests on -- and it is the same claim §D of
 * `calendar-import.md` makes about the importer's history, arrived at for the
 * same reason: a counter in the line would make the walk trivial and would put
 * a new element into a note format that is easier to add to than to take back.
 *
 * So what has to hold, or a delete leaves stray days behind:
 *
 * - the walk stops where the line stops, in both directions, and the day
 *   somebody clicked is always in the answer;
 * - a day saying it twice is a boundary and is **named**, because the span may
 *   really run further and a dialog that quietly claimed otherwise is how two
 *   days get left behind;
 * - a day whose line says more than the dialog can compose back is the same
 *   kind of boundary, since rewriting it would drop what the dialog cannot
 *   hold;
 * - a kind that cannot span comes back as itself, one day long.
 */
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
// From 'obsidian' rather than from the stub, for `find-day-entry.test.ts`'s
// reason: these files are handed to functions that want a real TFile. vitest
// resolves the specifier to the mock below at runtime, and the typecheck sees
// Obsidian's own class.
import { TFile } from 'obsidian';

vi.mock('obsidian', async () => {
  const stub = await vi.importActual<typeof import('./obsidian-stub')>('./obsidian-stub');
  return {
    TFile: stub.TFile,
    normalizePath: (path: string) => path,
    stringifyYaml: (value: Record<string, unknown>) =>
      Object.entries(value)
        .map(([key, one]) => `${key}: ${JSON.stringify(one)}`)
        .join('\n'),
  };
});

const { findDaySpan } = await import('../src/plan/day-span');
const { daysOfSpan, rewriteDaySpan, writeDaySpan } = await import('../src/plan/write-day-span');
const { readDayEntries } = await import('../src/plan/read-day');
const { emptyDraft } = await import('../src/plan/add-to-day');

const SCHEDULE = '## 📅 Schedule';
const THOUGHTS = '## 🧠 Thoughts';
const NOW = new Date(2026, 6, 13, 9, 0, 0);

const path = (iso: string) => `0 Plan/1 Daily/${iso.slice(0, 4)}/${iso}.md`;

/** A day note holding the given body lines under the given heading. */
function note(heading: string, ...lines: string[]): string {
  return ['---', 'type: day', '---', '', heading, ...lines, ''].join('\n');
}

function vaultOf(notes: Record<string, string>) {
  const held: Record<string, string> = { ...notes };

  const fileFor = (path: string) =>
    Object.assign(new TFile(), {
      path,
      name: path.slice(path.lastIndexOf('/') + 1),
      basename: path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''),
      extension: 'md',
    });

  const app = {
    vault: {
      getAbstractFileByPath: (path: string) => (held[path] === undefined ? null : fileFor(path)),
      getFileByPath: (path: string) => (held[path] === undefined ? null : fileFor(path)),
      getFolderByPath: () => ({}),
      createFolder: () => Promise.resolve(),
      create: (path: string, text: string) => {
        held[path] = text;
        return Promise.resolve(fileFor(path));
      },
      read: (file: TFile) => Promise.resolve(held[file.path] ?? ''),
      cachedRead: (file: TFile) => Promise.resolve(held[file.path] ?? ''),
      modify: (file: TFile, text: string) => {
        held[file.path] = text;
        return Promise.resolve();
      },
    },
    fileManager: { processFrontMatter: () => Promise.resolve() },
  } as never;

  return { app, held, fileFor };
}

/** A vault whose every day from `from` to `to` carries the same span line. */
function holidayVault(from: string, to: string, line = '- 🏖️ Ferien Sardinien') {
  const notes: Record<string, string> = {};
  for (const day of daysOfSpan(from, to)) notes[path(day)] = note(SCHEDULE, line);
  return vaultOf(notes);
}

/** The record for the one entry on a day, so a test can anchor a walk on it. */
async function anchorOn(app: never, day: string, kind: 'span' | 'note' | 'idea' = 'span') {
  const file = Object.assign(new TFile(), {
    path: path(day),
    name: `${day}.md`,
    basename: day,
    extension: 'md',
  });
  const { meetings, thoughts } = await readDayEntries(app, DEFAULT_SETTINGS, file);
  const entry = (kind === 'span' ? meetings : thoughts)[0];
  if (!entry) throw new Error(`no entry on ${day}`);
  return { file, entry };
}

describe('daysOfSpan', () => {
  it('is every day from the first to the last, inclusive', () => {
    expect(daysOfSpan('2026-07-13', '2026-07-16')).toEqual([
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
    ]);
  });

  it('is one day when the two are the same day', () => {
    expect(daysOfSpan('2026-07-13', '2026-07-13')).toEqual(['2026-07-13']);
  });

  it('is nothing at all when the last day is before the first', () => {
    // Not an error, and not a silently reversed range either. A dialog that
    // swapped them would write a fortnight nobody asked for; this hands back
    // nothing and `blocker()` refuses the save before it gets here.
    expect(daysOfSpan('2026-07-16', '2026-07-13')).toEqual([]);
  });

  it('crosses a month and a year', () => {
    expect(daysOfSpan('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });
});

describe('writeDaySpan', () => {
  const span = { ...emptyDraft('span'), text: 'Ferien Sardinien' };

  it('writes the same line into every day of the range', async () => {
    const { app, held } = vaultOf({});
    const result = await writeDaySpan(app, DEFAULT_SETTINGS, span, '2026-07-13', '2026-07-15', NOW);

    expect(result).toEqual({ written: 3, skipped: 0 });
    for (const day of ['2026-07-13', '2026-07-14', '2026-07-15']) {
      expect(held[path(day)]).toContain('- 🏖️ Ferien Sardinien');
    }
  });

  it('creates the day notes that were not there, with frontmatter and no body', async () => {
    const { app, held } = vaultOf({});
    await writeDaySpan(app, DEFAULT_SETTINGS, span, '2026-07-13', '2026-07-14', NOW);
    // The heading appears because a line needs it, not because the note was
    // made: a fortnight that seeded headings into fourteen empty days would be
    // doing to a vault what `openOrCreatePeriodNote` exists to refuse.
    expect(held[path('2026-07-13')]).toContain('type: "day"');
    expect(held[path('2026-07-13')]).toContain('📅');
  });

  it('leaves a day that already says this exactly as it was', async () => {
    // Saving the same span twice -- correcting the end date, or pressing the
    // button again because nothing seemed to happen -- must not double the
    // days that overlap.
    const { app, held } = holidayVault('2026-07-13', '2026-07-14');
    const before = held[path('2026-07-13')];

    const result = await writeDaySpan(app, DEFAULT_SETTINGS, span, '2026-07-13', '2026-07-16', NOW);

    expect(result).toEqual({ written: 2, skipped: 2 });
    expect(held[path('2026-07-13')]).toBe(before);
    expect(held[path('2026-07-15')]).toContain('- 🏖️ Ferien Sardinien');
  });

  it('writes nothing at all for a range that runs backwards', async () => {
    const { app, held } = vaultOf({});
    const result = await writeDaySpan(app, DEFAULT_SETTINGS, span, '2026-07-16', '2026-07-13', NOW);
    expect(result).toEqual({ written: 0, skipped: 0 });
    expect(Object.keys(held)).toEqual([]);
  });

  it('writes a note under the thoughts heading, not the schedule', async () => {
    const { app, held } = vaultOf({});
    await writeDaySpan(
      app,
      DEFAULT_SETTINGS,
      { ...emptyDraft('note'), text: 'Kurs Woche 1' },
      '2026-07-13',
      '2026-07-14',
      NOW
    );
    expect(held[path('2026-07-13')]).toContain('🧠');
    expect(held[path('2026-07-13')]).toContain('- 📝 Kurs Woche 1');
  });
});

describe('findDaySpan', () => {
  it('walks out in both directions from the day that was clicked', async () => {
    const { app } = holidayVault('2026-07-13', '2026-07-26');
    const anchor = await anchorOn(app, '2026-07-19');

    const found = await findDaySpan(app, DEFAULT_SETTINGS, '2026-07-19', anchor);
    expect(found.from).toBe('2026-07-13');
    expect(found.to).toBe('2026-07-26');
    expect(found.days).toHaveLength(14);
    expect(found.refused).toEqual([]);
  });

  it('hands the days over in date order, which is the order they are written in', async () => {
    const { app } = holidayVault('2026-07-13', '2026-07-16');
    const anchor = await anchorOn(app, '2026-07-15');
    const found = await findDaySpan(app, DEFAULT_SETTINGS, '2026-07-15', anchor);
    expect(found.days.map((one) => one.day)).toEqual([
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
    ]);
  });

  it('stops at a day that says nothing like it', async () => {
    const { app, held } = holidayVault('2026-07-13', '2026-07-18');
    held[path('2026-07-16')] = note(SCHEDULE, '- 👥 09:00 Standup');

    const anchor = await anchorOn(app, '2026-07-14');
    const found = await findDaySpan(app, DEFAULT_SETTINGS, '2026-07-14', anchor);
    expect(found.from).toBe('2026-07-13');
    expect(found.to).toBe('2026-07-15');
    expect(found.refused).toEqual([]);
  });

  it('stops at a missing day note, which is the commonest edge there is', async () => {
    const { app, held } = holidayVault('2026-07-13', '2026-07-16');
    delete held[path('2026-07-15')];

    const anchor = await anchorOn(app, '2026-07-13');
    const found = await findDaySpan(app, DEFAULT_SETTINGS, '2026-07-13', anchor);
    expect(found.to).toBe('2026-07-14');
  });

  it('names the day it stopped at when that day says the same thing twice', async () => {
    // The span may really run further. A dialog that claimed otherwise would
    // delete twelve days of fourteen and say it was done.
    const { app, held } = holidayVault('2026-07-13', '2026-07-16');
    held[path('2026-07-15')] = note(SCHEDULE, '- 🏖️ Ferien Sardinien', '- 🏖️ Ferien Sardinien');

    const anchor = await anchorOn(app, '2026-07-13');
    const found = await findDaySpan(app, DEFAULT_SETTINGS, '2026-07-13', anchor);
    expect(found.to).toBe('2026-07-14');
    expect(found.refused).toEqual([{ day: '2026-07-15', why: 'ambiguous' }]);
  });

  it('names a day whose line says more than the dialog can compose back', async () => {
    // `read-day.ts`'s rule, and it does not get weaker for being reached from
    // here: rewriting that line would drop the part with no field. A second
    // wikilink is the cheapest example -- the dialog holds one project, so
    // composing the draft back gives a line with one link where the note has
    // two, and the text and the project both still match.
    const { app, held } = holidayVault(
      '2026-07-13',
      '2026-07-16',
      '- 🏖️ Ferien Sardinien [[Sommer]]'
    );
    held[path('2026-07-15')] = note(SCHEDULE, '- 🏖️ Ferien Sardinien [[Sommer]] [[Reise]]');

    const anchor = await anchorOn(app, '2026-07-13');
    const found = await findDaySpan(app, DEFAULT_SETTINGS, '2026-07-13', anchor);
    expect(found.to).toBe('2026-07-14');
    expect(found.refused).toEqual([{ day: '2026-07-15', why: 'not-editable' }]);
  });

  it('keeps the clicked day even when both its neighbours say nothing', async () => {
    const { app } = holidayVault('2026-07-13', '2026-07-13');
    const anchor = await anchorOn(app, '2026-07-13');
    const found = await findDaySpan(app, DEFAULT_SETTINGS, '2026-07-13', anchor);
    expect(found.days.map((one) => one.day)).toEqual(['2026-07-13']);
    expect(found.from).toBe(found.to);
  });

  it('tells one span from another with the same text but a different project', async () => {
    const { app, held } = holidayVault('2026-07-13', '2026-07-16');
    held[path('2026-07-15')] = note(SCHEDULE, '- 🏖️ Ferien Sardinien [[Umzug]]');

    const anchor = await anchorOn(app, '2026-07-13');
    const found = await findDaySpan(app, DEFAULT_SETTINGS, '2026-07-13', anchor);
    expect(found.to).toBe('2026-07-14');
  });

  it('walks a run of notes, which sit in the other section', async () => {
    const notes: Record<string, string> = {};
    for (const day of daysOfSpan('2026-07-13', '2026-07-15')) {
      notes[path(day)] = note(THOUGHTS, '- 📝 Kurs Woche 1');
    }
    const { app } = vaultOf(notes);

    const anchor = await anchorOn(app, '2026-07-14', 'note');
    const found = await findDaySpan(app, DEFAULT_SETTINGS, '2026-07-14', anchor);
    expect(found.days).toHaveLength(3);
  });

  it('does not walk for a meeting, whatever its neighbours say', async () => {
    // A meeting carries a clock, and one that ran for a fortnight is not a
    // meeting. `SPANNING_KINDS` holds that and this only reads it.
    const notes: Record<string, string> = {};
    for (const day of daysOfSpan('2026-07-13', '2026-07-15')) {
      notes[path(day)] = note(SCHEDULE, '- 👥 Zahnarzt');
    }
    const { app } = vaultOf(notes);

    const anchor = await anchorOn(app, '2026-07-14');
    const found = await findDaySpan(app, DEFAULT_SETTINGS, '2026-07-14', anchor);
    expect(found.days).toHaveLength(1);
  });
});

describe('rewriteDaySpan', () => {
  it('changes the line on every day of the span', async () => {
    const { app, held } = holidayVault('2026-07-13', '2026-07-15');
    const anchor = await anchorOn(app, '2026-07-13');
    const found = await findDaySpan(app, DEFAULT_SETTINGS, '2026-07-13', anchor);

    const result = await rewriteDaySpan(app, DEFAULT_SETTINGS, found.days, ['- 🏖️ Ferien Korsika']);

    expect(result).toEqual({ changed: 3, refused: [] });
    for (const day of found.days) {
      expect(held[path(day.day)]).toContain('- 🏖️ Ferien Korsika');
      expect(held[path(day.day)]).not.toContain('Sardinien');
    }
  });

  it('removes it from every day when the lines are none', async () => {
    const { app, held } = holidayVault('2026-07-13', '2026-07-15');
    const anchor = await anchorOn(app, '2026-07-14');
    const found = await findDaySpan(app, DEFAULT_SETTINGS, '2026-07-14', anchor);

    expect(await rewriteDaySpan(app, DEFAULT_SETTINGS, found.days, [])).toEqual({
      changed: 3,
      refused: [],
    });
    for (const day of found.days) expect(held[path(day.day)]).not.toContain('Ferien');
  });

  it('names the days it would not touch and still writes the rest', async () => {
    // Stopping half way through a fortnight would leave a span that is partly
    // the old text and partly the new, with nothing saying where the seam is.
    const { app, held } = holidayVault('2026-07-13', '2026-07-15');
    const anchor = await anchorOn(app, '2026-07-13');
    const found = await findDaySpan(app, DEFAULT_SETTINGS, '2026-07-13', anchor);

    // The note moves under the preview, which is what an edit in Obsidian
    // between opening the dialog and pressing Save looks like.
    held[path('2026-07-14')] = note(SCHEDULE, '- 👥 08:00 Taxi', '- 🏖️ Ferien Sardinien');

    const result = await rewriteDaySpan(app, DEFAULT_SETTINGS, found.days, []);
    expect(result.refused).toEqual(['2026-07-14']);
    expect(result.changed).toBe(2);
    expect(held[path('2026-07-14')]).toContain('Ferien Sardinien');
    expect(held[path('2026-07-15')]).not.toContain('Ferien');
  });
});
