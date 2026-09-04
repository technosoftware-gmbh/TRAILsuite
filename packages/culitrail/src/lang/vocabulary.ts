/**
 * The fixed vocabularies CULItrail writes into notes, and their display
 * labels.
 *
 * Every one of these follows the same rule: **the key is stable and English,
 * the label is translated.** A weekday is written into a meal-plan note as
 * `## Tuesday`, in every locale, while the grid shows `Dienstag`.
 *
 * That split is not decoration. These strings are already in users' vaults,
 * so translating what gets written would orphan every note that exists and,
 * for weekdays, would also break ordering: the sort matches this list, and a
 * translated heading would fall into the unknown-day bucket. It is the same
 * argument that keeps a `type:` value a stable value with a configurable
 * name, applied to note structure rather than frontmatter.
 *
 * The other direction is worth naming too: these are property *values*, not
 * property names, so unlike everything in settings/types.ts they are NOT
 * configurable. A vault cannot rename Tuesday.
 *
 * The nutrient ids at the bottom follow the same rule and break one: the id is
 * stable and English and the label is translated, but the vocabulary is open,
 * because a label can declare something no table here anticipated.
 */
import { isKnownNutrientId } from 'trail-core';
import { t } from './I18nManager';

/**
 * Weekday keys, in week order.
 *
 * The order is the sort order for meal-plan sections, so it is Monday-first
 * rather than Sunday-first. That matches ISO week numbering, which the whole
 * planning area is already keyed on, rather than a locale preference.
 */
export const WEEKDAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** The four meal slots. How a slot is written into a note is configurable (`mealSlotNotation`); which four exist is not. */
export const MEAL_SLOT_KEYS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export type MealSlotKey = (typeof MEAL_SLOT_KEYS)[number];

function isWeekdayKey(value: string): value is WeekdayKey {
  return (WEEKDAY_KEYS as readonly string[]).includes(value);
}

function isMealSlotKey(value: string): value is MealSlotKey {
  return (MEAL_SLOT_KEYS as readonly string[]).includes(value);
}

/**
 * Normalizes whatever a note's `##` heading actually said into a weekday key,
 * or null when it is not a weekday at all.
 *
 * Case-insensitive, because a note may have been hand-edited to `## tuesday`.
 * Deliberately does NOT accept translated names: a German note saying
 * `## Dienstag` was not written by this plugin, and silently adopting it
 * would mean two spellings of Tuesday coexisting in one vault, only one of
 * which the writer would ever produce again.
 */
export function parseWeekdayKey(value: string | undefined): WeekdayKey | null {
  const normalized = (value ?? '').trim().toLowerCase();
  return isWeekdayKey(normalized) ? normalized : null;
}

export function parseMealSlotKey(value: string | undefined): MealSlotKey | null {
  const normalized = (value ?? '').trim().toLowerCase();
  return isMealSlotKey(normalized) ? normalized : null;
}

/**
 * Sort position for a weekday section, with unknown headings last.
 *
 * A note can legitimately carry a `##` section that is not a weekday, either
 * because a user added one or because a future version did. Those sort to the
 * end rather than being dropped, so nothing a person wrote disappears.
 */
export function weekdayRank(value: string | undefined): number {
  const key = parseWeekdayKey(value);
  return key ? WEEKDAY_KEYS.indexOf(key) : WEEKDAY_KEYS.length;
}

/** The heading form written into a meal-plan note: the stable key, title-cased. Never translated. */
export function weekdayHeading(key: WeekdayKey): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function weekdayLabel(key: string): string {
  return t(`vocabulary.weekdays.${key}`);
}

export function mealSlotLabel(key: string): string {
  return t(`vocabulary.mealSlots.${key}`);
}

/**
 * A nutrient id as a word somebody reads.
 *
 * The same key-versus-label split as the weekdays above, with one difference
 * that matters: this vocabulary is open. A note may name a nutrient no table
 * here knows, and such a name comes back exactly as it was written rather than
 * replaced by anything. Losing it would mean the form dropping a row somebody
 * typed, which is the whole reason the figures became a list.
 *
 * Not `trail-core`'s `nutrientLabel()`, which looks similar and answers a
 * different question. That one is a **matching** table: it holds the spellings
 * notes already carry, both languages are consulted together whatever the
 * locale, and it has to keep saying `Saturated Fat` because that is what a note
 * says. This is display wording, chosen by locale, and free to read
 * `of which saturates` the way a packet prints it.
 */
export function nutrientDisplayName(id: string): string {
  return isKnownNutrientId(id) ? t(`meals.nutrients.${id}`) : id;
}
