/**
 * Reading an iCalendar file.
 *
 * The cases here are the ones that make a naive parser look like it works. A
 * file where every line is short, unescaped, single-valued and untimed parses
 * with three lines of code; the ones below are what a real Google or Apple
 * export actually contains.
 */
import { describe, expect, it } from 'vitest';
import {
  calendarOwner,
  lastDayOf,
  parseIcs,
  parseLine,
  parseMoment,
  unfoldLines,
} from '../../src/calendar/ics.js';

/** Wraps events in the envelope a real file has, so the component skipping is exercised too. */
function file(...blocks: string[]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Google Inc//Google Calendar//EN',
    ...blocks,
    'END:VCALENDAR',
  ].join('\r\n');
}

const EVENT = [
  'BEGIN:VEVENT',
  'UID:abc123@google.com',
  'DTSTART;TZID=Europe/Zurich:20260902T090000',
  'DTEND;TZID=Europe/Zurich:20260902T093000',
  'SUMMARY:Meeting mit Care Management',
  'END:VEVENT',
].join('\r\n');

describe('unfoldLines', () => {
  it('joins a continuation onto the line before', () => {
    expect(unfoldLines('SUMMARY:Meeting mit\r\n  Care Management')).toEqual([
      'SUMMARY:Meeting mit Care Management',
    ]);
  });

  it('joins with nothing between, so a fold inside a word survives', () => {
    // A producer may fold at exactly 75 octets, wherever that lands. Adding a
    // space would turn "Management" into "Manage ment".
    expect(unfoldLines('SUMMARY:Manage\r\n ment')).toEqual(['SUMMARY:Management']);
  });

  it('accepts a tab as the continuation marker', () => {
    expect(unfoldLines('SUMMARY:a\r\n\tb')).toEqual(['SUMMARY:ab']);
  });

  it('accepts bare LF, which half the files in the world use', () => {
    expect(unfoldLines('A:1\nB:2')).toEqual(['A:1', 'B:2']);
  });

  it('leaves a leading space on the first line alone rather than joining it to nothing', () => {
    expect(unfoldLines(' orphan')).toEqual([' orphan']);
  });
});

describe('parseLine', () => {
  it('splits a plain property', () => {
    expect(parseLine('SUMMARY:Standup')).toEqual({
      name: 'SUMMARY',
      parameters: {},
      value: 'Standup',
    });
  });

  it('upper-cases the name, so DTSTART and dtstart are one thing', () => {
    expect(parseLine('dtstart:20260902')?.name).toBe('DTSTART');
  });

  it('reads parameters', () => {
    expect(parseLine('DTSTART;TZID=Europe/Zurich;VALUE=DATE-TIME:20260902T090000')).toEqual({
      name: 'DTSTART',
      parameters: { TZID: 'Europe/Zurich', VALUE: 'DATE-TIME' },
      value: '20260902T090000',
    });
  });

  it('ends the parameters at the first colon OUTSIDE a quoted value', () => {
    // The parameter value has to contain a colon for this to test anything.
    // The first draft used `CN="Meier, Stefan"`, where the first colon in the
    // line is already the right one -- so splitting on `indexOf(':')` passed
    // it, and the comment claiming otherwise was asserting something false.
    // `MEMBER="mailto:..."` is the real shape: the first colon is inside the
    // quotes, and a naive split makes the name `ATTENDEE;MEMBER="mailto` and
    // the value `group@example.ch"`.
    const parsed = parseLine('ATTENDEE;MEMBER="mailto:group@example.ch":mailto:stefan@example.ch');
    expect(parsed?.name).toBe('ATTENDEE');
    expect(parsed?.parameters.MEMBER).toBe('mailto:group@example.ch');
    expect(parsed?.value).toBe('mailto:stefan@example.ch');
  });

  it('reads a quoted parameter holding a comma', () => {
    expect(parseLine('ATTENDEE;CN="Meier, Stefan":mailto:stefan@example.ch')?.parameters.CN).toBe(
      'Meier, Stefan'
    );
  });

  it('does not split parameters on a semicolon inside quotes', () => {
    const parsed = parseLine('X-THING;NOTE="a;b":value');
    expect(parsed?.parameters.NOTE).toBe('a;b');
    expect(parsed?.value).toBe('value');
  });

  it('unescapes the four escapes', () => {
    expect(parseLine('SUMMARY:Lunch\\, then PMQ')?.value).toBe('Lunch, then PMQ');
    expect(parseLine('SUMMARY:a\\;b')?.value).toBe('a;b');
    expect(parseLine('DESCRIPTION:line\\nline')?.value).toBe('line\nline');
    expect(parseLine('SUMMARY:back\\\\slash')?.value).toBe('back\\slash');
  });

  it('keeps a backslash it does not recognise rather than eating a character', () => {
    expect(parseLine('SUMMARY:C:\\path')?.value).toBe('C:\\path');
  });

  it('is null for a line with no colon at all', () => {
    expect(parseLine('nonsense')).toBeNull();
    expect(parseLine('')).toBeNull();
  });
});

