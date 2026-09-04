/**
 * The task written for a meeting that has gone from the export.
 *
 * §G.6 stands and this is what replaces acting on it: the importer still
 * removes nothing, and instead puts the decision in front of somebody on a day
 * they will look at. So what matters here is that the task is a real task the
 * rest of the plugin understands, that it names the meeting well enough to find
 * it, and that running the same import twice does not write it twice.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { parseTaskLine, type MissingLine } from 'trail-core';
import { TFile } from './obsidian-stub';

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

const { writeMissingChecks, needsChecking, checkTaskText, pendingChecks } =
  await import('../src/plan/missing-checks');

const TODAY = '2026-09-11';
const NOW = new Date('2026-09-11T08:00:00');
const FOCUS = '## 🎯 Focus';
const path = (iso: string) => `0 Plan/1 Daily/${iso.slice(0, 4)}/${iso}.md`;

function missing(over: Partial<MissingLine> = {}): MissingLine {
  return {
    uid: 'a@example.ch',
    day: '2026-09-04',
    key: 'k',
    entry: { day: '2026-09-04', from: '13:00', text: 'Revision Defects/Findings' },
    ...over,
  };
}

function vaultOf(notes: Record<string, string> = {}) {
  const held: Record<string, string> = { ...notes };
  const writes: string[] = [];
  const created: string[] = [];

  const fileFor = (p: string) =>
    Object.assign(new TFile(), { path: p, basename: p, extension: 'md' });

  const app = {
    vault: {
      getAbstractFileByPath: (p: string) => (held[p] === undefined ? null : fileFor(p)),
      getFileByPath: (p: string) => (held[p] === undefined ? null : fileFor(p)),
      getFolderByPath: () => ({}),
      createFolder: () => Promise.resolve(),
      create: (p: string, text: string) => {
        held[p] = text;
        created.push(p);
        return Promise.resolve(fileFor(p));
      },
      read: (file: TFile) => Promise.resolve(held[file.path] ?? ''),
      cachedRead: (file: TFile) => Promise.resolve(held[file.path] ?? ''),
      modify: (file: TFile, text: string) => {
        writes.push(file.path);
        held[file.path] = text;
        return Promise.resolve();
      },
    },
    fileManager: { processFrontMatter: () => Promise.resolve() },
  } as never;

  return { app, held, writes, created };
}

/**
 * The lines under the focus heading of today's note, and no further.
 *
 * Stops at the next heading of its own accord rather than reusing the source's
 * `sectionOf`: a test that measured the code with the code's own ruler would
 * agree with it however wrong the ruler was.
 */
