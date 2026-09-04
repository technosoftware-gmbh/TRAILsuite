/**
 * The date layer, run in every shape of timezone offset.
 *
 * This is the file that pays for the whole module. The code it replaces mixed
 * two conventions, one working in local calendar fields and one canonicalising
 * to UTC midnight while still reading its inputs with local getters. Where they
 * met, a Monday at UTC midnight read back as the Sunday before it anywhere west
 * of Greenwich, and the ISO week derived from it was the previous one. Measured
 * over 2015 to 2040, every single week from UTC-3 westward resolved one week
 * early. No test caught it, because every test ran in one timezone, and that
 * timezone was east of Greenwich.
 *
 * **The timezone is set in `beforeAll`, never in the `describe` body, and every
 * block asserts the offset it actually got.** A `describe.each` body runs during
 * collection, so an assignment there happens for all zones before any test runs
 * and leaves every one of them in the last zone in the list. This file was
 * written that way first: it passed, reported fourteen zones, and had run
 * Pacific/Midway fourteen times. `it('is actually running in this zone')` is
 * what makes that impossible to repeat.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addDays,
  formatDayTitle,
  formatWeekTitle,
  isoWeekOf,
  parseDayTitle,
  parseWeekTitle,
  shiftWeekTitle,
  startOfIsoWeek,
  startOfWeekTitle,
} from '../../src/dates';

const ORIGINAL_TZ = process.env.TZ;
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

const ZONES = [
  'UTC',
  'Europe/Berlin', // UTC+1/+2, the vault these plugins were built in
  'Europe/London', // UTC+0/+1, crosses the meridian twice a year
  'Asia/Kolkata', // UTC+5:30, a half-hour offset
  'Asia/Kathmandu', // UTC+5:45, a quarter-hour offset
  'Asia/Tokyo', // UTC+9, no daylight saving
  'Australia/Sydney', // southern hemisphere daylight saving
  'Pacific/Kiritimati', // UTC+14, the far end of the line
  'Atlantic/Azores', // UTC-1/+0, straddles the meridian
  'America/Sao_Paulo', // UTC-3
  'America/New_York', // UTC-5/-4
  'America/Los_Angeles', // UTC-8/-7
  'Pacific/Marquesas', // UTC-9:30, a negative half-hour offset
  'Pacific/Midway', // UTC-11, the other far end
] as const;

/**
 * A zone's offset from UTC in minutes at a given instant, derived through `Intl`
 * rather than from a table.
 *
 * Used to check that `process.env.TZ` actually took effect, by comparing what
 * `Intl` says the named zone does against what `Date` is doing. Deriving it
 * beats hardcoding, which would be asserting a copy of the tz database rather
 * than the behaviour under test.
 */
function zoneOffsetMinutes(zone: string, instant: Date): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
    .formatToParts(instant)
    .find((part) => part.type === 'timeZoneName')?.value;

  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? 'GMT');
  if (!match) return 0;

  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** Every day in a span wide enough to cover several 53-week years and every leap-year shape. */
function everyDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    days.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return days;
}

/** Built inside the tests, never at collection time, so the zone is already in effect. */
function span(): Date[] {
  return everyDay(new Date(2015, 0, 1), new Date(2040, 11, 31));
}