describe('parseMoment', () => {
  const moment = (line: string) => parseMoment(parseLine(line)!);

  it('reads a zoned datetime', () => {
    expect(moment('DTSTART;TZID=Europe/Zurich:20260902T090000')).toEqual({
      date: '2026-09-02',
      time: '09:00',
      zone: 'Europe/Zurich',
      utc: false,
    });
  });

  it('reads a UTC datetime', () => {
    expect(moment('DTSTART:20260902T070000Z')).toEqual({
      date: '2026-09-02',
      time: '07:00',
      zone: null,
      utc: true,
    });
  });

  it('reads a floating datetime, which is neither zoned nor UTC', () => {
    expect(moment('DTSTART:20260902T090000')).toEqual({
      date: '2026-09-02',
      time: '09:00',
      zone: null,
      utc: false,
    });
  });

  it('gives an all-day value no time at all, rather than midnight', () => {
    // Midnight would sort an all-day event into the start of the morning. It
    // has no time, and the meeting line already renders an untimed entry.
    expect(moment('DTSTART;VALUE=DATE:20260907')).toEqual({
      date: '2026-09-07',
      time: null,
      zone: null,
      utc: false,
    });
  });

  it('honours VALUE=DATE over the shape of the string', () => {
    expect(moment('DTSTART;VALUE=DATE:20260907T000000')?.time).toBeNull();
  });

  it('drops seconds, which this suite has nowhere to put', () => {
    expect(moment('DTSTART:20260902T090030')?.time).toBe('09:00');
  });

  it('is null for something that is not a date', () => {
    expect(moment('DTSTART:tomorrow')).toBeNull();
  });
});

