/**
 * Placing a batch of meals across a week.
 *
 * For the "schedule these meals" flow, where somebody picks several meals
 * at once and wants them spread over the days rather than dropped one by one.
 *
 * The whole thing works against a snapshot that it updates as it places, so
 * the second meal in a batch sees the first one already there. Asking the
 * plugin's state between placements instead would make the result depend on
 * how fast the saves came back.
 *
 * App-free.
 */
import { WEEKDAY_KEYS, type MealSlotKey, type WeekdayKey } from '../../lang/vocabulary';
import type { MealPlanEntry } from '../../settings/types';

/**
 * How full a day has to be before it is skipped.
 *
 * - `skip-occupied`: one meal per day, whatever slot it is in.
 * - `one-per-slot`: one breakfast, one lunch, one dinner, one snack per day.
 * - `stack-freely`: no occupancy at all; days are dealt round-robin.
 * - `queue-only`: nothing is dated. Everything goes to the queue.
 */
export type FillMode = 'skip-occupied' | 'one-per-slot' | 'stack-freely' | 'queue-only';

export interface ScheduleOptions {
  mode: FillMode;
  slot?: MealSlotKey;
  /** Where a meal goes when no day is free. False drops it rather than queueing it. */
  overflowToQueue: boolean;
}

/** One placement decision. Nothing is written here; the caller turns these into entries. */
export interface Placement {
  mealPath: string;
  /** The weekday key, or null for the queue. */
  day: WeekdayKey | null;
  slot?: MealSlotKey;
}

/** True when a day can still take another meal under this mode. */
export function isDayAvailable(
  day: WeekdayKey,
  slot: MealSlotKey | undefined,
  mode: FillMode,
  plan: Array<Pick<MealPlanEntry, 'day' | 'meal'>>
): boolean {
  const onDay = plan.filter((entry) => entry.day === day);

  if (mode === 'skip-occupied') return onDay.length === 0;

  if (mode === 'one-per-slot') {
    // With no slot chosen there is nothing to distinguish meals by, so this
    // degrades to one per day rather than silently stacking them.
    if (!slot) return onDay.length === 0;
    return !onDay.some((entry) => entry.meal === slot);
  }

  // Stack-freely and queue-only have no occupancy concept. Kept total so the
  // function answers for every mode rather than falling off the end.
  return true;
}

function firstFreeDay(
  slot: MealSlotKey | undefined,
  mode: FillMode,
  plan: Array<Pick<MealPlanEntry, 'day' | 'meal'>>
): WeekdayKey | null {
  return WEEKDAY_KEYS.find((day) => isDayAvailable(day, slot, mode, plan)) ?? null;
}

/**
 * Decides where each meal goes.
 *
 * Returns placements rather than writing anything, so the caller owns note
 * writing and state, and so the algorithm can be tested by reading its
 * answer.
 */
export function planSchedule(
  mealPaths: string[],
  existing: Array<Pick<MealPlanEntry, 'day' | 'meal'>>,
  options: ScheduleOptions
): Placement[] {
  const snapshot = [...existing];
  const placements: Placement[] = [];
  let dealt = 0;

  for (const mealPath of mealPaths) {
    if (options.mode === 'queue-only') {
      // Distinct from the overflow path below: this mode still honours the
      // chosen slot, because it was chosen deliberately rather than reached
      // by running out of days.
      placements.push({ mealPath, day: null, slot: options.slot });
      continue;
    }

    const day =
      options.mode === 'stack-freely'
        ? WEEKDAY_KEYS[dealt++ % WEEKDAY_KEYS.length]
        : firstFreeDay(options.slot, options.mode, snapshot);

    if (day) {
      placements.push({ mealPath, day, slot: options.slot });
      snapshot.push({ day, meal: options.slot });
      continue;
    }

    // No day left. An overflow goes to the queue with no slot: it did not get
    // the placement that was asked for, and claiming a slot for it would
    // overstate what happened.
    if (options.overflowToQueue) placements.push({ mealPath, day: null });
  }

  return placements;
}
