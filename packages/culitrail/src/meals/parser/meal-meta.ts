/**
 * Reads a meal's frontmatter into MealMeta.
 *
 * Every property name comes from settings. The alias lists below are
 * fallbacks *after* the configured name, never instead of it: a vault's own
 * naming always wins, and the aliases exist so that a meal imported from
 * elsewhere, or written before a setting was changed, still renders rather
 * than appearing blank.
 *
 * The aliases are also why `findValue()` skips empty values rather than
 * stopping at the first key that merely exists. A note carrying both
 * `servings:` (blank) and `yield: 4` should show 4.
 *
 * App-free.
 */
import {
  findValue,
  readBooleanLike,
  readIsoDate,
  readNumberLike,
  readString,
  readStringList,
} from '@technosoftware/trail-core';
import { readTags } from '@technosoftware/trail-core';
import type { CULItrailSettings } from '../../settings/types';
import { MealMeta, MealNutrition } from '../types';
import { lastEatingDate, readEatingHistoryProperty } from './eating-history';
import { readPer100g } from './per100g';

/** The meal fields whose frontmatter property name can vary between vaults. */
export type MealMetaField =
  | 'image'
  | 'servings'
  | 'prepTime'
  | 'reheatTime'
  | 'totalTime'
  | 'diet'
  | 'allergens'
  | 'favorite'
  | 'lastEaten'
  | 'eatenCount'
  | 'calories'
  | 'protein'
  | 'fat'
  | 'carbs'
  | 'price'
  | 'priceCurrency'
  | 'line';

/**
 * The property names a field is looked up under, configured name first.
 *
 * A mapped type rather than an interface on purpose: an interface has no
 * implicit index signature, so `Object.values()` over one degrades to `any[]`
 * and every use of the result becomes an unsafe-any lint error. The badge row
 * walks these groups to find which one a configured property belongs to.
 */
export type MealMetaAliases = Record<MealMetaField, string[]>;

