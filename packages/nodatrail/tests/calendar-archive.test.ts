/**
 * Keeping the calendar file, and reading it back as evidence.
 *
 * The naming half is small and mechanical; what is worth testing is the replay,
 * because it is what stands in for the record §D decided not to keep. Three
 * things have to hold or the missing list starts lying:
 *
 * - a file is expanded over **its own** range, not the one being imported now,
 *   or it produces occurrences nobody was ever offered;
 * - a multi-day event contributes one line per day, split by the same code that
 *   will split it again in a moment;
 * - a file this plugin did not name is not read as evidence at all.
 */
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { TFile } from './obsidian-stub';

// The archive is one of the few readers that reaches Obsidian's runtime rather
// than only its types: `normalizePath` on the way in. Identity is enough of a
// stand-in for it here -- every path in this suite is already normal -- and
// TFile stays the stub's own class so `instanceof` agrees on both sides.
vi.mock('obsidian', async () => {
  const stub = await vi.importActual<typeof import('./obsidian-stub')>('./obsidian-stub');
  return { TFile: stub.TFile, normalizePath: (path: string) => path };
});

const {
  archiveCalendar,
  calendarArchiveFolder,
  calendarFileName,
  priorImportsOf,
  readCalendarArchive,
  readCalendarFileName,
  sourceSlug,
} = await import('../src/plan/calendar-archive');

const FOLDER = '0 Plan/1 Daily/2026/_documents';

function ics(...events: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\r\n');
}

function event(...lines: string[]): string {
  return ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');
}

/** A vault holding the given files by path, with the folders they imply. */
function vaultOf(files: Record<string, string>) {
  const made = new Set<string>();
  const written: Record<string, string> = { ...files };

  const fileFor = (path: string) => {
    const name = path.slice(path.lastIndexOf('/') + 1);
    return Object.assign(new TFile(), {
      path,
      name,
      basename: name.replace(/\.[^.]*$/, ''),
      extension: name.slice(name.lastIndexOf('.') + 1),
      parent: { name: path.split('/').slice(-2, -1)[0] ?? '' },
    });
  };

  const app = {
    vault: {
      getFiles: () => Object.keys(written).map(fileFor),
      getFolderByPath: (path: string) =>
        made.has(path) || Object.keys(written).some((one) => one.startsWith(`${path}/`))
          ? {
              path,
              children: Object.keys(written)
                .filter((one) => one.slice(0, one.lastIndexOf('/')) === path)
                .map(fileFor),
            }
          : null,
      createFolder: (path: string) => {
        made.add(path);
        return Promise.resolve();
      },
      create: (path: string, text: string) => {
        written[path] = text;
        return Promise.resolve(fileFor(path));
      },
      cachedRead: (file: TFile) => Promise.resolve(written[file.path] ?? ''),
    },
  } as never;

  return { app, written };
}

describe('sourceSlug', () => {
  it('reduces a name to what survives a filename', () => {
    expect(sourceSlug('Stefan Geschäft.ics')).toBe('stefan-gesch-ft');
  });

  it('drops the extension, and only the last one', () => {
    expect(sourceSlug('kalender.export.ics')).toBe('kalender-export');
  });

  it('keeps no underscore, which is what separates the range from the source', () => {
    expect(sourceSlug('work_calendar.ics')).toContain('-');
    expect(sourceSlug('work_calendar.ics')).not.toContain('_');
  });

  it('names a file whose characters all vanish rather than calling it nothing', () => {
    expect(sourceSlug('日程.ics')).toBe('calendar');
  });
});

describe('calendarFileName', () => {
  it('puts the range first, then the source', () => {
    expect(calendarFileName('business.ics', '2026-09-07', '2026-09-13')).toBe(
      '20260907-20260913_business.ics'
    );
  });

  it('reads back what it wrote', () => {
    const name = calendarFileName('Business.ics', '2026-09-07', '2026-09-13');
    expect(readCalendarFileName(name)).toEqual({
      source: 'business',
      from: '2026-09-07',
      to: '2026-09-13',
    });
  });

  it('does not recognise a file somebody dropped in themselves', () => {
    // A wrong guess about which range a file covers reports meetings gone that
    // the file was never read for, which is exactly what §I.2 exists to stop.
    expect(readCalendarFileName('basic.ics')).toBeNull();
    expect(readCalendarFileName('Kalender 2026.ics')).toBeNull();
    expect(readCalendarFileName('20260907_business.ics')).toBeNull();
  });
});

describe('calendarArchiveFolder', () => {
  it('is the day notes document folder for the month the range starts in', () => {
    expect(calendarArchiveFolder(DEFAULT_SETTINGS, '2026-09-07')).toBe(FOLDER);
  });

  it('is nothing when documents are left where they are', () => {
    expect(
      calendarArchiveFolder({ ...DEFAULT_SETTINGS, documentSubfolder: '' }, '2026-09-07')
    ).toBe('');
  });
});

