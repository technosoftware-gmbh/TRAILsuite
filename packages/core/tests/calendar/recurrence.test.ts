/**
 * Turning a rule into dates.
 *
 * The cases here are the ones that decide whether a real calendar imports or
 * quietly does not. Two of them are the difference between a working week and
 * an empty one:
 *
 * - a standup whose DTSTART is two years old still has occurrences next month,
 *   and testing the series' start rather than its occurrences imports nothing
 *   (calendar-import.md §I.4);
 * - COUNT is counted from DTSTART, so a series that ran out in 2024 must not
 *   reappear because the window happens to hold three of its days.
 *
 * The suite runs pinned to Europe/Zurich, which is what lets the March case
 * below mean anything: 29 March 2026 is the day that has 23 hours, so two days
 * from the 28th is 47 of them, and a gap computed by dividing milliseconds
 * truncates that to one.
 */
import { describe, expect, it } from 'vitest';
import { parseIcs } from '../../src/calendar/ics.js';
import { expandEvents, parseRrule, ruleDays } from '../../src/calendar/recurrence.js';

function file(...blocks: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...blocks, 'END:VCALENDAR'].join('\r\n');
}

function event(...lines: string[]): string {
  return ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');
}

/** The days a rule places, written as the rule would appear in a file. */
function days(rule: string, start: string, from: string, to: string): string[] {
  return ruleDays(parseRrule(rule), start, from, to).days;
}

describe('parseRrule', () => {
  it('reads the parts it implements', () => {
    expect(parseRrule('FREQ=WEEKLY;INTERVAL=2;COUNT=10;BYDAY=MO,WE;WKST=MO')).toEqual({
      freq: 'WEEKLY',
      interval: 2,
      count: 10,
      until: null,
      byday: ['MO', 'WE'],
      bymonthday: [],
      bymonth: [],
      unsupported: [],
    });
  });

  it('drops UNTIL to a day, because a day is the resolution everything here works at', () => {
    expect(parseRrule('FREQ=DAILY;UNTIL=20260921T235959Z').until).toBe('2026-09-21');
  });

  it('reports a part it cannot honour rather than expanding the rest', () => {
    // Expanding FREQ=MONTHLY;BYDAY=MO;BYSETPOS=-1 without BYSETPOS yields every
    // Monday of the month instead of the last one: four wrong meetings that
    // look entirely plausible in a note.
    expect(parseRrule('FREQ=MONTHLY;BYDAY=MO;BYSETPOS=-1').unsupported).toEqual(['BYSETPOS']);
  });

  it('accepts WKST without reporting it, because walking days does not count weeks', () => {
    expect(parseRrule('FREQ=WEEKLY;WKST=SU').unsupported).toEqual([]);
  });

  it('treats an unparseable FREQ as no rule at all', () => {
    expect(parseRrule('FREQ=FORTNIGHTLY').freq).toBeNull();
    expect(days('FREQ=FORTNIGHTLY', '2026-09-07', '2026-09-01', '2026-09-30')).toEqual([]);
  });

  it('refuses an INTERVAL of zero, which would make every day match', () => {
    expect(parseRrule('FREQ=DAILY;INTERVAL=0').interval).toBe(1);
  });
});

