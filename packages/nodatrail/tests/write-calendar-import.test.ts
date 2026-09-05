/**
 * Putting imported meetings into day notes.
 *
 * This is the file where an importer touches somebody's records, so what is
 * asserted here is not that it writes but *what* and *how often*:
 *
 * - the line it writes is the line the capture dialog writes, because §D's
 *   derived key only works while an imported meeting and a typed one are
 *   indistinguishable;
 * - a day with six meetings is one read and one write, not six, which is the
 *   lesson `import-write.ts` already records;
 * - nothing the plan did not mark gets written, and a day note that did not
 *   exist gains frontmatter and no body.
 */
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import type { CalendarProposal } from '@technosoftware/trail-core';
import { TFile } from './obsidian-stub';

vi.mock('obsidian', async () => {
  const stub = await vi.importActual<typeof import('./obsidian-stub')>('./obsidian-stub');
  return {
    TFile: stub.TFile,
    normalizePath: (path: string) => path,
    // Enough of YAML for a day note's two properties. The stamp's shape is
    // covered by its own suite; what this file needs is a frontmatter block
    // that `splitFrontmatterBlock` can find the end of.
    stringifyYaml: (value: Record<string, unknown>) =>
      Object.entries(value)
        .map(([key, one]) => `${key}: ${JSON.stringify(one)}`)
        .join('\n'),
  };
});

const { writeCalendarImport, linesFor, attendanceOf } =
  await import('../src/plan/write-calendar-import');

const SCHEDULE = '## 📅 Schedule';

function proposal(over: Partial<CalendarProposal>): CalendarProposal {
  return {
    uid: 'a@example.ch',
    day: '2026-09-14',
    from: '09:00',
    to: '09:30',
    summary: 'Standup',
    location: '',
    partstat: 'ACCEPTED',
    updates: null,
    key: 'k',
    status: 'new',
    writes: true,
    span: null,
    stale: null,
    unsupported: [],
    ...over,
  };
}

/** A vault that counts what it was asked to do, because how often is half the point. */
function vaultOf(notes: Record<string, string> = {}) {
  const held: Record<string, string> = { ...notes };
  const reads: string[] = [];
  const writes: string[] = [];
  const created: string[] = [];

  const fileFor = (path: string) =>
    Object.assign(new TFile(), { path, basename: path, extension: 'md' });

  const app = {
    vault: {
      getAbstractFileByPath: (path: string) => (held[path] === undefined ? null : fileFor(path)),
      getFolderByPath: () => ({}),
      createFolder: () => Promise.resolve(),
      create: (path: string, text: string) => {
        held[path] = text;
        created.push(path);
        return Promise.resolve(fileFor(path));
      },
      read: (file: TFile) => {
        reads.push(file.path);
        return Promise.resolve(held[file.path] ?? '');
      },
      cachedRead: (file: TFile) => Promise.resolve(held[file.path] ?? ''),
      modify: (file: TFile, text: string) => {
        writes.push(file.path);
        held[file.path] = text;
        return Promise.resolve();
      },
      // touchModified reaches for this; the stamp is not what is under test.
      getFileByPath: (path: string) => (held[path] === undefined ? null : fileFor(path)),
    },
    fileManager: {
      processFrontMatter: () => Promise.resolve(),
    },
  } as never;

  return { app, held, reads, writes, created };
}

const path = (iso: string) => `0 Plan/1 Daily/${iso.slice(0, 4)}/${iso}.md`;
const NOW = new Date('2026-09-14T08:00:00');

describe('linesFor', () => {
  it('writes the line the capture dialog writes', () => {
    // Not a template of its own. §D's derived key holds only while an imported
    // meeting and a typed one are the same thing, and the day view, the week
    // view and the editing dialog all read the dialog's shape.
    expect(linesFor(DEFAULT_SETTINGS, [proposal({})])).toEqual(['- 👥 09:00-09:30 Standup']);
  });

  it('writes a start with no end, and an end with no start', () => {
    expect(linesFor(DEFAULT_SETTINGS, [proposal({ to: '' })])).toEqual(['- 👥 09:00 Standup']);
    expect(linesFor(DEFAULT_SETTINGS, [proposal({ from: '' })])).toEqual(['- 👥 -09:30 Standup']);
  });

  it('writes an all-day meeting with no time at all', () => {
    expect(linesFor(DEFAULT_SETTINGS, [proposal({ from: '', to: '', summary: 'Ferien' })])).toEqual(
      ['- 👥 Ferien']
    );
  });

  it('uses the configured marker rather than a literal', () => {
    expect(linesFor({ ...DEFAULT_SETTINGS, dayMeetingMarker: '📅' }, [proposal({})])).toEqual([
      '- 📅 09:00-09:30 Standup',
    ]);
  });

  it('writes nothing for a meeting with no text, rather than an empty bullet', () => {
    expect(linesFor(DEFAULT_SETTINGS, [proposal({ summary: '  ' })])).toEqual([]);
  });
});

