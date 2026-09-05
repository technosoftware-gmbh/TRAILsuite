/**
 * Recording a meal eaten where the plan can see it.
 *
 * Eating history used to live on the meal note, as a property and a
 * `## Eating History` section, and the meal plans held the same events again.
 * The August 2026 migration made the plan note the single store and took both
 * copies off the meals. What it could not do is stop them coming back: marking
 * a meal eaten still wrote only the meal, so every meal recorded in Obsidian
 * was invisible to anything reading the plans.
 *
 * This is the other half. Eating a meal ends in an eaten plan entry, which is
 * the store everything else already agrees on.
 *
 * **A planned meal is marked rather than added to.** If the week already has
 * this meal on that day and not eaten, that entry *is* the one being recorded;
 * writing a second would turn one dinner into two. An entry already marked is
 * left alone and a new one written beside it, because eating the same thing
 * twice in a day is a thing people do and this is not the place to decide it
 * was a mistake.
 *
 * Note only. State is a mirror of the notes and the next sync rebuilds it,
 * which is the order every other writer here uses.
 */
import { App } from 'obsidian';
import { formatWeekTitle, parseDayTitle } from '@technosoftware/trail-core';
import { WEEKDAY_KEYS, type WeekdayKey } from '../../lang/vocabulary';
import type { CULItrailSettings } from '../../settings/types';
import { mealPlanNotePath } from './note-path';
import { emptyPlanEntry, type PlanEntryContent } from './plan-note';
import { editPlanNote } from './write-plan';

/** One meal eaten, in the terms a plan note is written in. */
export interface EatingOnPlan {
  /** The meal note's title, which is what the wikilink resolves against. */
  mealTitle: string;
  /** `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`. The clock half becomes the entry's `time`. */
  date: string;
  /** The Person note title. Empty for a vault with no People configured. */
  person: string;
  /**
   * 0 to 5, or absent.
   *
   * Zero used to need saying, because a line had one notation for both "eaten"
   * and "eaten, unrated" and the vault carried 32 lines writing `[rating:: 0]`
   * to mean the second. An entry states `eaten` outright now, so a zero is
   * simply no rating and the special case is gone.
   */
  rating?: number;
  note?: string;
  /** The entry's stable id. An ordinary field now rather than an HTML comment. */
  id?: string;
}

export interface EatingOnPlanResult {
  path: string;
  /** True when an already-planned entry was marked rather than a new one added. */
  ticked: boolean;
}

/** The `HH:mm` half of a datetime, or null when it carries only a day. */
function clockOf(date: string): string | null {
  return /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/.exec(date)?.[1] ?? null;
}

/** The Person title inside a `[[link]]`, alias and all removed. */
export function personTitleOf(link: string | undefined): string {
  if (!link) return '';
  return (
    link
      .replace(/^\[\[|\]\]$/g, '')
      .split('|')[0]
      ?.split('#')[0]
      ?.trim() ?? ''
  );
}

/**
 * The planned-but-not-eaten entry this belongs to, if the week planned it.
 *
 * Not-eaten only. An entry already marked is one that has been recorded, and
 * overwriting it would replace one meal's rating with another's.
 */
function plannedEntry(
  entries: readonly PlanEntryContent[],
  mealTitle: string,
  day: WeekdayKey
): PlanEntryContent | null {
  const wanted = mealTitle.trim().toLowerCase();
  return (
    entries.find(
      (entry) =>
        !entry.eaten && entry.day === day && (entry.mealTitle ?? '').trim().toLowerCase() === wanted
    ) ?? null
  );
}

/** What a week's entries become once this meal has been recorded as eaten. */
export interface EatenApplied {
  entries: PlanEntryContent[];
  /** True when an entry the week already planned was marked rather than a new one added. */
  ticked: boolean;
}

/**
 * Marks a planned entry eaten, or adds one that was never planned.
 *
 * The pure half, so the rule that matters is testable without a vault: the
 * difference between one dinner and two.
 */
export function applyEaten(
  entries: readonly PlanEntryContent[],
  eaten: EatingOnPlan,
  day: WeekdayKey
): EatenApplied {
  const rating = eaten.rating && eaten.rating >= 1 && eaten.rating <= 5 ? eaten.rating : null;
  const fields = {
    eaten: true,
    rating,
    time: clockOf(eaten.date),
    note: eaten.note?.trim() || null,
  };

  const existing = plannedEntry(entries, eaten.mealTitle, day);
  if (existing) {
    return {
      ticked: true,
      entries: entries.map((entry) =>
        entry === existing
          ? // The id the entry already has is kept: an id is an identity, and
            // replacing it would make this a different meal from the one the
            // week planned.
            { ...entry, ...fields, id: entry.id || eaten.id || '' }
          : entry
      ),
    };
  }

  return {
    ticked: false,
    entries: [
      ...entries,
      { ...emptyPlanEntry(eaten.id ?? ''), mealTitle: eaten.mealTitle, day, ...fields },
    ],
  };
}

/**
 * Writes one eaten meal into the person's plan note for that week.
 *
 * Returns null when the date cannot be read or the settings give no path for
 * that person. The meal's own log has already been written by then, so a
 * failure here is a plan entry missing, not a meal lost.
 */
export async function recordEatingInPlan(
  app: App,
  settings: CULItrailSettings,
  eaten: EatingOnPlan
): Promise<EatingOnPlanResult | null> {
  const date = parseDayTitle(eaten.date.slice(0, 10));
  if (!date) return null;

  const week = formatWeekTitle(date);
  const path = mealPlanNotePath(settings, week, eaten.person);
  if (!path) return null;

  // Monday-first, matching WEEKDAY_KEYS and the ISO week the paths are keyed on.
  const day = WEEKDAY_KEYS[(date.getDay() + 6) % 7];

  let ticked = false;

  const written = await editPlanNote(
    app,
    settings,
    path,
    { week, personTitle: eaten.person || null },
    (entries) => {
      const applied = applyEaten(entries, eaten, day);
      ticked = applied.ticked;
      return applied.entries;
    }
  );

  return written ? { path, ticked } : null;
}