describe('ruleDays', () => {
  it('places a two-year-old weekly standup in next month', () => {
    // The case §I.4 calls the trap. It presents to the user as "my recurring
    // meetings never import".
    expect(days('FREQ=WEEKLY', '2024-01-08', '2026-09-01', '2026-09-30')).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
    ]);
  });

  it('repeats on the weekday DTSTART fell on when there is no BYDAY', () => {
    expect(days('FREQ=WEEKLY', '2026-09-02', '2026-09-01', '2026-09-16')).toEqual([
      '2026-09-02',
      '2026-09-09',
      '2026-09-16',
    ]);
  });

  it('counts COUNT from DTSTART, not from the window', () => {
    // Three occurrences, all in August. A count applied to the window instead
    // would resurrect a finished series every month forever.
    expect(days('FREQ=WEEKLY;COUNT=3', '2026-08-03', '2026-09-01', '2026-09-30')).toEqual([]);
    expect(days('FREQ=WEEKLY;COUNT=3', '2026-08-03', '2026-08-01', '2026-08-31')).toEqual([
      '2026-08-03',
      '2026-08-10',
      '2026-08-17',
    ]);
  });

  it('stops at UNTIL', () => {
    expect(
      days('FREQ=WEEKLY;UNTIL=20260921T235959Z', '2026-09-07', '2026-09-01', '2026-09-30')
    ).toEqual(['2026-09-07', '2026-09-14', '2026-09-21']);
  });

  it('keeps a fortnightly rule that names two days in one week together', () => {
    // The mistake here is counting intervals from DTSTART rather than from the
    // week it sits in, and it only shows when DTSTART is mid-week: from a
    // Wednesday, the Monday twelve days later reads as week one and is
    // dropped, so every other Monday of the series silently disappears.
    expect(
      days('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE', '2026-09-09', '2026-09-01', '2026-10-10')
    ).toEqual(['2026-09-09', '2026-09-21', '2026-09-23', '2026-10-05', '2026-10-07']);
  });

  it('steps a daily interval across the short March day without losing one', () => {
    // Spring is the unforgiving direction. 29 March 2026 has 23 hours, so the
    // 30th is 47 hours from the 28th; a gap taken by dividing milliseconds
    // truncates that to one day, the 30th fails the interval test, and the
    // series is half missing from there on.
    expect(days('FREQ=DAILY;INTERVAL=2', '2026-03-28', '2026-03-28', '2026-04-03')).toEqual([
      '2026-03-28',
      '2026-03-30',
      '2026-04-01',
      '2026-04-03',
    ]);
  });

  it('steps a daily interval across the long October day too', () => {
    expect(days('FREQ=DAILY;INTERVAL=2', '2026-10-24', '2026-10-24', '2026-10-30')).toEqual([
      '2026-10-24',
      '2026-10-26',
      '2026-10-28',
      '2026-10-30',
    ]);
  });

  it('reads an ordinal BYDAY from the start of the month', () => {
    expect(days('FREQ=MONTHLY;BYDAY=2TU', '2026-09-08', '2026-09-01', '2026-11-30')).toEqual([
      '2026-09-08',
      '2026-10-13',
      '2026-11-10',
    ]);
  });

  it('reads a negative ordinal BYDAY from the end of the month', () => {
    expect(days('FREQ=MONTHLY;BYDAY=-1FR', '2026-09-25', '2026-09-01', '2026-11-30')).toEqual([
      '2026-09-25',
      '2026-10-30',
      '2026-11-27',
    ]);
  });

  it('honours every BYMONTHDAY, including ones DTSTART does not fall on', () => {
    // Two values, and neither test day is the day DTSTART sits on for both
    // months: a rule that quietly fell back to DTSTART's date would still pass
    // a single-value case.
    expect(days('FREQ=MONTHLY;BYMONTHDAY=1,15', '2026-09-15', '2026-09-01', '2026-11-30')).toEqual([
      '2026-09-15',
      '2026-10-01',
      '2026-10-15',
      '2026-11-01',
      '2026-11-15',
    ]);
  });

  it('skips a month that has no such day rather than sliding to the last one', () => {
    // RFC 5545 says an occurrence that does not exist is not generated. A rule
    // on the 31st is simply absent in February, and sliding it to the 28th
    // would invent a meeting.
    expect(days('FREQ=MONTHLY', '2026-01-31', '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-03-31',
    ]);
  });

  it('repeats a monthly rule on the day DTSTART fell on', () => {
    expect(days('FREQ=MONTHLY;INTERVAL=3', '2026-09-15', '2026-09-01', '2027-06-30')).toEqual([
      '2026-09-15',
      '2026-12-15',
      '2027-03-15',
      '2027-06-15',
    ]);
  });

  it('honours BYMONTH, so a twice-a-year rule is two months and not twelve', () => {
    expect(
      days('FREQ=YEARLY;BYMONTH=3,9;BYMONTHDAY=1', '2026-03-01', '2026-01-01', '2027-12-31')
    ).toEqual(['2026-03-01', '2026-09-01', '2027-03-01', '2027-09-01']);
  });

  it('repeats a yearly rule on its date', () => {
    expect(days('FREQ=YEARLY', '2026-09-01', '2026-01-01', '2028-12-31')).toEqual([
      '2026-09-01',
      '2027-09-01',
      '2028-09-01',
    ]);
  });

  it('gives up rather than walking forever, and says that it did', () => {
    // A DTSTART far enough back that the walk cannot reach the window. The
    // caller has to be able to tell this apart from a series with no
    // occurrences, which is why `truncated` exists at all.
    const far = ruleDays(parseRrule('FREQ=DAILY'), '1900-01-01', '2026-09-01', '2026-09-30');
    expect(far).toEqual({ days: [], truncated: true });
  });

  it('returns nothing for an unparseable DTSTART', () => {
    expect(days('FREQ=DAILY', 'not a day', '2026-09-01', '2026-09-30')).toEqual([]);
  });
});

