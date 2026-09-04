/**
 * How much eating happened, bucketed over a range of weeks.
 *
 * Read from the eating-history logs the gallery entries already carry, so the
 * dashboard's chart and its "eaten recently" figure count the same cooks.
 * Nothing here is stored: a chart of the last eight weeks written into settings
 * would be wrong tomorrow and there would be nothing to notice it.
 *
 * App-free.
 */
import type { GalleryEntry } from './gallery-entry';
import { dayTime } from './library-stats';

export type ActivityGranularity = 'day' | 'week';

export interface ActivityEating {
  title: string;
  /** The note path, so a click can open the meal without re-searching for it. */
  path: string;
}

export interface ActivityBucket {
  /** `YYYY-MM-DD` of the first day in the bucket. */
  start: string;
  count: number;
  /** Every cook in the bucket, so a click can list what was made. */
  cooks: ActivityEating[];
}

export interface EatingActivity {
  granularity: ActivityGranularity;
  buckets: ActivityBucket[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Daily up to four weeks, weekly beyond it.
 *
 * Twelve weeks of daily bars is eighty-four bars in a card a few hundred pixels
 * wide, which is a texture rather than a chart.
 */
export function granularityFor(rangeWeeks: number): ActivityGranularity {
  return rangeWeeks <= 4 ? 'day' : 'week';
}

function localDay(time: number): string {
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Local midnight, so a cook is placed on the day it happened rather than shifted by the timezone. */
function midnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Monday of the week a time falls in, so weekly buckets line up with the ISO weeks everything else uses. */
function startOfWeek(time: number): number {
  const date = new Date(time);
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay() is Sunday-first; ISO weeks are Monday-first.
  monday.setDate(monday.getDate() - ((date.getDay() + 6) % 7));
  return monday.getTime();
}

/**
 * Every cook date a meal's log holds.
 *
 * The log, not `lastEaten`: a meal eaten six times contributes six bars'
 * worth, and using the summary field would flatten all of them into one. A
 * meal with no log but an explicit `lastEaten` still contributes that one day,
 * so a vault that only ever set the summary field is not shown as empty.
 */
function eatingDates(entry: GalleryEntry): string[] {
  if (entry.meta.eatingHistory.length > 0) {
    return entry.meta.eatingHistory.map((cook) => cook.date);
  }
  return entry.meta.lastEaten ? [entry.meta.lastEaten] : [];
}

export function buildEatingActivity(
  entries: GalleryEntry[],
  rangeWeeks: number,
  now: Date = new Date()
): EatingActivity {
  const granularity = granularityFor(rangeWeeks);
  const today = midnight(now);

  // Bucket starts, oldest first. The last bucket is always the one today falls
  // in, so the chart ends at now rather than at the end of a partial period.
  const starts: number[] =
    granularity === 'day'
      ? Array.from(
          { length: rangeWeeks * 7 },
          (_, index) => today - (rangeWeeks * 7 - 1 - index) * DAY_MS
        )
      : Array.from({ length: rangeWeeks }, (_, index) =>
          startOfWeek(today - (rangeWeeks - 1 - index) * 7 * DAY_MS)
        );

  const buckets: ActivityBucket[] = starts.map((start) => ({
    start: localDay(start),
    count: 0,
    cooks: [],
  }));

  const indexOf = new Map(buckets.map((bucket, index) => [bucket.start, index]));

  for (const entry of entries) {
    for (const date of eatingDates(entry)) {
      const time = dayTime(date);
      if (time === null) continue;

      const key = localDay(granularity === 'day' ? time : startOfWeek(time));
      const index = indexOf.get(key);
      // Outside the range, which is most of a long-lived log.
      if (index === undefined) continue;

      buckets[index].count += 1;
      buckets[index].cooks.push({ title: entry.title, path: entry.file.path });
    }
  }

  return { granularity, buckets };
}
