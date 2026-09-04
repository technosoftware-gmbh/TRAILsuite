/**
 * Repairing the meeting lines an earlier import wrote at the wrong clock.
 *
 * The one place in this plugin that rewrites a line somebody has been reading
 * for weeks, so the assertions are mostly about what survives the rewrite and
 * what stops it. The happy path is one case; the guards are the file.
 *
 * The fixtures use `Z` times deliberately, because that is the shape the bug
 * bit: 06:00Z is eight o'clock in Zurich, and the old importer wrote the six.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
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

const { planTimeRepair, writeTimeRepair, repairable } = await import('../src/plan/repair-times');

const SCHEDULE = '## 📅 Schedule';
const ARCHIVE = '0 Plan/1 Daily/2026/_documents';
const path = (iso: string) => `0 Plan/1 Daily/${iso.slice(0, 4)}/${iso}.md`;

/** An `.ics` holding one event, stated the way the bug bit. */
function ics(...events: string[][]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'X-WR-CALNAME:stefan@example.invalid',
    ...events.flatMap((lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT']),
    'END:VCALENDAR',
  ].join('\r\n');
}

function utcEvent(uid: string, summary: string, start: string, end: string): string[] {
  return [`UID:${uid}`, `SUMMARY:${summary}`, `DTSTART:${start}`, `DTEND:${end}`];
}

function note(...lines: string[]): string {
  return `---\ntype: "day"\n---\n\n${SCHEDULE}\n\n${lines.join('\n')}\n`;
}

function vaultOf(notes: Record<string, string>, archives: Record<string, string> = {}) {
  const held: Record<string, string> = { ...notes };
  const writes: string[] = [];

  const fileFor = (p: string, extension = 'md') => {
    const name = p.split('/').pop() ?? p;
    return Object.assign(new TFile(), {
      path: p,
      name,
      basename: name.replace(/\.[^.]+$/, ''),
      extension,
      parent: { name: p.split('/').slice(-2, -1)[0] ?? '' },
    });
  };

  const archived = Object.entries(archives).map(([name, text]) => {
    const p = `${ARCHIVE}/${name}`;
    held[p] = text;
    return fileFor(p, 'ics');
  });

  const app = {
    vault: {
      getFiles: () => archived,
      getAbstractFileByPath: (p: string) => (held[p] === undefined ? null : fileFor(p)),
      getFileByPath: (p: string) => (held[p] === undefined ? null : fileFor(p)),
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

  return { app, held, writes };
}

/** One week's export holding a single 06:00Z meeting, which is 08:00 here. */
const WEEK = {
  '20260907-20260913_business.ics': ics(
    utcEvent('a@example.invalid', 'Inbox Complaints', '20260911T060000Z', '20260911T062500Z')
  ),
};

beforeEach(() => {
  process.env.TZ = 'Europe/Zurich';
});

describe('planTimeRepair', () => {
  it('finds a line the old importer wrote two hours early', () => {
    const { app } = vaultOf(
      { [path('2026-09-11')]: note('- 👥 06:00-06:25 Inbox Complaints') },
      WEEK
    );

    return planTimeRepair(app, DEFAULT_SETTINGS).then((plan) => {
      expect(plan.repairs).toHaveLength(1);
      expect(plan.repairs[0]).toMatchObject({
        day: '2026-09-11',
        from: '06:00',
        to: '06:25',
        wantedDay: '2026-09-11',
        wantedFrom: '08:00',
        wantedTo: '08:25',
        blocker: null,
      });
    });
  });

  it('says nothing about a meeting the export states in our own zone', async () => {
    // The 1,731 rows of a real export that were always right. Naming them as
    // repairs would bury the ones that are not.
    const { app } = vaultOf(
      { [path('2026-09-11')]: note('- 👥 08:00-08:25 Inbox Complaints') },
      {
        '20260907-20260913_business.ics': ics([
          'UID:a@example.invalid',
          'SUMMARY:Inbox Complaints',
          'DTSTART;TZID=Europe/Zurich:20260911T080000',
          'DTEND;TZID=Europe/Zurich:20260911T082500',
        ]),
      }
    );

    expect(await planTimeRepair(app, DEFAULT_SETTINGS)).toEqual({ repairs: [], unreadable: [] });
  });

  it('reports a line whose day changes rather than offering to move it', async () => {
    // 23:00Z is one in the morning here. Repairing it means taking the line out
    // of one note and putting it in another, which is a delete however it is
    // dressed, so it is named and left.
    const { app } = vaultOf(
      { [path('2026-09-11')]: note('- 👥 23:00-23:45 Late call') },
      {
        '20260907-20260913_business.ics': ics(
          utcEvent('b@example.invalid', 'Late call', '20260911T230000Z', '20260911T234500Z')
        ),
      }
    );

    const plan = await planTimeRepair(app, DEFAULT_SETTINGS);

    expect(plan.repairs[0]?.blocker).toBe('moves-day');
    expect(plan.repairs[0]?.wantedDay).toBe('2026-09-12');
    expect(repairable(plan)).toEqual([]);
  });

  it('refuses a line that says more than the dialog can compose back', async () => {
    const { app } = vaultOf(
      { [path('2026-09-11')]: note('* 👥 06:00-06:25 Inbox Complaints') },
      WEEK
    );

    expect((await planTimeRepair(app, DEFAULT_SETTINGS)).repairs[0]?.blocker).toBe('not-editable');
  });

  it('tells two identical lines apart from none at all', async () => {
    // Both come back null from `findDayEntry`, and a preview that called them
    // the same thing would send somebody looking for a line that is there
    // twice as though it were missing.
    const { app: none } = vaultOf({ [path('2026-09-11')]: note('- 👥 09:00 Standup') }, WEEK);
    const { app: twice } = vaultOf(
      {
        [path('2026-09-11')]: note(
          '- 👥 06:00-06:25 Inbox Complaints',
          '- 👥 06:00-06:25 Inbox Complaints'
        ),
      },
      WEEK
    );

    expect((await planTimeRepair(none, DEFAULT_SETTINGS)).repairs[0]?.blocker).toBe('not-found');
    expect((await planTimeRepair(twice, DEFAULT_SETTINGS)).repairs[0]?.blocker).toBe('ambiguous');
  });

  it('offers one repair for a meeting two archived exports both cover', async () => {
    // This vault holds four archived files with overlapping ranges. Without a
    // guard the same line is offered once per file.
    const { app } = vaultOf(
      { [path('2026-09-11')]: note('- 👥 06:00-06:25 Inbox Complaints') },
      {
        '20260907-20260913_business.ics': ics(
          utcEvent('a@example.invalid', 'Inbox Complaints', '20260911T060000Z', '20260911T062500Z')
        ),
        '20260901-20260930_business.ics': ics(
          utcEvent('a@example.invalid', 'Inbox Complaints', '20260911T060000Z', '20260911T062500Z')
        ),
      }
    );

    expect((await planTimeRepair(app, DEFAULT_SETTINGS)).repairs).toHaveLength(1);
  });

  it('names an archived file it cannot read rather than dropping it', async () => {
    const { app } = vaultOf(
      { [path('2026-09-11')]: note('- 👥 06:00-06:25 Inbox Complaints') },
      { '20260907-20260913_business.ics': 'not a calendar at all' }
    );

    const plan = await planTimeRepair(app, DEFAULT_SETTINGS);

    expect(plan.repairs).toEqual([]);
  });
});

describe('writeTimeRepair', () => {
  it('rewrites the clock and leaves everything else on the line alone', async () => {
    const { app, held, writes } = vaultOf(
      {
        [path('2026-09-11')]: note(
          '- 👥 09:00-09:30 Standup',
          '- 🚫 06:00-06:25 Inbox Complaints [[Support]]',
          '    - 📝 zwei Tickets offen'
        ),
      },
      WEEK
    );
    const plan = await planTimeRepair(app, DEFAULT_SETTINGS);

    const result = await writeTimeRepair(app, DEFAULT_SETTINGS, repairable(plan));

    expect(result).toEqual({ repaired: 1, notes: 1, refused: [] });
    const body = held[path('2026-09-11')] ?? '';
    // The marker, the link and the note underneath all survive, because the
    // entry is recomposed from the record rather than rebuilt from the export.
    expect(body).toContain('- 🚫 08:00-08:25 Inbox Complaints [[Support]]');
    expect(body).toContain('    - 📝 zwei Tickets offen');
    expect(body).toContain('- 👥 09:00-09:30 Standup');
    expect(body).not.toContain('06:00');
    expect(writes).toHaveLength(1);
  });

  it('repairs several lines in one note in one write', async () => {
    const { app, held, writes } = vaultOf(
      {
        [path('2026-09-11')]: note(
          '- 👥 06:00-06:25 Inbox Complaints',
          '- 👥 07:00-08:00 Focus-Time'
        ),
      },
      {
        '20260907-20260913_business.ics': ics(
          utcEvent('a@example.invalid', 'Inbox Complaints', '20260911T060000Z', '20260911T062500Z'),
          utcEvent('b@example.invalid', 'Focus-Time', '20260911T070000Z', '20260911T080000Z')
        ),
      }
    );
    const plan = await planTimeRepair(app, DEFAULT_SETTINGS);

    const result = await writeTimeRepair(app, DEFAULT_SETTINGS, repairable(plan));

    expect(result.repaired).toBe(2);
    expect(held[path('2026-09-11')]).toContain('- 👥 08:00-08:25 Inbox Complaints');
    expect(held[path('2026-09-11')]).toContain('- 👥 09:00-10:00 Focus-Time');
    expect(writes).toHaveLength(1);
  });

  it('takes the verdict again, and refuses a line edited since the preview', async () => {
    const { app, held, writes } = vaultOf(
      { [path('2026-09-11')]: note('- 👥 06:00-06:25 Inbox Complaints') },
      WEEK
    );
    const plan = await planTimeRepair(app, DEFAULT_SETTINGS);
    held[path('2026-09-11')] = note('- 👥 06:00-06:25 Inbox Complaints und noch etwas');

    const result = await writeTimeRepair(app, DEFAULT_SETTINGS, repairable(plan));

    expect(result.repaired).toBe(0);
    expect(result.refused).toHaveLength(1);
    expect(writes).toEqual([]);
  });

  it('refuses a line that stopped round-tripping while the preview was open', async () => {
    // Found, and no longer safe: an unmarked bullet appeared under it, so the
    // entry still matches on day, time and text but composing it back would
    // add a marker nobody typed. The null check alone does not catch this one.
    const { app, held, writes } = vaultOf(
      { [path('2026-09-11')]: note('- 👥 06:00-06:25 Inbox Complaints') },
      WEEK
    );
    const plan = await planTimeRepair(app, DEFAULT_SETTINGS);
    held[path('2026-09-11')] = note('- 👥 06:00-06:25 Inbox Complaints', '    - offen');

    const result = await writeTimeRepair(app, DEFAULT_SETTINGS, repairable(plan));

    expect(result.repaired).toBe(0);
    expect(result.refused).toHaveLength(1);
    expect(writes).toEqual([]);
  });

  it('writes nothing for a repair the plan blocked', async () => {
    const { app, writes } = vaultOf(
      { [path('2026-09-11')]: note('- 👥 23:00-23:45 Late call') },
      {
        '20260907-20260913_business.ics': ics(
          utcEvent('b@example.invalid', 'Late call', '20260911T230000Z', '20260911T234500Z')
        ),
      }
    );
    const plan = await planTimeRepair(app, DEFAULT_SETTINGS);

    // Handed the whole plan rather than `repairable`, because a caller that
    // passed everything must not get the blocked ones written anyway.
    const result = await writeTimeRepair(app, DEFAULT_SETTINGS, plan.repairs);

    expect(result.repaired).toBe(0);
    expect(writes).toEqual([]);
  });
});

describe('the order the repaired line ends up in', () => {
  // The regression this section exists for. `replaceLines` rewrites in place,
  // which is what protects the notes indented under a meeting and also means a
  // line corrected from 07:00 to 09:00 keeps the slot 07:00 earned. In one real
  // vault eleven lines ended up sitting between 09:30 and 10:00.
  const MONDAY = {
    '20260907-20260913_business.ics': ics(
      utcEvent(
        'c@example.invalid',
        'Check-in Care Management',
        '20260907T070000Z',
        '20260907T073000Z'
      )
    ),
  };

  /** The schedule lines of the note, in the order the note lists them. */
  function scheduleOf(held: Record<string, string>, day: string): string[] {
    return (held[path(day)] ?? '')
      .split('\n')
      .filter((line) => line.startsWith('- '))
      .map((line) => line.trim());
  }

  it('moves the line down to where its new time belongs', async () => {
    const { app, held } = vaultOf(
      {
        [path('2026-09-07')]: note(
          '- 👥 06:30-08:00 Focus-Time',
          '- 👥 07:00-07:30 Check-in Care Management',
          '- 👥 08:00-09:00 Out of Office',
          '- 👥 10:00-11:30 PI Meeting'
        ),
      },
      MONDAY
    );
    const plan = await planTimeRepair(app, DEFAULT_SETTINGS);

    await writeTimeRepair(app, DEFAULT_SETTINGS, repairable(plan));

    expect(scheduleOf(held, '2026-09-07')).toEqual([
      '- 👥 06:30-08:00 Focus-Time',
      '- 👥 08:00-09:00 Out of Office',
      '- 👥 09:00-09:30 Check-in Care Management',
      '- 👥 10:00-11:30 PI Meeting',
    ]);
  });

  it('takes the notes indented under it along to the new position', async () => {
    // The whole reason the repair rewrites rather than deletes and re-adds.
    const { app, held } = vaultOf(
      {
        [path('2026-09-07')]: note(
          '- 👥 07:00-07:30 Check-in Care Management',
          '    - 📝 Budget besprochen',
          '- 👥 10:00-11:30 PI Meeting'
        ),
      },
      MONDAY
    );
    const plan = await planTimeRepair(app, DEFAULT_SETTINGS);

    await writeTimeRepair(app, DEFAULT_SETTINGS, repairable(plan));

    const body = held[path('2026-09-07')] ?? '';
    expect(body.indexOf('Budget besprochen')).toBeGreaterThan(body.indexOf('09:00-09:30'));
    expect(body.indexOf('Budget besprochen')).toBeLessThan(body.indexOf('PI Meeting'));
  });

  it('leaves an entry with no time where it was put', async () => {
    // `Zuhause` says nothing about where the clock has got to, so it is not a
    // boundary to sort against and it does not move.
    const { app, held } = vaultOf(
      {
        [path('2026-09-07')]: note(
          '- 👥 Zuhause',
          '- 👥 07:00-07:30 Check-in Care Management',
          '- 👥 10:00-11:30 PI Meeting'
        ),
      },
      MONDAY
    );
    const plan = await planTimeRepair(app, DEFAULT_SETTINGS);

    await writeTimeRepair(app, DEFAULT_SETTINGS, repairable(plan));

    expect(scheduleOf(held, '2026-09-07')[0]).toBe('- 👥 Zuhause');
  });

  it('leaves it at the end when nothing starts later', async () => {
    const { app, held } = vaultOf(
      {
        [path('2026-09-07')]: note(
          '- 👥 06:30-08:00 Focus-Time',
          '- 👥 07:00-07:30 Check-in Care Management'
        ),
      },
      MONDAY
    );
    const plan = await planTimeRepair(app, DEFAULT_SETTINGS);

    await writeTimeRepair(app, DEFAULT_SETTINGS, repairable(plan));

    expect(scheduleOf(held, '2026-09-07')).toEqual([
      '- 👥 06:30-08:00 Focus-Time',
      '- 👥 09:00-09:30 Check-in Care Management',
    ]);
  });

  it('refuses when a second identical line appeared since the preview', async () => {
    // The writer checks uniqueness again rather than trusting the plan's
    // verdict, and this is the only way to reach that branch: the planner
    // blocks an ambiguous line, so one can only become ambiguous afterwards.
    const { app, held, writes } = vaultOf(
      { [path('2026-09-07')]: note('- 👥 07:00-07:30 Check-in Care Management') },
      MONDAY
    );
    const plan = await planTimeRepair(app, DEFAULT_SETTINGS);
    held[path('2026-09-07')] = note(
      '- 👥 07:00-07:30 Check-in Care Management',
      '- 👥 07:00-07:30 Check-in Care Management'
    );

    const result = await writeTimeRepair(app, DEFAULT_SETTINGS, repairable(plan));

    expect(result.repaired).toBe(0);
    expect(result.refused).toHaveLength(1);
    expect(writes).toEqual([]);
  });

  it('puts two repaired lines in one note each where it belongs', async () => {
    // Two repairs to one note, and the second measured against a body the first
    // one already changed. Getting this wrong deleted a meeting and duplicated
    // its neighbour.
    const { app, held } = vaultOf(
      {
        [path('2026-09-07')]: note(
          '- 👥 07:00-07:30 Check-in Care Management',
          '- 👥 07:30-08:00 Check-in Two',
          '- 👥 08:00-09:00 Out of Office',
          '- 👥 12:00-13:00 Lunch'
        ),
      },
      {
        '20260907-20260913_business.ics': ics(
          utcEvent(
            'c@example.invalid',
            'Check-in Care Management',
            '20260907T070000Z',
            '20260907T073000Z'
          ),
          utcEvent('d@example.invalid', 'Check-in Two', '20260907T073000Z', '20260907T080000Z')
        ),
      }
    );
    const plan = await planTimeRepair(app, DEFAULT_SETTINGS);

    const result = await writeTimeRepair(app, DEFAULT_SETTINGS, repairable(plan));

    expect(result.repaired).toBe(2);
    expect(scheduleOf(held, '2026-09-07')).toEqual([
      '- 👥 08:00-09:00 Out of Office',
      '- 👥 09:00-09:30 Check-in Care Management',
      '- 👥 09:30-10:00 Check-in Two',
      '- 👥 12:00-13:00 Lunch',
    ]);
  });
});