describe('expandEvents', () => {
  const STANDUP = event(
    'UID:standup@example.ch',
    'DTSTART;TZID=Europe/Zurich:20240108T090000',
    'DTEND;TZID=Europe/Zurich:20240108T091500',
    'RRULE:FREQ=WEEKLY;BYDAY=MO',
    'SUMMARY:Standup'
  );

  it('expands a series into the window and carries the stated wall clock through', () => {
    const out = expandEvents(parseIcs(file(STANDUP)), '2026-09-01', '2026-09-30').occurrences;
    expect(out.map((one) => one.date)).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
    ]);
    expect(out[0]).toMatchObject({
      uid: 'standup@example.ch',
      time: '09:00',
      zone: 'Europe/Zurich',
      utc: false,
      summary: 'Standup',
      overridden: false,
    });
  });

  it("gives each instance of a multi-day series its own end, not the first one's", () => {
    // A VEVENT states one DTEND against its own DTSTART, and the recurrence
    // carries the length rather than the date. Taken verbatim, every instance
    // after the first ends before it starts and collapses to a single day, so
    // a Monday-to-Friday course reads as one Monday, fortnight after
    // fortnight.
    const course = event(
      'UID:kurs@example.ch',
      'DTSTART;VALUE=DATE:20260907',
      'DTEND;VALUE=DATE:20260912',
      'RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=2',
      'SUMMARY:Kurs'
    );
    expect(
      expandEvents(parseIcs(file(course)), '2026-09-01', '2026-09-30').occurrences.map((one) => [
        one.date,
        one.endDate,
      ])
    ).toEqual([
      ['2026-09-07', '2026-09-12'],
      ['2026-09-21', '2026-09-26'],
    ]);
  });

  it('drops a day named in EXDATE', () => {
    const withHoliday = event(
      'UID:standup@example.ch',
      'DTSTART;TZID=Europe/Zurich:20240108T090000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'EXDATE;TZID=Europe/Zurich:20260914T090000',
      'SUMMARY:Standup'
    );
    expect(
      expandEvents(parseIcs(file(withHoliday)), '2026-09-01', '2026-09-30').occurrences.map(
        (one) => one.date
      )
    ).toEqual(['2026-09-07', '2026-09-21', '2026-09-28']);
  });

  it('lets a RECURRENCE-ID VEVENT replace the instance the rule would have made', () => {
    const moved = event(
      'UID:standup@example.ch',
      'RECURRENCE-ID;TZID=Europe/Zurich:20260914T090000',
      'DTSTART;TZID=Europe/Zurich:20260914T140000',
      'SUMMARY:Standup, verschoben'
    );
    const out = expandEvents(
      parseIcs(file(STANDUP, moved)),
      '2026-09-01',
      '2026-09-30'
    ).occurrences;
    const changed = out.find((one) => one.date === '2026-09-14');
    expect(changed).toMatchObject({
      time: '14:00',
      summary: 'Standup, verschoben',
      overridden: true,
    });
    expect(out).toHaveLength(4);
  });

  it('drops an instance the calendar cancelled', () => {
    // "This week's is off" arrives as a RECURRENCE-ID VEVENT with STATUS:
    // CANCELLED. Importing it would write in the one meeting that is certainly
    // not happening.
    const off = event(
      'UID:standup@example.ch',
      'RECURRENCE-ID;TZID=Europe/Zurich:20260914T090000',
      'DTSTART;TZID=Europe/Zurich:20260914T090000',
      'STATUS:CANCELLED',
      'SUMMARY:Standup'
    );
    expect(
      expandEvents(parseIcs(file(STANDUP, off)), '2026-09-01', '2026-09-30').occurrences.map(
        (one) => one.date
      )
    ).toEqual(['2026-09-07', '2026-09-21', '2026-09-28']);
  });

  it('drops a cancelled series entirely', () => {
    const dead = event(
      'UID:gone@example.ch',
      'DTSTART;TZID=Europe/Zurich:20260907T100000',
      'RRULE:FREQ=WEEKLY',
      'STATUS:CANCELLED',
      'SUMMARY:Jour fixe'
    );
    expect(expandEvents(parseIcs(file(dead)), '2026-09-01', '2026-09-30').occurrences).toEqual([]);
  });

  it('keeps a single event that falls in the window and leaves out one that does not', () => {
    const inside = event(
      'UID:one@example.ch',
      'DTSTART;TZID=Europe/Zurich:20260910T113000',
      'SUMMARY:Mittagessen'
    );
    const outside = event(
      'UID:two@example.ch',
      'DTSTART;TZID=Europe/Zurich:20261110T113000',
      'SUMMARY:Später'
    );
    expect(
      expandEvents(parseIcs(file(inside, outside)), '2026-09-01', '2026-09-30').occurrences.map(
        (one) => one.uid
      )
    ).toEqual(['one@example.ch']);
  });

  it('gives an all-day occurrence no time, rather than midnight', () => {
    const allDay = event(
      'UID:ferien@example.ch',
      'DTSTART;VALUE=DATE:20260914',
      'DTEND;VALUE=DATE:20260919',
      'SUMMARY:Ferien'
    );
    const [only] = expandEvents(parseIcs(file(allDay)), '2026-09-01', '2026-09-30').occurrences;
    expect(only).toMatchObject({ date: '2026-09-14', time: null, endDate: '2026-09-19' });
  });

  it('carries a rule it could not honour onto every occurrence it produced', () => {
    // So the caller can refuse to present them as settled. Nothing here is
    // allowed to fail quietly into a note.
    const odd = event(
      'UID:odd@example.ch',
      'DTSTART;TZID=Europe/Zurich:20260907T090000',
      'RRULE:FREQ=MONTHLY;BYDAY=MO;BYSETPOS=-1',
      'SUMMARY:Monatsrapport'
    );
    const out = expandEvents(parseIcs(file(odd)), '2026-09-01', '2026-09-30').occurrences;
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((one) => one.unsupported.includes('BYSETPOS'))).toBe(true);
  });

  it('sorts by day and then by clock, so a day reads in order', () => {
    const late = event(
      'UID:late@example.ch',
      'DTSTART;TZID=Europe/Zurich:20260910T160000',
      'SUMMARY:Spät'
    );
    const early = event(
      'UID:early@example.ch',
      'DTSTART;TZID=Europe/Zurich:20260910T080000',
      'SUMMARY:Früh'
    );
    expect(
      expandEvents(parseIcs(file(late, early)), '2026-09-01', '2026-09-30').occurrences.map(
        (one) => one.uid
      )
    ).toEqual(['early@example.ch', 'late@example.ch']);
  });

  it('names a series it could not honour even when that series produced nothing here', () => {
    // The reason `unsupported` is on the expansion and not only on the
    // occurrences: a rule this mis-reads can expand to nothing at all, and
    // then there is no occurrence left to carry the warning.
    const january = event(
      'UID:jahresrapport@example.ch',
      'DTSTART;TZID=Europe/Zurich:20260105T090000',
      'RRULE:FREQ=YEARLY;BYMONTH=1;BYSETPOS=1',
      'SUMMARY:Jahresrapport'
    );
    const out = expandEvents(parseIcs(file(january)), '2026-09-01', '2026-09-30');
    expect(out.occurrences).toEqual([]);
    expect(out.unsupported).toEqual([
      { uid: 'jahresrapport@example.ch', summary: 'Jahresrapport', parts: ['BYSETPOS'] },
    ]);
  });

  it('names a series whose walk gave up, so that is not read as an empty one', () => {
    const ancient = event(
      'UID:ancient@example.ch',
      'DTSTART;TZID=Europe/Zurich:19000101T090000',
      'RRULE:FREQ=DAILY',
      'SUMMARY:Uralt'
    );
    const out = expandEvents(parseIcs(file(ancient)), '2026-09-01', '2026-09-30');
    expect(out.occurrences).toEqual([]);
    expect(out.truncated).toEqual([{ uid: 'ancient@example.ch', summary: 'Uralt' }]);
  });

  it('reports nothing on either list for a file it read whole', () => {
    const out = expandEvents(parseIcs(file(STANDUP)), '2026-09-01', '2026-09-30');
    expect(out.unsupported).toEqual([]);
    expect(out.truncated).toEqual([]);
  });

  it('ignores an event with no DTSTART instead of inventing a day for it', () => {
    const broken = event('UID:broken@example.ch', 'SUMMARY:Ohne Datum');
    expect(expandEvents(parseIcs(file(broken)), '2026-09-01', '2026-09-30').occurrences).toEqual(
      []
    );
  });
});

