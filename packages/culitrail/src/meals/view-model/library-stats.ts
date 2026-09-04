/**
 * What a meal library looks like from above: how big it is, how much of it
 * gets used, and what has moved lately.
 *
 * Everything here is derived at read time from entries the gallery already
 * builds, and none of it is written back. A "eaten this month" count stored
 * anywhere would be wrong the day after it was stored.
 *
 * App-free.
 */
import type { GalleryEntry } from './gallery-entry';
import { neverEaten } from './gallery-entry';

/** A day, in local time, as a comparable number. Null for anything not date-shaped. */
export function dayTime(value: string | null): number | null {
  const text = (value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return null;

  // Midnight local rather than the bare string, which JavaScript reads as UTC
  // and would place a cook on the previous day west of Greenwich.
  const date = new Date(`${text.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export interface LibraryStats {
  total: number;
  favorites: number;
  neverEaten: number;
  /** Meals whose last cook falls inside the activity range. */
  eatenRecently: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The earliest day still inside the activity range. */
export function rangeStart(rangeWeeks: number, now: Date = new Date()): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return midnight.getTime() - rangeWeeks * 7 * DAY_MS;
}

export function buildLibraryStats(
  entries: GalleryEntry[],
  rangeWeeks: number,
  now: Date = new Date()
): LibraryStats {
  const since = rangeStart(rangeWeeks, now);

  return {
    total: entries.length,
    favorites: entries.filter((entry) => entry.meta.favorite).length,
    neverEaten: entries.filter((entry) => neverEaten(entry.meta)).length,
    eatenRecently: entries.filter((entry) => {
      const made = dayTime(entry.meta.lastEaten);
      return made !== null && made >= since;
    }).length,
  };
}

/**
 * The most recently eaten meals, newest first.
 *
 * Meals with no cook date are left out rather than sorted to the end: this
 * answers "what have we been eating", and a meal nobody has ever made is
 * not an answer to it. The never-eaten ones have their own count above, and
 * the gallery has a filter for them.
 */
export function recentlyEaten(entries: GalleryEntry[], limit: number): GalleryEntry[] {
  return entries
    .map((entry) => ({ entry, made: dayTime(entry.meta.lastEaten) }))
    .filter((row): row is { entry: GalleryEntry; made: number } => row.made !== null)
    .sort((a, b) => b.made - a.made || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit)
    .map((row) => row.entry);
}

/** The newest additions to the library, by note creation time. */
export function recentlyAdded(entries: GalleryEntry[], limit: number): GalleryEntry[] {
  return [...entries]
    .sort((a, b) => b.createdAt - a.createdAt || a.title.localeCompare(b.title))
    .slice(0, limit);
}