describe('parseIcs', () => {
  it('reads an event', () => {
    const [event] = parseIcs(file(EVENT));
    expect(event?.uid).toBe('abc123@google.com');
    expect(event?.summary).toBe('Meeting mit Care Management');
    expect(event?.start?.time).toBe('09:00');
    expect(event?.end?.time).toBe('09:30');
  });

  it('reads several', () => {
    expect(parseIcs(file(EVENT, EVENT))).toHaveLength(2);
  });

  it('skips a VTIMEZONE without reading its innards as an event', () => {
    // A VTIMEZONE carries DTSTART properties of its own, one per transition.
    // A flat scan reads them as the event's and the meeting moves to 1970.
    const zone = [
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Zurich',
      'BEGIN:DAYLIGHT',
      'DTSTART:19700329T020000',
      'TZOFFSETFROM:+0100',
      'END:DAYLIGHT',
      'END:VTIMEZONE',
    ].join('\r\n');
    const events = parseIcs(file(zone, EVENT));
    expect(events).toHaveLength(1);
    expect(events[0]?.start?.date).toBe('2026-09-02');
  });

  it('does not let a VALARM inside an event close it or lend it a summary', () => {
    const withAlarm = [
      'BEGIN:VEVENT',
      'UID:x',
      'DTSTART:20260902T090000',
      'SUMMARY:Real summary',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'SUMMARY:Reminder',
      'TRIGGER:-PT10M',
      'END:VALARM',
      'LOCATION:Room 2',
      'END:VEVENT',
    ].join('\r\n');
    const [event] = parseIcs(file(withAlarm));
    expect(event?.summary).toBe('Real summary');
    // Read after the alarm closed, so the nesting really was tracked.
    expect(event?.location).toBe('Room 2');
  });

  it('flattens EXDATE across several properties and several values in one', () => {
    const recurring = [
      'BEGIN:VEVENT',
      'UID:r',
      'DTSTART;TZID=Europe/Zurich:20260907T090000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'EXDATE;TZID=Europe/Zurich:20260914T090000,20260921T090000',
      'EXDATE;TZID=Europe/Zurich:20261005T090000',
      'END:VEVENT',
    ].join('\r\n');
    const [event] = parseIcs(file(recurring));
    expect(event?.rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
    expect(event?.exdates).toEqual(['20260914T090000', '20260921T090000', '20261005T090000']);
  });

  it('keeps a folded summary whole', () => {
    const folded = [
      'BEGIN:VEVENT',
      'UID:f',
      'DTSTART:20260902T090000',
      'SUMMARY:Meeting mit Care Management und',
      '  Lukas',
      'END:VEVENT',
    ].join('\r\n');
    expect(parseIcs(file(folded))[0]?.summary).toBe('Meeting mit Care Management und Lukas');
  });

  it('reads a cancelled event rather than dropping it, and says so', () => {
    // Dropping it here would be a policy decision in a parser. The planner
    // decides what a cancelled event means; this only reports it.
    const cancelled = [
      'BEGIN:VEVENT',
      'UID:c',
      'DTSTART:20260902T090000',
      'STATUS:CANCELLED',
      'END:VEVENT',
    ].join('\r\n');
    expect(parseIcs(file(cancelled))[0]?.status).toBe('CANCELLED');
  });

  it('reads a RECURRENCE-ID override', () => {
    const override = [
      'BEGIN:VEVENT',
      'UID:r',
      'RECURRENCE-ID;TZID=Europe/Zurich:20260914T090000',
      'DTSTART;TZID=Europe/Zurich:20260914T100000',
      'SUMMARY:Moved this week',
      'END:VEVENT',
    ].join('\r\n');
    expect(parseIcs(file(override))[0]?.recurrenceId).toBe('20260914T090000');
  });

  it('is empty for a file with no events', () => {
    expect(parseIcs(file())).toEqual([]);
    expect(parseIcs('')).toEqual([]);
  });
});

describe('lastDayOf', () => {
  const day = (date: string) => ({ date, time: null, zone: null, utc: false });
  const at = (date: string, time: string) => ({ date, time, zone: 'Europe/Zurich', utc: false });

  it('takes an all-day end as exclusive', () => {
    // DTEND;VALUE=DATE:20260919 means the last day is the 18th. Read
    // inclusively, every holiday gains a day and the week view shows somebody
    // away on the morning they came back.
    expect(lastDayOf(day('2026-09-14'), day('2026-09-19'))).toBe('2026-09-18');
  });

  it('gives a one-day all-day event the day it starts on', () => {
    expect(lastDayOf(day('2026-09-14'), day('2026-09-15'))).toBe('2026-09-14');
  });

  it('takes a timed end as inclusive', () => {
    expect(lastDayOf(at('2026-09-14', '09:00'), at('2026-09-16', '17:00'))).toBe('2026-09-16');
  });

  it('gives a meeting that ends at midnight to the day it started', () => {
    // 22:00 to 00:00 states tomorrow's date. A line in tomorrow's note would
    // announce a meeting on a morning when nothing happens.
    expect(lastDayOf(at('2026-09-14', '22:00'), at('2026-09-15', '00:00'))).toBe('2026-09-14');
  });

  it('keeps a timed event inside its day', () => {
    expect(lastDayOf(at('2026-09-14', '09:00'), at('2026-09-14', '09:30'))).toBe('2026-09-14');
  });

  it('ignores an end that falls before the start rather than repairing it', () => {
    expect(lastDayOf(at('2026-09-14', '09:00'), at('2026-09-10', '09:30'))).toBe('2026-09-14');
  });

  it('gives an event with no stated end the day it starts on', () => {
    expect(lastDayOf(at('2026-09-14', '09:00'), null)).toBe('2026-09-14');
  });
});

describe('attendees', () => {
  const invited = [
    'BEGIN:VEVENT',
    'UID:sync@example.ch',
    'DTSTART;TZID=Europe/Zurich:20260910T090000',
    'SUMMARY:Sync',
    'ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=DECLINED;CN=Stefan J:mailto:Stefan@Example.CH',
    'ATTENDEE;ROLE=OPT-PARTICIPANT;PARTSTAT=ACCEPTED;CN=Chef:mailto:chef@example.ch',
    'END:VEVENT',
  ].join('\r\n');

  it('reads the answer, the role and the name off each one', () => {
    // The parameters are keyed upper-case, which this test exists to pin: read
    // as `partstat` they all come back empty, and an importer then believes
    // nobody has answered any invitation in the file.
    const [event] = parseIcs(file(invited));
    expect(event?.attendees[0]).toEqual({
      address: 'stefan@example.ch',
      partstat: 'DECLINED',
      role: 'REQ-PARTICIPANT',
      cn: 'Stefan J',
    });
  });

  it('strips mailto: and lower-cases the address, which is the only part two files agree on', () => {
    // The CN is a display name in one export and the address again in another.
    const [event] = parseIcs(file(invited));
    expect(event?.attendees.map((one) => one.address)).toEqual([
      'stefan@example.ch',
      'chef@example.ch',
    ]);
  });

  it('keeps an optional invitation apart from a required one', () => {
    const [event] = parseIcs(file(invited));
    expect(event?.attendees[1]?.role).toBe('OPT-PARTICIPANT');
  });

  it('gives an event nobody was invited to an empty list, not a missing one', () => {
    expect(parseIcs(file(EVENT))[0]?.attendees).toEqual([]);
  });
});

describe('calendarOwner', () => {
  it('reads whose calendar it is out of the file', () => {
    // So the import can pick your ATTENDEE line out of the thirty on a
    // meeting. Being asked for your own address by a program reading your own
    // calendar is a poor way to start.
    expect(calendarOwner(file('X-WR-CALNAME:stefan.muster@example.ch', EVENT))).toBe(
      'stefan.muster@example.ch'
    );
  });

  it('says nothing when the calendar is named rather than addressed', () => {
    // A calendar called "Work" tells us nothing about who owns it, and
    // guessing from the attendee lists would pick whoever appears most.
    expect(calendarOwner(file('X-WR-CALNAME:Work', EVENT))).toBe('');
  });

  it('says nothing when the file does not say', () => {
    expect(calendarOwner(file(EVENT))).toBe('');
  });
});