describe('what the calendar owner answered', () => {
  const ME = 'stefan@example.ch';
  const attendee = (address: string, partstat: string, role = 'REQ-PARTICIPANT') =>
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=${role};PARTSTAT=${partstat};CN=${address}:mailto:${address}`;

  const SERIES = event(
    'UID:ptm@example.ch',
    'DTSTART;TZID=Europe/Zurich:20260402T133000',
    'DTEND;TZID=Europe/Zurich:20260402T143000',
    'RRULE:FREQ=WEEKLY;BYDAY=TH',
    'SUMMARY:PTM incl. Change Board',
    attendee('chef@example.ch', 'ACCEPTED'),
    attendee(ME, 'NEEDS-ACTION')
  );

  it('reads the answer off the attendee line naming the owner', () => {
    const [only] = expandEvents(parseIcs(file(SERIES)), '2026-09-10', '2026-09-10', ME).occurrences;
    expect(only?.partstat).toBe('NEEDS-ACTION');
  });

  it('says nothing when the owner is not on the invitation', () => {
    // Somebody's own blocked time, which is most of a working calendar. It is
    // not an invitation and there is nothing to have answered.
    const mine = event(
      'UID:focus@example.ch',
      'DTSTART;TZID=Europe/Zurich:20260910T060000',
      'SUMMARY:Focus-Time'
    );
    const [only] = expandEvents(parseIcs(file(mine)), '2026-09-10', '2026-09-10', ME).occurrences;
    expect(only?.partstat).toBe('');
  });

  it('says nothing when nobody said whose calendar it is', () => {
    const [only] = expandEvents(parseIcs(file(SERIES)), '2026-09-10', '2026-09-10').occurrences;
    expect(only?.partstat).toBe('');
  });

  it('takes the answer from the instance, not from the series', () => {
    // The case a real calendar is full of: a standing meeting that reads
    // NEEDS-ACTION as a series and DECLINED on the particular Thursdays
    // somebody turned down. A per-series reading gets every one of those
    // wrong, and writes a day claiming they are in a room they declined.
    const declinedOnce = event(
      'UID:ptm@example.ch',
      'RECURRENCE-ID;TZID=Europe/Zurich:20260903T133000',
      'DTSTART;TZID=Europe/Zurich:20260903T133000',
      'DTEND;TZID=Europe/Zurich:20260903T143000',
      'SUMMARY:PTM incl. Change Board',
      attendee('chef@example.ch', 'ACCEPTED'),
      attendee(ME, 'DECLINED')
    );
    const out = expandEvents(
      parseIcs(file(SERIES, declinedOnce)),
      '2026-09-01',
      '2026-09-30',
      ME
    ).occurrences;
    expect(out.map((one) => [one.date, one.partstat])).toEqual([
      ['2026-09-03', 'DECLINED'],
      ['2026-09-10', 'NEEDS-ACTION'],
      ['2026-09-17', 'NEEDS-ACTION'],
      ['2026-09-24', 'NEEDS-ACTION'],
    ]);
  });

  it('reads an attendee with no PARTSTAT as not having answered', () => {
    // RFC 5545 3.2.12's own default, and what an invitation sitting unopened
    // in an inbox actually is.
    const bare = event(
      'UID:x@example.ch',
      'DTSTART;TZID=Europe/Zurich:20260910T090000',
      'SUMMARY:Sync',
      `ATTENDEE;CN=${ME}:mailto:${ME}`
    );
    const [only] = expandEvents(parseIcs(file(bare)), '2026-09-10', '2026-09-10', ME).occurrences;
    expect(only?.partstat).toBe('NEEDS-ACTION');
  });

  it('matches an address whatever case the file wrote it in', () => {
    const shouty = event(
      'UID:y@example.ch',
      'DTSTART;TZID=Europe/Zurich:20260910T090000',
      'SUMMARY:Sync',
      `ATTENDEE;PARTSTAT=DECLINED;CN=X:mailto:Stefan@Example.CH`
    );
    const [only] = expandEvents(parseIcs(file(shouty)), '2026-09-10', '2026-09-10', ME).occurrences;
    expect(only?.partstat).toBe('DECLINED');
  });
});
