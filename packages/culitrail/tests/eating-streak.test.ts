/**
 * The eating streak.
 *
 * Week arithmetic over dates that arrive as strings, which is where an
 * off-by-one week hides. The fixed `now` in every case is what makes the
 * assertions mean anything, and the year-boundary cases are the ones that would
 * be wrong if this counted calendar weeks instead of ISO ones.
 */
import { describe, expect, it } from 'vitest';
import { eatingStreakValue, eatingStreakWeeks } from '../src/meals/view-model/eating-streak';
import { mergeSettings } from '../src/settings/validate';
import { resolveBadgeValues } from '../src/meals/view-model/badge-values';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

// Tuesday 11 August 2026, which is ISO week 2026-W33. Local midnight, which is
// what every real caller passes and what the week arithmetic reads.
const NOW = new Date(2026, 7, 11);

describe('counting the streak', () => {
  it('is zero for a meal never eaten', () => {
    expect(eatingStreakWeeks([], NOW)).toBe(0);
  });

  it('is one for a single meal eaten this week', () => {
    expect(eatingStreakWeeks(['2026-08-10'], NOW)).toBe(1);
  });

  it('counts consecutive weeks, not entries', () => {
    // Two entries in one week are one week of the streak. A meal eaten twice on
    // Sunday is not on a two-week run.
    expect(eatingStreakWeeks(['2026-08-10', '2026-08-11'], NOW)).toBe(1);
  });

  it('runs back through unbroken weeks', () => {
    expect(eatingStreakWeeks(['2026-08-10', '2026-08-04', '2026-07-28'], NOW)).toBe(3);
  });

  it('stops at the first week nothing was eaten in', () => {
    // W33, W32, then nothing in W31, so W30 does not extend it.
    expect(eatingStreakWeeks(['2026-08-10', '2026-08-04', '2026-07-21'], NOW)).toBe(2);
  });

  it('counts a streak that ended last week as still running', () => {
    // A meal eaten every Sunday has a live streak on the following Tuesday.
    // Resetting to zero every Monday morning would be wrong for most of a week.
    expect(eatingStreakWeeks(['2026-08-04', '2026-07-28'], NOW)).toBe(2);
  });

  it('is zero once two weeks have passed with nothing eaten', () => {
    expect(eatingStreakWeeks(['2026-07-28', '2026-07-21'], NOW)).toBe(0);
  });

  it('ignores a run that ended long ago', () => {
    expect(eatingStreakWeeks(['2026-03-02', '2026-02-23', '2026-02-16'], NOW)).toBe(0);
  });

  it('does not count forward from a future entry', () => {
    // A dated-ahead entry is somebody planning rather than recording. It lands in
    // a later week, which the walk back from this week never visits.
    expect(eatingStreakWeeks(['2026-08-24', '2026-08-10'], NOW)).toBe(1);
  });

  it('reads unsorted dates the same as sorted ones', () => {
    const dates = ['2026-07-28', '2026-08-10', '2026-08-04'];
    expect(eatingStreakWeeks(dates, NOW)).toBe(3);
  });

  it('ignores a date it cannot read rather than breaking the run', () => {
    expect(eatingStreakWeeks(['2026-08-10', 'sometime last week', '2026-08-04'], NOW)).toBe(2);
  });

  it('reads a datetime by its day', () => {
    expect(eatingStreakWeeks(['2026-08-10T18:30', '2026-08-04T09:00'], NOW)).toBe(2);
  });

  it('crosses a year boundary by ISO week, not by calendar year', () => {
    // 2026-01-01 is a Thursday, so it is in ISO week 2026-W01 along with
    // 2025-12-29. Counting by calendar year would break the run at New Year.
    const newYear = new Date(2026, 0, 6); // 2026-W02
    expect(eatingStreakWeeks(['2026-01-05', '2026-01-01', '2025-12-22'], newYear)).toBe(3);
  });

  it('treats 31 December as week 1 of the next year where ISO does', () => {
    // 2025-12-31 is a Wednesday, in 2026-W01.
    const firstWeek = new Date(2026, 0, 2);
    expect(eatingStreakWeeks(['2025-12-31'], firstWeek)).toBe(1);
  });
});

describe('the badge value', () => {
  it('withholds a streak of one, because that is not a streak', () => {
    // Every meal eaten in the last fortnight would otherwise wear the badge,
    // which would make it mean "eaten recently". Last eaten says that better.
    expect(eatingStreakValue(['2026-08-10'], NOW)).toBeNull();
  });

  it('shows a streak of two or more', () => {
    expect(eatingStreakValue(['2026-08-10', '2026-08-04'], NOW)).toBe(2);
  });

  it('withholds anything for a meal never eaten', () => {
    expect(eatingStreakValue([], NOW)).toBeNull();
  });
});

describe('the streak badge', () => {
  const settings = mergeSettings({});
  // Looked up once and asserted here rather than with a `!` at every use: if
  // the built-in is ever dropped from the defaults, this is the failure worth
  // reading rather than twelve null-dereferences.
  const badge = DEFAULT_SETTINGS.headerBadges.find((entry) => entry.derived === 'eatingStreak');
  if (!badge) throw new Error('the eatingStreak built-in badge is missing from the defaults');

  it('ships with the built-ins, disabled', () => {
    // Disabled so nobody's arranged header gains a chip on upgrade, and so the
    // migration in validate.ts can safely re-add it to an older saved list.
    expect(badge.enabled).toBe(false);
  });

  it('has no property and no formula, so nothing can shadow it', () => {
    expect(badge.formula).toBeUndefined();
    expect(badge.property).toBe('');
  });

  it('reads the frontmatter log', () => {
    const frontmatter = {
      eatingHistory: [{ date: '2026-08-10' }, { date: '2026-08-04' }, { date: '2026-07-28' }],
    };

    expect(resolveBadgeValues(badge, frontmatter, settings, NOW)).toEqual(['3 weeks']);
  });

  it('renders nothing when the streak is too short to show', () => {
    const frontmatter = { eatingHistory: [{ date: '2026-08-10' }] };
    expect(resolveBadgeValues(badge, frontmatter, settings, NOW)).toEqual([]);
  });

  it('renders nothing on a meal with no log at all', () => {
    expect(resolveBadgeValues(badge, {}, settings, NOW)).toEqual([]);
  });

  it('renders nothing when eating history is switched off', () => {
    const off = mergeSettings({ eatingHistoryEnabled: false });
    const frontmatter = { eatingHistory: [{ date: '2026-08-10' }, { date: '2026-08-04' }] };

    expect(resolveBadgeValues(badge, frontmatter, off, NOW)).toEqual([]);
  });

  it('reads the log from a renamed property', () => {
    const renamed = mergeSettings({ eatingHistoryFrontmatterProperty: 'gekocht' });
    const frontmatter = { gekocht: [{ date: '2026-08-10' }, { date: '2026-08-04' }] };

    expect(resolveBadgeValues(badge, frontmatter, renamed, NOW)).toEqual(['2 weeks']);
  });

  it('ignores a real eatingStreak property, which is not what drives it', () => {
    // The value is computed, and `derived` is a separate field from `property`
    // precisely so a vault carrying its own eatingStreak: cannot shadow it.
    const frontmatter = { eatingStreak: 99, eatingHistory: [{ date: '2026-08-10' }] };
    expect(resolveBadgeValues(badge, frontmatter, settings, NOW)).toEqual([]);
  });
});
