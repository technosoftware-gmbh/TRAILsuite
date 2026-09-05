/**
 * How many ISO weeks in a row a meal has been eaten.
 *
 * A week rather than a day, because a meal eaten on two consecutive days is
 * a leftover rather than a habit, and a household's eating rotation turns over
 * weekly. It is also the period the meal plan and the shopping list are already
 * keyed on, so a streak counts the same thing a plan does.
 *
 * The **current** run, counting back from this week, not the best one the log
 * ever held. A record that only ever goes up would say nothing about whether
 * the meal is still in the rotation, which is the question a badge beside
 * "last made" is being asked.
 *
 * App-free.
 */
import { formatWeekTitle, parseDayTitle, shiftWeekTitle } from '@technosoftware/trail-core';

/**
 * The week a `YYYY-MM-DD` day falls in, or null when it does not parse.
 *
 * Local midnight, through `parseDayTitle`, because everything in `trail-core`'s
 * date layer reads local calendar fields. This used to build the date with
 * `Date.UTC` instead: a cook logged on a Monday then came back out as the Sunday
 * before it for any vault west of Greenwich, and its streak counted one week too
 * many. A cook date is the day the household says it eaten, which is a local
 * calendar day, so the slice off the front is all this needs.
 */
function weekOfDay(day: string): string | null {
  const date = parseDayTitle(day.trim().slice(0, 10));
  return date ? formatWeekTitle(date) : null;
}

/**
 * The streak, in weeks.
 *
 * Zero when the meal was eaten neither this week nor last. **Last week
 * counts as still running**, deliberately: a meal eaten every Sunday has a
 * live streak on the following Tuesday, and a badge that reset every Monday
 * morning until the next cook would be wrong for most of every week.
 *
 * `now` is a parameter so this is testable and so a caller can ask about a week
 * other than the current one.
 */
export function eatingStreakWeeks(dates: string[], now: Date = new Date()): number {
  const weeks = new Set<string>();
  for (const date of dates) {
    const week = weekOfDay(date);
    if (week) weeks.add(week);
  }
  if (weeks.size === 0) return 0;

  const thisWeek = formatWeekTitle(now);
  const lastWeek = shiftWeekTitle(thisWeek, -1);

  // Where the count starts. This week when it holds a cook, otherwise last
  // week, otherwise the streak has already been broken.
  let cursor: string | null = weeks.has(thisWeek)
    ? thisWeek
    : lastWeek && weeks.has(lastWeek)
      ? lastWeek
      : null;
  if (!cursor) return 0;

  let streak = 0;
  while (cursor && weeks.has(cursor)) {
    streak += 1;
    cursor = shiftWeekTitle(cursor, -1);
  }

  return streak;
}

/**
 * The streak as a badge value, or null when there is no streak worth showing.
 *
 * One week is not a streak. Every meal eaten in the last fortnight would
 * otherwise wear the badge, which would make it mean "eaten recently", and
 * "last made" already says that better.
 */
export function eatingStreakValue(dates: string[], now: Date = new Date()): number | null {
  const streak = eatingStreakWeeks(dates, now);
  return streak >= 2 ? streak : null;
}