describe.each(ZONES)('in %s', (zone) => {
  beforeAll(() => {
    process.env.TZ = zone;
  });

  it('is actually running in this zone, in both halves of the year', () => {
    // The guard. Without it every assertion below can pass while running
    // somewhere else entirely, which is exactly what happened.
    for (const instant of [new Date(Date.UTC(2026, 0, 15)), new Date(Date.UTC(2026, 6, 15))]) {
      // `+ 0` normalises the negative zero that negating a zero offset produces.
      // `Object.is(-0, +0)` is false, so without it every zone sitting on GMT
      // fails an assertion that is otherwise satisfied.
      expect(-instant.getTimezoneOffset() + 0).toBe(zoneOffsetMinutes(zone, instant) + 0);
    }
  });

  it('resolves a week title back to the week it names', () => {
    // The production chain that broke: title -> Monday -> the week of that
    // Monday. A note path is built from the last step, so a disagreement here is
    // a note written into the wrong week's file.
    const wrong = span()
      .map((day) => formatWeekTitle(day))
      .filter((title) => {
        const monday = startOfWeekTitle(title);
        return monday === null || formatWeekTitle(monday) !== title;
      });

    expect(wrong).toEqual([]);
  });

  it('agrees with itself about which Monday a day belongs to', () => {
    const wrong = span().filter((day) => {
      const direct = startOfIsoWeek(day);
      const viaTitle = startOfWeekTitle(formatWeekTitle(day));
      return viaTitle === null || formatDayTitle(viaTitle) !== formatDayTitle(direct);
    });

    expect(wrong.map((day) => formatDayTitle(day))).toEqual([]);
  });

  it('puts every day in the week its own Monday belongs to', () => {
    const wrong = span().filter(
      (day) => formatWeekTitle(startOfIsoWeek(day)) !== formatWeekTitle(day)
    );
    expect(wrong.map((day) => formatDayTitle(day))).toEqual([]);
  });

  it('never numbers a week outside 1 to 53', () => {
    expect(
      span()
        .map(isoWeekOf)
        .filter(({ week }) => week < 1 || week > 53)
    ).toEqual([]);
  });

  it('round trips a day title', () => {
    const wrong = span().filter((day) => {
      const parsed = parseDayTitle(formatDayTitle(day));
      return parsed === null || formatDayTitle(parsed) !== formatDayTitle(day);
    });

    expect(wrong.map((day) => formatDayTitle(day))).toEqual([]);
  });

  it('steps forward and back through week titles without drifting', () => {
    // A year of steps out and back. A millisecond-based shift loses an hour at
    // each daylight-saving change and eventually lands a day early, which is
    // what this would catch.
    const start = formatWeekTitle(new Date(2026, 0, 15));
    let title = start;
    for (let i = 0; i < 52; i++) title = shiftWeekTitle(title, 1) ?? 'broken';
    for (let i = 0; i < 52; i++) title = shiftWeekTitle(title, -1) ?? 'broken';
    expect(title).toBe(start);
  });

  it('agrees with the ISO 8601 worked examples', () => {
    // The cases the standard calls out: years that start and end mid week.
    expect(isoWeekOf(new Date(2015, 11, 28))).toEqual({ weekYear: 2015, week: 53 });
    expect(isoWeekOf(new Date(2016, 0, 3))).toEqual({ weekYear: 2015, week: 53 });
    expect(isoWeekOf(new Date(2016, 0, 4))).toEqual({ weekYear: 2016, week: 1 });
    expect(isoWeekOf(new Date(2026, 0, 1))).toEqual({ weekYear: 2026, week: 1 });
    expect(isoWeekOf(new Date(2026, 11, 31))).toEqual({ weekYear: 2026, week: 53 });
    expect(isoWeekOf(new Date(2027, 0, 1))).toEqual({ weekYear: 2026, week: 53 });
  });

  it('reads 4 January as week 1 in the years that broke the old code', () => {
    // Years where 4 January is a Monday. The replaced implementation built that
    // date in UTC and read it back locally, so week 1 came out seven days early
    // and every week in the year was shifted.
    for (const year of [2016, 2021, 2027, 2038]) {
      expect(new Date(year, 0, 4).getDay()).toBe(1);
      expect(parseWeekTitle(formatWeekTitle(new Date(year, 0, 4)))).toEqual({
        weekYear: year,
        week: 1,
      });

      const monday = startOfWeekTitle(`${year}-W01`);
      expect(monday).not.toBeNull();
      expect(formatDayTitle(monday as Date)).toBe(`${year}-01-04`);
    }
  });
});