function focusOf(held: Record<string, string>): string[] {
  const lines = (held[path(TODAY)] ?? '').split('\n');
  const at = lines.indexOf(FOCUS);
  if (at === -1) return [];

  const out: string[] = [];
  for (const line of lines.slice(at + 1)) {
    if (/^#{1,2}\s/.test(line)) break;
    if (line.trim() !== '') out.push(line);
  }
  return out;
}

describe('needsChecking', () => {
  it('takes only the lines the notes still hold', () => {
    // A task asking somebody to look at a line that is not there is worse than
    // no task at all.
    const lines = [missing(), missing({ key: 'gone', entry: null })];

    expect(needsChecking(lines).map((one) => one.key)).toEqual(['k']);
  });
});

describe('writeMissingChecks', () => {
  it('writes one task per meeting, due today, that the task reader understands', async () => {
    const { app, held } = vaultOf({});

    const result = await writeMissingChecks(app, DEFAULT_SETTINGS, [missing()], TODAY, NOW);

    expect(result).toEqual({ written: 1, skipped: 0 });
    const [line] = focusOf(held);
    const task = line === undefined ? null : parseTaskLine(line);
    expect(task).not.toBeNull();
    expect(task?.due).toBe(TODAY);
  });

  it('names the meeting and links the day it is on', async () => {
    // The day goes in as a wikilink so the task is one click from the note it
    // is about, and `parseTaskLine` reads it back out of the text as a link.
    const { app, held } = vaultOf({});

    await writeMissingChecks(app, DEFAULT_SETTINGS, [missing()], TODAY, NOW);

    const [line] = focusOf(held);
    expect(line).toContain('Revision Defects/Findings');
    expect(line).toContain('[[2026-09-04]]');
    expect(parseTaskLine(line ?? '')?.links).toEqual(['2026-09-04']);
  });

  it('writes one task for each of three meetings', async () => {
    const { app, held, writes } = vaultOf({});

    const result = await writeMissingChecks(
      app,
      DEFAULT_SETTINGS,
      [
        missing(),
        missing({ key: 'b', entry: { day: '2026-09-04', from: '08:00', text: 'Sick Leave 30%' } }),
        missing({
          key: 'c',
          day: '2026-09-07',
          entry: { day: '2026-09-07', from: '', text: 'Zuhause' },
        }),
      ],
      TODAY,
      NOW
    );

    expect(result.written).toBe(3);
    expect(focusOf(held)).toHaveLength(3);
    // One write, whatever the count. The rest of this import holds to that and
    // a month's worth of reminders is exactly when it matters.
    expect(writes).toHaveLength(1);
  });

  it('writes nothing at all when every line is already gone from the notes', async () => {
    const { app, writes } = vaultOf({});

    const result = await writeMissingChecks(
      app,
      DEFAULT_SETTINGS,
      [missing({ entry: null })],
      TODAY,
      NOW
    );

    expect(result).toEqual({ written: 0, skipped: 0 });
    expect(writes).toEqual([]);
  });

  it('does not write the same reminder twice on a second import', async () => {
    const { app, held } = vaultOf({});

    await writeMissingChecks(app, DEFAULT_SETTINGS, [missing()], TODAY, NOW);
    const second = await writeMissingChecks(app, DEFAULT_SETTINGS, [missing()], TODAY, NOW);

    expect(second).toEqual({ written: 0, skipped: 1 });
    expect(focusOf(held)).toHaveLength(1);
  });

  it('leaves a ticked reminder ticked rather than writing a fresh one', async () => {
    // The guard matches the day and the meeting rather than the whole line, so
    // ticking the box -- which is exactly when the reminder has done its job --
    // does not bring it back on the next import.
    const { app, held } = vaultOf({});
    await writeMissingChecks(app, DEFAULT_SETTINGS, [missing()], TODAY, NOW);
    held[path(TODAY)] = (held[path(TODAY)] ?? '').replace('- [ ]', '- [x]');

    const second = await writeMissingChecks(app, DEFAULT_SETTINGS, [missing()], TODAY, NOW);

    expect(second).toEqual({ written: 0, skipped: 1 });
    expect(focusOf(held)).toHaveLength(1);
  });

  it('writes the new one and skips the one already there', async () => {
    const { app, held } = vaultOf({});
    await writeMissingChecks(app, DEFAULT_SETTINGS, [missing()], TODAY, NOW);

    const second = await writeMissingChecks(
      app,
      DEFAULT_SETTINGS,
      [
        missing(),
        missing({ key: 'b', entry: { day: '2026-09-04', from: '08:00', text: 'Sick Leave 30%' } }),
      ],
      TODAY,
      NOW
    );

    expect(second).toEqual({ written: 1, skipped: 1 });
    expect(focusOf(held)).toHaveLength(2);
  });

  it('is not fooled by the meeting appearing elsewhere in the same note', async () => {
    // The guard looks under the focus heading and nowhere else. An import run
    // on the day of the meeting would otherwise read the meeting's own line as
    // a reminder about itself and write nothing.
    // Focus first and the schedule after it, so a section walk that ran past
    // its own heading would find the meeting's line and call the reminder
    // written.
    const { app, held } = vaultOf({
      [path(TODAY)]:
        `---\ntype: "day"\n---\n\n${FOCUS}\n\n- [ ] Etwas anderes\n\n## 📅 Schedule\n\n- 👥 13:00-14:00 Revision Defects/Findings [[2026-09-04]]\n`,
    });

    const result = await writeMissingChecks(app, DEFAULT_SETTINGS, [missing()], TODAY, NOW);

    expect(result).toEqual({ written: 1, skipped: 0 });
    expect(focusOf(held)).toHaveLength(2);
  });

  it('makes today note when there is not one, rather than losing the reminder', async () => {
    // A reminder that depended on somebody having captured something today
    // already would go missing on exactly the days nothing else was written.
    const { app, created } = vaultOf({});

    await writeMissingChecks(app, DEFAULT_SETTINGS, [missing()], TODAY, NOW);

    expect(created).toEqual([path(TODAY)]);
  });

  it('refuses a today that is not a day at all rather than guessing', async () => {
    const { app, writes } = vaultOf({});

    const result = await writeMissingChecks(app, DEFAULT_SETTINGS, [missing()], 'later', NOW);

    expect(result).toEqual({ written: 0, skipped: 0 });
    expect(writes).toEqual([]);
  });
});

describe('checkTaskText', () => {
  it('falls back to the key when the entry has gone, rather than saying nothing', () => {
    expect(checkTaskText(missing({ entry: null }))).toContain('k');
  });
});

describe('pendingChecks', () => {
  // The case that made this exist. An import where every meeting is already in
  // the notes and one has gone from the export still has work to do, and the
  // dialog counted only the lines it would add -- so the button sat disabled
  // and the reminder was never written.
  it('counts what a run would write when there is nothing else to import', async () => {
    const { app } = vaultOf({});

    expect(await pendingChecks(app, DEFAULT_SETTINGS, [missing()], TODAY)).toHaveLength(1);
  });

  it('counts nothing once the reminder is on the list', async () => {
    const { app } = vaultOf({});
    await writeMissingChecks(app, DEFAULT_SETTINGS, [missing()], TODAY, NOW);

    expect(await pendingChecks(app, DEFAULT_SETTINGS, [missing()], TODAY)).toEqual([]);
  });

  it('counts nothing for a line the notes no longer hold', async () => {
    const { app } = vaultOf({});

    expect(await pendingChecks(app, DEFAULT_SETTINGS, [missing({ entry: null })], TODAY)).toEqual(
      []
    );
  });

  it('creates no note just to answer', async () => {
    // It runs on every replan, including every nudge of the date fields. A
    // count that made a day note as a side effect would leave one behind for
    // every range somebody tried.
    const { app, created, writes } = vaultOf({});

    await pendingChecks(app, DEFAULT_SETTINGS, [missing()], TODAY);

    expect(created).toEqual([]);
    expect(writes).toEqual([]);
  });

  it('agrees with what the write then does', async () => {
    // The preview and the write must not disagree about the count, which is
    // the only reason both go through `alreadyNamed`.
    const { app } = vaultOf({});
    const pending = await pendingChecks(app, DEFAULT_SETTINGS, [missing()], TODAY);

    const result = await writeMissingChecks(app, DEFAULT_SETTINGS, [missing()], TODAY, NOW);

    expect(result.written).toBe(pending.length);
  });
});

describe('the button that has to offer the run', () => {
  /**
   * Source-shape assertions, and they prove nothing renders.
   *
   * No suite in this package draws a modal: vitest runs in `node` and the
   * obsidian stub has no `Modal` or `Setting`. So this pins the one line the
   * bug was in rather than the behaviour, which is worth having precisely
   * because that line looked right and was not: the footer counted the meetings
   * it would add, an import with nothing to add sat there disabled, and the
   * reminder it should have written was never written.
   */
  const modal = readFileSync(
    new URL('../src/plan/calendar-import-modal.ts', import.meta.url),
    'utf8'
  );

  it('counts the reminders as well as the lines before disabling itself', () => {
    expect(modal).toContain('.setDisabled(lines + checks === 0 || this.busy)');
  });

  it('works the reminders out with the plan rather than at the write', () => {
    // In `replan`, so the count on the button is the count the press produces.
    expect(modal).toContain('this.checks = await pendingChecks(');
  });

  it('says what the press will do in each of the three shapes', () => {
    for (const key of [
      "t('calendar.write'",
      "t('calendar.writeChecks'",
      "t('calendar.writeAndCheck'",
    ]) {
      expect(modal, key).toContain(key);
    }
  });
});