describe('writeCalendarImport', () => {
  it('creates a day note that was not there, with frontmatter and no body of ours', async () => {
    const { app, held, created } = vaultOf();
    const result = await writeCalendarImport(app, DEFAULT_SETTINGS, [proposal({})], NOW);

    expect(created).toEqual([path('2026-09-14')]);
    expect(held[path('2026-09-14')]).toContain('- 👥 09:00-09:30 Standup');
    // The heading appears because the first meeting needed it, not because a
    // month of empty days was seeded with headings nobody asked for.
    expect(held[path('2026-09-14')]).toContain(SCHEDULE);
    expect(result).toMatchObject({ written: 1, notes: 1 });
  });

  it('appends under a schedule the note already has', async () => {
    const before = `---\ntype: daily\n---\n\n${SCHEDULE}\n\n- 👥 08:00 Frühstück\n`;
    const { app, held } = vaultOf({ [path('2026-09-14')]: before });
    await writeCalendarImport(app, DEFAULT_SETTINGS, [proposal({})], NOW);

    const lines = (held[path('2026-09-14')] ?? '').split('\n');
    expect(lines.filter((line) => line.startsWith('## ')).length).toBe(1);
    expect(lines.indexOf('- 👥 08:00 Frühstück')).toBeLessThan(
      lines.indexOf('- 👥 09:00-09:30 Standup')
    );
  });

  it('reads and writes a day once however many meetings it gains', async () => {
    // Six rewrites of one note is six chances for a concurrent edit to be
    // lost. The lesson is `import-write.ts`'s, and it applies here for the
    // same reason: an imported week arrives all at once.
    const { app, reads, writes } = vaultOf();
    const six = Array.from({ length: 6 }, (unused, index) =>
      proposal({ uid: `u${index}@example.ch`, from: `1${index}:00`, summary: `Termin ${index}` })
    );
    const result = await writeCalendarImport(app, DEFAULT_SETTINGS, six, NOW);

    expect(reads).toHaveLength(1);
    expect(writes).toHaveLength(1);
    expect(result).toMatchObject({ written: 6, notes: 1 });
  });

  it('writes one note per day, in date order', async () => {
    const { app, writes } = vaultOf();
    await writeCalendarImport(
      app,
      DEFAULT_SETTINGS,
      [
        proposal({ day: '2026-09-16', uid: 'c@example.ch' }),
        proposal({ day: '2026-09-14', uid: 'a@example.ch' }),
        proposal({ day: '2026-09-15', uid: 'b@example.ch' }),
      ],
      NOW
    );
    // In order, so a run that fails part way through has filled the days
    // before the failure rather than a scattering of them.
    expect(writes).toEqual([path('2026-09-14'), path('2026-09-15'), path('2026-09-16')]);
  });

  it('writes only what the plan marked', async () => {
    // The rule lives in the plan. Deciding it again here would be two places
    // holding one rule, and they would disagree the first time one changed.
    const { app, held, writes } = vaultOf();
    const result = await writeCalendarImport(
      app,
      DEFAULT_SETTINGS,
      [
        proposal({ status: 'already-present', writes: false }),
        proposal({ uid: 'b@example.ch', status: 'edited-here', writes: false, from: '11:00' }),
        proposal({ uid: 'c@example.ch', status: 'unsupported-rule', writes: false, from: '12:00' }),
      ],
      NOW
    );

    expect(result).toMatchObject({ written: 0, notes: 0 });
    expect(writes).toEqual([]);
    expect(held[path('2026-09-14')]).toBeUndefined();
  });

  it('reports what it wrote, keyed as the plan keyed it', async () => {
    // What the caller archives and what the next run compares against. A key
    // invented here would be a second answer to a question the plan already
    // answered.
    const { app } = vaultOf();
    const result = await writeCalendarImport(
      app,
      DEFAULT_SETTINGS,
      [proposal({ key: '2026-09-14~09:00~standup' })],
      NOW
    );
    expect(result.lines).toEqual([
      { uid: 'a@example.ch', day: '2026-09-14', key: '2026-09-14~09:00~standup' },
    ]);
  });

  it('does nothing at all when there is nothing to write', async () => {
    const { app, writes, created } = vaultOf();
    expect(await writeCalendarImport(app, DEFAULT_SETTINGS, [], NOW)).toMatchObject({
      written: 0,
      notes: 0,
    });
    expect([...writes, ...created]).toEqual([]);
  });

  it('leaves a note whose day cannot be read alone', async () => {
    const { app, writes } = vaultOf();
    await writeCalendarImport(app, DEFAULT_SETTINGS, [proposal({ day: 'nonsense' })], NOW);
    expect(writes).toEqual([]);
  });
});