describe('archiveCalendar', () => {
  const text = ics(event('UID:a@example.ch', 'DTSTART;VALUE=DATE:20260907', 'SUMMARY:Termin'));

  it('files the export beside the notes it fed', async () => {
    const { app, written } = vaultOf({});
    const path = await archiveCalendar(
      app,
      DEFAULT_SETTINGS,
      'business.ics',
      '2026-09-07',
      '2026-09-13',
      text
    );
    expect(path).toBe(`${FOLDER}/20260907-20260913_business.ics`);
    expect(written[path ?? '']).toBe(text);
  });

  it('does not store the same bytes twice', async () => {
    // Re-importing a range that is already archived is how somebody finishes a
    // week they left half done. It must not leave a second copy each time.
    const held = { [`${FOLDER}/20260907-20260913_business.ics`]: text };
    const { app, written } = vaultOf(held);
    const path = await archiveCalendar(
      app,
      DEFAULT_SETTINGS,
      'business.ics',
      '2026-09-07',
      '2026-09-13',
      text
    );
    expect(path).toBe(`${FOLDER}/20260907-20260913_business.ics`);
    expect(Object.keys(written)).toHaveLength(1);
  });

  it('numbers a different export of the same range rather than replacing it', async () => {
    const { app, written } = vaultOf({ [`${FOLDER}/20260907-20260913_business.ics`]: text });
    const path = await archiveCalendar(
      app,
      DEFAULT_SETTINGS,
      'business.ics',
      '2026-09-07',
      '2026-09-13',
      `${text}\r\n`
    );
    expect(path).toBe(`${FOLDER}/20260907-20260913_business 2.ics`);
    expect(Object.keys(written)).toHaveLength(2);
  });

  it('keeps nothing when there is nowhere that is not somebody elses folder', async () => {
    const { app, written } = vaultOf({});
    const path = await archiveCalendar(
      app,
      { ...DEFAULT_SETTINGS, documentSubfolder: '' },
      'business.ics',
      '2026-09-07',
      '2026-09-13',
      text
    );
    expect(path).toBeNull();
    expect(Object.keys(written)).toHaveLength(0);
  });
});

describe('readCalendarArchive', () => {
  it('finds what this plugin filed, newest range first', () => {
    const { app } = vaultOf({
      [`${FOLDER}/20260907-20260913_business.ics`]: ics(),
      [`${FOLDER}/20260914-20260920_business.ics`]: ics(),
      [`${FOLDER}/20260901-20260930_privat.ics`]: ics(),
    });
    expect(readCalendarArchive(app, DEFAULT_SETTINGS).map((one) => one.name.to)).toEqual([
      '2026-09-30',
      '2026-09-20',
      '2026-09-13',
    ]);
  });

  it('ignores a file this plugin did not name', () => {
    const { app } = vaultOf({
      [`${FOLDER}/basic.ics`]: ics(),
      [`${FOLDER}/20260907-20260913_business.ics`]: ics(),
    });
    expect(readCalendarArchive(app, DEFAULT_SETTINGS)).toHaveLength(1);
  });

  it('ignores an ics that is not in the documents folder', () => {
    const { app } = vaultOf({ '0 Plan/20260907-20260913_business.ics': ics() });
    expect(readCalendarArchive(app, DEFAULT_SETTINGS)).toEqual([]);
  });
});

describe('priorImportsOf', () => {
  const week = ics(
    event(
      'UID:standup@example.ch',
      'DTSTART;TZID=Europe/Zurich:20260907T090000',
      'DTEND;TZID=Europe/Zurich:20260907T091500',
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'SUMMARY:Standup'
    )
  );

  it('expands each file over its own range and not over anything else', async () => {
    // The file was read for one week. Expanding a weekly series over a month
    // would credit that import with three meetings nobody was ever offered,
    // and the next run would report them as having vanished.
    const { app } = vaultOf({ [`${FOLDER}/20260907-20260913_business.ics`]: week });
    const history = await priorImportsOf(app, DEFAULT_SETTINGS, 'business.ics');
    expect(history).toEqual([
      {
        from: '2026-09-07',
        to: '2026-09-13',
        lines: [
          {
            uid: 'standup@example.ch',
            day: '2026-09-07',
            key: '2026-09-07~09:00~standup',
          },
        ],
      },
    ]);
  });

  it('gives a multi-day event one line per day', async () => {
    const holiday = ics(
      event(
        'UID:ferien@example.ch',
        'DTSTART;VALUE=DATE:20260907',
        'DTEND;VALUE=DATE:20260910',
        'SUMMARY:Ferien'
      )
    );
    const { app } = vaultOf({ [`${FOLDER}/20260907-20260913_privat.ics`]: holiday });
    const [only] = await priorImportsOf(app, DEFAULT_SETTINGS, 'privat.ics');
    expect(only?.lines.map((one) => one.day)).toEqual(['2026-09-07', '2026-09-08', '2026-09-09']);
  });

  it('reads only the source it was asked about', async () => {
    const { app } = vaultOf({
      [`${FOLDER}/20260907-20260913_business.ics`]: week,
      [`${FOLDER}/20260907-20260913_privat.ics`]: week,
    });
    expect(await priorImportsOf(app, DEFAULT_SETTINGS, 'Business.ics')).toHaveLength(1);
  });

  it('hands them over oldest first, so a later run is read as the later one', async () => {
    const { app } = vaultOf({
      [`${FOLDER}/20260914-20260920_business.ics`]: week,
      [`${FOLDER}/20260907-20260913_business.ics`]: week,
    });
    expect(
      (await priorImportsOf(app, DEFAULT_SETTINGS, 'business.ics')).map((one) => one.from)
    ).toEqual(['2026-09-07', '2026-09-14']);
  });

  it('contributes nothing for a file that no longer parses, rather than throwing', async () => {
    const { app } = vaultOf({ [`${FOLDER}/20260907-20260913_business.ics`]: 'not a calendar' });
    expect(await priorImportsOf(app, DEFAULT_SETTINGS, 'business.ics')).toEqual([
      { from: '2026-09-07', to: '2026-09-13', lines: [] },
    ]);
  });

  it('has nothing to say about a source never imported', async () => {
    const { app } = vaultOf({ [`${FOLDER}/20260907-20260913_business.ics`]: week });
    expect(await priorImportsOf(app, DEFAULT_SETTINGS, 'privat.ics')).toEqual([]);
  });
});
