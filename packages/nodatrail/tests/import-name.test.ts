/**
 * The name both archives write, and read back.
 *
 * The round trip is most of it: a name this plugin writes has to be one it can
 * read, or the imports folder is a folder of files nothing can say anything
 * about. What is worth testing beyond that is the stamp, which is the part that
 * is new and the part that decides the order a history is replayed in.
 */
import { describe, expect, it } from 'vitest';
import {
  byStamp,
  compactDay,
  expandDay,
  freeImportName,
  importFileName,
  importStamp,
  readImportFileName,
} from '../src/shared/import-name';

describe('importStamp', () => {
  it('is the local wall clock to the second', () => {
    expect(importStamp(new Date(2026, 8, 13, 14, 25, 30))).toBe('20260913-142530');
  });

  it('pads every field, so the name is one length and sorts as text', () => {
    // The whole value of the format. A stamp that was sometimes fifteen
    // characters and sometimes thirteen would sort `20261...` before `2026...`
    // and put a run in the wrong place in its own history.
    expect(importStamp(new Date(2026, 0, 2, 3, 4, 5))).toBe('20260102-030405');
    expect(importStamp(new Date(2026, 0, 2, 3, 4, 5))).toHaveLength(15);
  });

  it('sorts as text in the order the runs happened', () => {
    const morning = importStamp(new Date(2026, 8, 13, 9, 0, 0));
    const evening = importStamp(new Date(2026, 8, 13, 21, 0, 0));
    const tomorrow = importStamp(new Date(2026, 8, 14, 1, 0, 0));
    expect([tomorrow, evening, morning].sort()).toEqual([morning, evening, tomorrow]);
  });
});

describe('compactDay', () => {
  it('round-trips a day through the form a filename can hold', () => {
    expect(compactDay('2026-09-01')).toBe('20260901');
    expect(expandDay(compactDay('2026-09-01'))).toBe('2026-09-01');
  });
});

describe('importFileName', () => {
  const name = {
    stamp: '20260913-142530',
    source: 'business',
    from: '2026-09-07',
    to: '2026-09-13',
  };

  it('is the run, then what was read, then which days', () => {
    expect(importFileName(name, 'ics')).toBe('20260913-142530_business_20260907-20260913.ics');
  });

  it('reads back what it wrote, for either extension', () => {
    expect(readImportFileName(importFileName(name, 'ics'), 'ics')).toEqual(name);
    const account = { ...name, source: '1013' };
    expect(readImportFileName(importFileName(account, 'csv'), 'csv')).toEqual(account);
  });

  it('does not read one extension as the other', () => {
    // One folder holds both, and a csv read as an ics would be handed to a
    // calendar parser as though it were evidence about a week of meetings.
    expect(readImportFileName(importFileName(name, 'ics'), 'csv')).toBeNull();
  });

  it('recognises nothing it did not write', () => {
    for (const candidate of [
      'basic.ics',
      'Kalender 2026.ics',
      // The shape this replaced. It is still in vaults, in another folder, and
      // reading it here would claim a run at a time nothing recorded.
      '20260907-20260913_business.ics',
      // A stamp that is not one.
      '2026-09-13_business_20260907-20260913.ics',
      // A range that is half a range.
      '20260913-142530_business_20260907.ics',
    ]) {
      expect(readImportFileName(candidate, 'ics'), candidate).toBeNull();
    }
  });
});

describe('freeImportName', () => {
  it('leaves a name nothing has taken alone', () => {
    expect(freeImportName('a.ics', new Set())).toBe('a.ics');
  });

  it('numbers past what is taken rather than overwriting it', () => {
    // Only ever two runs inside one second, and `vault.create` throws on a
    // taken path: the import would have written its notes and then failed to
    // keep its file.
    expect(freeImportName('a.ics', new Set(['a.ics']))).toBe('a 2.ics');
    expect(freeImportName('a.ics', new Set(['a.ics', 'a 2.ics']))).toBe('a 3.ics');
  });
});

describe('byStamp', () => {
  it('puts the earlier run first whatever the ranges say', () => {
    const backfill = {
      stamp: '20260913-090000',
      source: 'b',
      from: '2026-08-31',
      to: '2026-09-06',
    };
    const week = { stamp: '20260901-090000', source: 'b', from: '2026-09-07', to: '2026-09-13' };
    expect([backfill, week].sort(byStamp)).toEqual([week, backfill]);
  });
});