describe('what was answered', () => {
  // A calendar knows which of its meetings you are going to. One marker for
  // all of them writes a day that claims you are in four rooms at once, and
  // the answer is on the invitation the whole time.
  const written = (partstat: string) => linesFor(DEFAULT_SETTINGS, [proposal({ partstat })])[0];

  it('writes an accepted meeting like any other', () => {
    expect(written('ACCEPTED')).toBe('- 👥 09:00-09:30 Standup');
  });

  it('writes one nobody invited you to like any other', () => {
    // Your own blocked time. To a reader it is the same claim as accepted: it
    // is on, and you are there.
    expect(written('')).toBe('- 👥 09:00-09:30 Standup');
  });

  it('marks the three you did not simply say yes to', () => {
    expect(written('TENTATIVE')).toBe('- ❓ 09:00-09:30 Standup');
    expect(written('NEEDS-ACTION')).toBe('- ✉️ 09:00-09:30 Standup');
    expect(written('DECLINED')).toBe('- 🚫 09:00-09:30 Standup');
  });

  it('reads an answer the file does not give as unanswered', () => {
    // RFC 5545's own default for an ATTENDEE with no PARTSTAT, and what an
    // invitation sitting in an inbox actually is.
    expect(attendanceOf('')).toBe('');
    expect(attendanceOf('NEEDS-ACTION')).toBe('unanswered');
    expect(attendanceOf('needs-action')).toBe('unanswered');
  });

  it('writes a status it has never heard of like any other meeting', () => {
    // DELEGATED and the rest. Inventing a marker for one would be claiming to
    // know what it means on a line somebody has to read.
    expect(written('DELEGATED')).toBe('- 👥 09:00-09:30 Standup');
  });

  it('falls back to the meeting marker when a vault has cleared one', () => {
    // Blank means "do not distinguish these", not "write these unmarked".
    expect(
      linesFor({ ...DEFAULT_SETTINGS, dayMeetingDeclinedMarker: '' }, [
        proposal({ partstat: 'DECLINED' }),
      ])[0]
    ).toBe('- 👥 09:00-09:30 Standup');
  });

  it('round-trips, so a declined meeting can still be edited', async () => {
    // The failure this prevents: a line written with one marker and composed
    // back with another stops reproducing itself, and the entry goes
    // read-only -- and the meeting you declined is exactly the one you later
    // want to change.
    const { app, held } = vaultOf();
    await writeCalendarImport(app, DEFAULT_SETTINGS, [proposal({ partstat: 'DECLINED' })], NOW);
    const line = (held[path('2026-09-14')] ?? '').split('\n').find((one) => one.startsWith('- 🚫'));
    expect(line).toBe('- 🚫 09:00-09:30 Standup');

    const { meetingMarkers } = await import('../src/plan/read-schedule');
    const { parseScheduleLine } = await import('../src/plan/read-schedule');
    const parsed = parseScheduleLine(line ?? '', meetingMarkers(DEFAULT_SETTINGS));
    expect(parsed).toMatchObject({ attendance: 'declined', text: 'Standup', from: '09:00' });
  });
});