function unique(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const trimmed = name?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function mealMetaAliases(settings: CULItrailSettings): MealMetaAliases {
  return {
    image: unique([
      settings.imageProperty,
      'image',
      'cover',
      'heroImage',
      'hero_image',
      'thumbnail',
    ]),
    // `yield` and `portions` come from imports; `serves` is how a person
    // writes it by hand.
    servings: unique([
      settings.servingsProperty,
      'servings',
      'serves',
      'serving',
      'yield',
      'portions',
    ]),
    prepTime: unique([
      settings.prepTimeProperty,
      'prepTime',
      'prep_time',
      'preparation_time',
      'prep',
    ]),
    reheatTime: unique([
      settings.reheatTimeProperty,
      'reheatTime',
      'cook_time',
      'eating_time',
      'cook',
    ]),
    // `total` earns its place: the importer's own note template writes the
    // field bare, mirroring `prep:` and `cook:`. Without it, a note using
    // that template shows a blank Total even while holding a real value, and
    // any save writes a second `totalTime:` key beside the orphaned one.
    totalTime: unique([settings.totalTimeProperty, 'totalTime', 'total_time', 'time', 'total']),
    diet: unique([settings.dietProperty, 'diet', 'diets', 'dietary']),
    priceCurrency: unique([settings.mealPriceCurrencyProperty, 'priceCurrency', 'currency']),
    line: unique([settings.mealLineProperty, 'line', 'range', 'productLine']),
    allergens: unique([settings.allergensProperty, 'allergens', 'allergen', 'allergies']),
    favorite: unique([settings.favoriteProperty, 'favorite', 'favourite', 'starred']),
    lastEaten: unique([settings.lastEatenProperty, 'lastEaten', 'last_eaten']),
    eatenCount: unique([
      settings.eatenCountProperty,
      'eatenCount',
      'eaten_count',
      'timesEaten',
      'times_eaten',
    ]),
    calories: unique([settings.caloriesProperty, 'calories', 'kcal', 'energy']),
    protein: unique([settings.proteinProperty, 'protein']),
    fat: unique([settings.fatProperty, 'fat']),
    carbs: unique([settings.carbsProperty, 'carbs', 'carbohydrates']),
    // `cost` because that is the other word for it, and both are what a person
    // reaches for when typing one by hand.
    price: unique([settings.priceProperty, 'price', 'cost']),
  };
}

function readNutrition(
  frontmatter: Record<string, unknown>,
  aliases: MealMetaAliases
): MealNutrition {
  return {
    calories: readNumberLike(findValue(frontmatter, ...aliases.calories)),
    protein: readNumberLike(findValue(frontmatter, ...aliases.protein)),
    fat: readNumberLike(findValue(frontmatter, ...aliases.fat)),
    carbs: readNumberLike(findValue(frontmatter, ...aliases.carbs)),
  };
}

export function readMealMeta(
  frontmatter: Record<string, unknown>,
  settings: CULItrailSettings,
  /**
   * The note's lines with the frontmatter off, for the one field that can live
   * in the body.
   *
   * Optional, and absent is not a degraded read: the gallery and the suggester
   * work off the metadata cache and have never opened the file, so a per-100 g
   * breakdown a note still keeps under its old headings is something they
   * genuinely cannot see. The meal view has the body and passes it, which is
   * what lets an unmigrated meal show its label.
   */
  body: string[] = []
): MealMeta {
  const aliases = mealMetaAliases(settings);

  // Read here rather than only in the view, because the gallery's
  // "never eaten" filter, the last-eaten sort and the dashboard's activity
  // count all key off last-made and times-eaten, and all three read
  // frontmatter alone. A vault whose log lives in the body still needs an
  // explicit lastEaten: for those; the meal view merges the body's log in
  // because it is the one caller that has the body.
  const eatingHistory = settings.eatingHistoryEnabled
    ? readEatingHistoryProperty(frontmatter[settings.eatingHistoryFrontmatterProperty])
    : [];

  return {
    image: readString(findValue(frontmatter, ...aliases.image)),
    servings: readNumberLike(findValue(frontmatter, ...aliases.servings)),
    prepTime: readNumberLike(findValue(frontmatter, ...aliases.prepTime)),
    reheatTime: readNumberLike(findValue(frontmatter, ...aliases.reheatTime)),
    totalTime: readNumberLike(findValue(frontmatter, ...aliases.totalTime)),
    diet: readStringList(findValue(frontmatter, ...aliases.diet)),
    allergens: readStringList(findValue(frontmatter, ...aliases.allergens)),
    tags: readTags(frontmatter.tags),
    // `?? false` rather than leaving it nullable: a meal is either a
    // favorite or it is not, and there is no third state a view would render
    // differently.
    favorite: readBooleanLike(findValue(frontmatter, ...aliases.favorite)) ?? false,
    eatingHistory,
    // Date-only on purpose. A cook has a day, not a clock time, and reading
    // it as a datetime would carry a spurious 00:00 into every display.
    //
    // Both fall back to the log, and an explicit property always wins. That
    // is the general rule: derive at read time, never write the derived value
    // back. `|| null` on the count because a log of zero entries is no
    // information, not a meal eaten zero times.
    lastEaten:
      readIsoDate(findValue(frontmatter, ...aliases.lastEaten)) ?? lastEatingDate(eatingHistory),
    eatenCount:
      readNumberLike(findValue(frontmatter, ...aliases.eatenCount)) ??
      (eatingHistory.length || null),
    source: readString(frontmatter.source),
    nutrition: readNutrition(frontmatter, aliases),
    // Frontmatter first, then the two retired body sections, through the one
    // reader the editor also uses. Sharing it is what keeps the view and the
    // editor from disagreeing about what a half-migrated note says.
    per100g: readPer100g(frontmatter, settings, body).per100g,
    // Not multiplied by servings. This is what
    // one portion of the dish costs as sold, which does not change because
    // somebody is reading the meal at double quantity.
    price: readNumberLike(findValue(frontmatter, ...aliases.price)),
    priceCurrency: readString(findValue(frontmatter, ...aliases.priceCurrency)),
    line: readString(findValue(frontmatter, ...aliases.line)),
  };
}

/**
 * Total time: what the note says, or prep plus cook.
 *
 * Derived at read time and never written back. Writing it would mean editing
 * a note as a side effect of reading it, and the stored value would go stale
 * the moment either component changed. An explicit value in the note always
 * wins, because somebody who wrote one meant it: a meal that rests
 * overnight has a total far larger than prep plus cook.
 */
export function effectiveTotalTime(meta: MealMeta): number | null {
  if (meta.totalTime !== null) return meta.totalTime;
  if (meta.prepTime === null && meta.reheatTime === null) return null;
  return (meta.prepTime ?? 0) + (meta.reheatTime ?? 0);
}
