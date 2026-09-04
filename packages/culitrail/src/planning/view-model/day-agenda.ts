/**
 * One day out of a week's plan, in the order the day is eaten.
 *
 * The meal-plan view shows a week and this shows a day, which is a different
 * question with a different answer: a dashboard asks "what is happening
 * today", and the week grid is the wrong shape for that.
 *
 * App-free.
 */
import { MEAL_SLOT_KEYS, WEEKDAY_KEYS, type WeekdayKey } from '../../lang/vocabulary';
import type { MealPlanEntry } from '../../settings/types';
import { entriesInScope, type EntryScope } from '../meal-plan/entries';

/**
 * Which weekday key a date falls on.
 *
 * Built off `WEEKDAY_KEYS`, which is Monday-first because the whole planning
 * area is keyed on ISO weeks, while `getDay()` is Sunday-first. Hence the
 * shift rather than a direct index.
 */
export function weekdayKeyOf(date: Date = new Date()): WeekdayKey {
  return WEEKDAY_KEYS[(date.getDay() + 6) % 7];
}

/**
 * Sort position for a meal slot, with anything unrecognised last.
 *
 * An entry can carry no slot at all: the meal-plan view lets a meal be
 * dropped on a day without choosing breakfast or dinner. Those sort after the
 * four known slots rather than being dropped, because a plan that hides part
 * of itself is worse than one that is loosely ordered.
 */
export function mealRank(meal: string | undefined): number {
  const index = (MEAL_SLOT_KEYS as readonly string[]).indexOf((meal ?? '').trim().toLowerCase());
  return index === -1 ? MEAL_SLOT_KEYS.length : index;
}

export interface DayScope extends EntryScope {
  day: WeekdayKey;
}

/** Everything planned for one person on one day, breakfast first. */
export function agendaForDay(entries: MealPlanEntry[], scope: DayScope): MealPlanEntry[] {
  return entriesInScope(entries, scope)
    .filter((entry) => entry.day === scope.day)
    .sort((a, b) => mealRank(a.meal) - mealRank(b.meal));
}

/**
 * How many meals are planned on each day of a week, in week order.
 *
 * The queue is deliberately not counted: an entry with no day is something
 * somebody wants to cook, not something they have committed to a day, and
 * folding the two together would make an empty week look full.
 */
export function mealsPerDay(entries: MealPlanEntry[], scope: EntryScope): Map<WeekdayKey, number> {
  const counts = new Map<WeekdayKey, number>(WEEKDAY_KEYS.map((key) => [key, 0]));

  for (const entry of entriesInScope(entries, scope)) {
    const day = entry.day as WeekdayKey | undefined;
    if (day !== undefined && counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  return counts;
}
