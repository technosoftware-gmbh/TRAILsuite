/**
 * Which file a week's notes actually land in, in the timezone the vault is
 * actually in.
 *
 * The date primitives are no longer CULItrail's. `isoWeekOf`, `startOfIsoWeek`,
 * `startOfWeekTitle`, `shiftWeekTitle` and the rest live in `trail-core`'s
 * `dates/` module and are tested there, unit by unit, across fourteen timezone
 * offsets. Restating those cases here would only assert that the dependency is
 * the dependency.
 *
 * What is CULItrail's, and what is asserted here, is the **production chain**:
 * a week title from the view, through `startOfWeekTitle()`, through
 * `resolveNotePath()`, into a `{GGGG}-W{WW}` filename. That chain used to mix
 * two conventions. The week functions returned Dates at UTC midnight while the
 * token resolver read them with local getters, so a Monday came back as the
 * Sunday before it and the note was filed one week early. Every vault west of
 * Greenwich, every week. It is caught here rather than in the core because a
 * unit test of either half passes on its own; only the round trip fails.
 *
 * Each block runs in a real timezone and asserts the offset it got, so this
 * cannot pass while silently running in the zone the author happens to sit in.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { shiftWeekTitle } from '@technosoftware/trail-core';
import { mealPlanNotePath } from '../src/planning/meal-plan/note-path';
import { mergeSettings } from '../src/settings/validate';

const settings = mergeSettings({});

/**
 * The zone, and the offset it must be in during January and July.
 *
 * The offsets are asserted rather than assumed. Setting `process.env.TZ` to a
 * name Node cannot resolve leaves the process in UTC, which would make every
 * block below pass by running the one case that was never broken.
 *
 * `Pacific/Midway` keeps its offset all year; the other three change, which is
 * why both halves of the year are checked.
 */
const ZONES = [
  { zone: 'Europe/Berlin', january: 1, july: 2 },
  { zone: 'UTC', january: 0, july: 0 },
  { zone: 'Atlantic/Azores', january: -1, july: 0 },
  { zone: 'America/New_York', january: -5, july: -4 },
  { zone: 'Pacific/Midway', january: -11, july: -11 },
];

const ORIGINAL_TZ = process.env.TZ;

/**
 * Hours east of UTC in effect on a local date, which is the readable end of
 * `getTimezoneOffset()`.
 *
 * The zero case is spelled out because negating it gives `-0`, and vitest's
 * `toBe` uses `Object.is`, which holds `-0` and `0` apart.
 */
function offsetHours(date: Date): number {
  const minutes = date.getTimezoneOffset();
  return minutes === 0 ? 0 : -minutes / 60;
}

/** The `GGGG-Www` a path was filed under, which is the one thing in it that can be silently wrong. */
function filedWeek(path: string | null): string | null {
  const match = /\d{4}-W\d{2}/.exec(path ?? '');
  return match ? match[0] : null;
}

/**
 * Every ISO week title from 2015-W01 to the end of 2040, walked with
 * `shiftWeekTitle` so the 53-week years enumerate themselves.
 *
 * Built inside each block rather than once at module scope: the walk is date
 * arithmetic too, and doing it before the timezone is set would hand every
 * block the same list, computed in the wrong zone.
 */
function everyWeekTitle(): string[] {
  const titles: string[] = [];
  let title: string | null = '2015-W01';
  while (title && !title.startsWith('2041')) {
    titles.push(title);
    title = shiftWeekTitle(title, 1);
  }
  return titles;
}

describe.each(ZONES)('filing a week in $zone', ({ zone, january, july }) => {
  // In beforeAll, NOT in the describe body. A `describe.each` body runs at
  // collection time, so all five bodies would run before the first test does
  // and every block would end up in whichever zone was assigned last.
  beforeAll(() => {
    process.env.TZ = zone;
  });

  afterAll(() => {
    // Deleted rather than set to `undefined`, which would put the literal
    // string "undefined" in the environment and leave Node in UTC.
    if (ORIGINAL_TZ === undefined) delete process.env.TZ;
    else process.env.TZ = ORIGINAL_TZ;
  });

  it('is running in the timezone this block is named for', () => {
    expect(offsetHours(new Date(2026, 0, 15))).toBe(january);
    expect(offsetHours(new Date(2026, 6, 15))).toBe(july);
  });

  it('resolves the shipped default for one known week', () => {
    expect(mealPlanNotePath(settings, '2026-W33', 'Stefan Muster')).toBe(
      'Eating/Meal Plans/2026/2026-W33-StefanMuster-MealPlan.md'
    );
  });

  it('files a meal plan under the week it was asked for, for every week from 2015 to 2040', () => {
    const titles = everyWeekTitle();
    // The walk itself has to have run. An empty list would make the filter
    // below pass without asserting anything at all.
    expect(titles.length).toBeGreaterThan(1300);

    const misfiled = titles.filter(
      (title) => filedWeek(mealPlanNotePath(settings, title, 'Stefan Muster')) !== title
    );
    expect(misfiled).toEqual([]);
  });

  it('puts a week and its year folder in the same year', () => {
    // The folder is `{GGGG}` too, so a week that resolved one way for the
    // filename and another for the folder would scatter one year's notes
    // across two folders. 2026-W01 starts in December 2025, which is where
    // the calendar year and the week year disagree.
    for (const title of ['2026-W01', '2026-W53', '2027-W01']) {
      expect(mealPlanNotePath(settings, title, 'Stefan Muster')).toBe(
        `Eating/Meal Plans/${title.slice(0, 4)}/${title}-StefanMuster-MealPlan.md`
      );
    }
  });

  it('files week 1 correctly in a year whose 4 January is a Monday', () => {
    // The second half of the same confusion: week 1 was found from a
    // `Date.UTC(weekYear, 0, 4)` that was then canonicalised with local
    // getters. In these years 4 January is itself the Monday, so reading it a
    // day early moved week 1 back a whole week.
    for (const year of [2016, 2021, 2027, 2038]) {
      expect(filedWeek(mealPlanNotePath(settings, `${year}-W01`, 'Stefan Muster'))).toBe(
        `${year}-W01`
      );
    }
  });
});