describe('correcting an answer given after the line was written', () => {
  // Monday morning: go through the week's meetings, decline what you will not
  // attend. The line's day, time and text never move, so the import used to
  // call it present and leave the marker saying you were going. This is the one
  // write in the feature that touches a line already in a note.
  const NOTE = [
    '---',
    'type: daily',
    '---',
    '',
    SCHEDULE,
    '',
    '- \u2709\ufe0f 09:00-09:30 Standup',
    '',
  ].join('\n');

  const declined = () =>
    proposal({
      status: 'answer-changed',
      writes: false,
      partstat: 'DECLINED',
      updates: { day: '2026-09-14', from: '09:00', text: 'Standup', partstat: 'NEEDS-ACTION' },
    });

  it('rewrites the marker and nothing else on the line', async () => {
    const { app, held } = vaultOf({ [path('2026-09-14')]: NOTE });
    const result = await writeCalendarImport(app, DEFAULT_SETTINGS, [declined()], NOW);

    expect(held[path('2026-09-14')]).toContain('- 🚫 09:00-09:30 Standup');
    expect(held[path('2026-09-14')]).not.toContain('✉️');
    expect(result).toMatchObject({ updated: 1, written: 0, refused: [] });
  });

  it('adds no line, so a corrected meeting is not also a duplicated one', async () => {
    const { app, held } = vaultOf({ [path('2026-09-14')]: NOTE });
    await writeCalendarImport(app, DEFAULT_SETTINGS, [declined()], NOW);
    const bullets = (held[path('2026-09-14')] ?? '').split('\n').filter((l) => l.startsWith('- '));
    expect(bullets).toHaveLength(1);
  });

  it('refuses a line the dialog cannot reproduce, and leaves it exactly as it was', async () => {
    // The editor's own round-trip rule, and it does not get weaker for being
    // reached from an importer: rewriting would drop what the dialog cannot
    // hold. An unmarked child bullet is the case -- composing the meeting back
    // would write it carrying the note marker, so the line does not reproduce.
    const withChild = NOTE.replace(
      '- \u2709\ufe0f 09:00-09:30 Standup',
      '- \u2709\ufe0f 09:00-09:30 Standup\n    - Budget besprochen'
    );
    const { app, held } = vaultOf({ [path('2026-09-14')]: withChild });
    const result = await writeCalendarImport(app, DEFAULT_SETTINGS, [declined()], NOW);

    expect(result.updated).toBe(0);
    expect(result.refused).toEqual([{ uid: 'a@example.ch', day: '2026-09-14', key: 'k' }]);
    // Untouched, marker included.
    expect(held[path('2026-09-14')]).toContain('- \u2709\ufe0f 09:00-09:30 Standup');
    expect(held[path('2026-09-14')]).toContain('    - Budget besprochen');
  });

  it('refuses when two lines on the day are indistinguishable', async () => {
    // No way to say which was meant, and picking one is a coin toss with
    // somebody's note as the stake.
    const twice = NOTE.replace(
      '- ✉️ 09:00-09:30 Standup',
      '- ✉️ 09:00-09:30 Standup\n- ✉️ 09:00-09:30 Standup'
    );
    const { app } = vaultOf({ [path('2026-09-14')]: twice });
    const result = await writeCalendarImport(app, DEFAULT_SETTINGS, [declined()], NOW);
    expect(result).toMatchObject({ updated: 0 });
    expect(result.refused).toHaveLength(1);
  });

  it('does nothing when the day note is not there', async () => {
    const { app, writes } = vaultOf();
    const result = await writeCalendarImport(app, DEFAULT_SETTINGS, [declined()], NOW);
    expect(result).toMatchObject({ updated: 0, written: 0 });
    expect(writes).toEqual([]);
  });

  it('corrects and appends in the same run without losing either', async () => {
    // Both halves rewrite the same note, and the append reads it immediately
    // before writing. Corrections run first for exactly that reason.
    const { app, held } = vaultOf({ [path('2026-09-14')]: NOTE });
    const result = await writeCalendarImport(
      app,
      DEFAULT_SETTINGS,
      [declined(), proposal({ uid: 'neu@example.ch', from: '11:00', summary: 'Review' })],
      NOW
    );
    expect(result).toMatchObject({ updated: 1, written: 1 });
    const body = held[path('2026-09-14')] ?? '';
    expect(body).toContain('- 🚫 09:00-09:30 Standup');
    expect(body).toContain('- 👥 11:00-09:30 Review');
  });
});
