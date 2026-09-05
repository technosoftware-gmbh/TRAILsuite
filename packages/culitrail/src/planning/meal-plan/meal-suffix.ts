/**
 * Reading what a pre-frontmatter plan line said after the meal.
 *
 * **Read only.** A plan entry is frontmatter now, so nothing writes a `#tag`, a
 * `[rating:: 4]` or a `<!--culi-id:…-->` any more. What is left here is the
 * half that reads them, kept for the notes a vault has not converted yet and
 * for the converter itself.
 *
 * The slot had three notations because vaults differ about what a property
 * looks like: a tag, a Dataview inline field, or plain parentheses. All three
 * are accepted, whatever the note happens to use, since there is no longer a
 * setting saying which one to expect.
 *
 * App-free.
 */
import { hasLeftoversTag, LEFTOVERS_TAG, stripLeftoversTag } from '@technosoftware/trail-core';
import { MEAL_SLOT_KEYS, parseMealSlotKey, type MealSlotKey } from '../../lang/vocabulary';
import type { CULItrailSettings } from '../../settings/types';

/**
 * The leftovers mark is `trail-core`'s now, tag and boundary both.
 *
 * The boundary is the part worth moving rather than the string: `#leftovers\b`
 * matches inside `#leftovers-friday`, because `-` is not a word character, so
 * somebody's own tag was read as this mark. One rule in one place is the only
 * way a reader and a writer of the same line agree about it.
 */
export { LEFTOVERS_TAG };

const RATING = /\[rating::\s*([1-5])\]/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The configured field name, or the default. Never blank, since a blank name makes every notation unreadable. */
function fieldName(settings: CULItrailSettings): string {
  return settings.mealSlotFieldName.trim() || 'meal';
}

export interface LineSuffix {
  meal: MealSlotKey | null;
  rating: number | null;
  isLeftovers: boolean;
}

/**
 * Reads everything that can trail a meal-plan line.
 *
 * The order matters: rating and the leftovers tag are taken out first, so
 * neither can be mistaken for a meal slot written in one of the other two
 * notations.
 */
export function readLineSuffix(suffix: string, settings: CULItrailSettings): LineSuffix {
  const rating = RATING.exec(suffix);
  const isLeftovers = hasLeftoversTag(suffix);

  const remainder = stripLeftoversTag(suffix.replace(RATING, '')).trim();

  return {
    meal: readMealSlot(remainder, fieldName(settings)),
    rating: rating ? Number(rating[1]) : null,
    isLeftovers,
  };
}

/**
 * Finds a meal slot in whichever notation the line happens to use.
 *
 * A value that is not one of the four slots yields null rather than being
 * kept as free text. The four are a fixed vocabulary that the grid columns
 * and the grocery attribution both key off, and a fifth value invented by a
 * hand-edit would have nowhere to appear.
 */
function readMealSlot(text: string, field: string): MealSlotKey | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const escaped = escapeRegExp(field);
  const candidates = [
    new RegExp(`#${escaped}/([\\w-]+)`, 'i'), // tag
    new RegExp(`\\[${escaped}::\\s*([^\\]]+)\\]`, 'i'), // Dataview field
    /\(([^)]+)\)\s*$/, // parenthetical
  ];

  for (const pattern of candidates) {
    const match = pattern.exec(trimmed);
    const slot = match ? parseMealSlotKey(match[1]) : null;
    if (slot) return slot;
  }

  return null;
}

/** One `[field:: …]` value, or null. */
function readField(text: string, field: string): string | null {
  const value = new RegExp(`\\[${field}::\\s*([^\\]]*)\\]`, 'i').exec(text)?.[1]?.trim();
  return value ? value : null;
}

/** What an eater wrote onto a line: the clock time, the remark, and the id marker. */
export function readEatingFields(suffix: string): {
  time: string | null;
  note: string | null;
  id: string | null;
} {
  const time = readField(suffix, 'time');

  return {
    // Validated rather than taken as written: a hand-typed `25:00` is not a
    // clock time, and a view that rendered it would be repeating a typo.
    time: time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : null,
    note: readField(suffix, 'note'),
    id: /<!--\s*(?:culi|cul|rb)-id:([^\s>]+?)\s*-->/.exec(suffix)?.[1] ?? null,
  };
}

/** The slots in the order the grid shows them. Re-exported so callers do not reach past this module for it. */
export const MEAL_SLOTS = MEAL_SLOT_KEYS;
