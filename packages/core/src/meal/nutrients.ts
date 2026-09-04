/**
 * What a nutrition label can name, as ids a note can be written in.
 *
 * A meal's figures used to be eight fixed fields, which is a statement about a
 * form rather than about food: a label that also declares fibre, or iron, had
 * nowhere to put it, and the note lost what its owner had in front of them. So
 * the model became a list, and a list needs a vocabulary. This is that
 * vocabulary: an id per nutrient, in `camelCase`, language-free, with the
 * English and German label tables kept beside it.
 *
 * **Both label tables are consulted together, never selected by locale.** Same
 * reasoning as `reheating/appliances.ts`, and it is the reason worth repeating:
 * a vault that switches language must not stop recognising what it has already
 * written, and a household that shares one vault writes both languages into it.
 * A locale picks the word shown on a screen; it never picks the word a file is
 * read with.
 *
 * **A name that matches nothing is not dropped.** A nutrient somebody typed is
 * their data. All an unmatched name loses is its place in the declaration order
 * and its default unit, and it keeps the spelling it arrived with, so a vault
 * that tracks something this table has never heard of stays readable by the
 * people who write it.
 *
 * **Energy is not in here.** Calories and kilojoules are not nutrients, they are
 * what the nutrients add up to, and the model carries them as two named scalars
 * (`caloriesPer100g` / `kjPer100g`) so nothing has to ask whether the `calories`
 * row in a list is the per-100 g one or the per-serving one. `matchNutrient`
 * therefore reports `Calories` and `Energy` as unknown, which is correct rather
 * than unfortunate: a list is the wrong place for them.
 *
 * **Which nutrients are known, and why these.** The macronutrients are the six
 * a declaration carries under Regulation (EU) 1169/2011 Annex XV, in that
 * regulation's order, minus energy. The micronutrients are salt, which the same
 * Annex makes mandatory, then sodium, then the full list of vitamins and
 * minerals that Annex XIII permits a label to declare at all. Annex XIII is used
 * rather than a hand-picked shortlist because it is a closed, citable set: it
 * answers "why is manganese in here and not taurine" with a reference instead of
 * a preference, and the cost of an id nobody uses is one row of a table, while
 * the cost of a missing one is a nutrient that sorts to the end of a label.
 *
 * **Salt and sodium are two ids, and neither is an alias of the other.** They
 * are different quantities off the same label, related by a factor this package
 * never applies, because guessing which one a note meant and multiplying by 2.5
 * would silently rewrite somebody's data. The old body sections labelled a salt
 * figure `Sodium`, and correcting that is the legacy reader's job in
 * `nutrition.ts`, where the mistake is known to be a mistake. Read plainly, in
 * any other context, `Sodium` means sodium.
 */

/** The macronutrients a declaration carries, in Regulation (EU) 1169/2011 order. */
export const MACRONUTRIENT_IDS = [
  'fat',
  'saturatedFat',
  'carbs',
  'sugar',
  'fibre',
  'protein',
] as const;

/**
 * Salt first, then sodium, then Annex XIII's minerals and vitamins.
 *
 * Salt leads because it is the one micronutrient a label must state, so it is
 * the one a reader looks for. The Annex's own order is vitamins before minerals;
 * that is inverted here because a food label states minerals far more often, and
 * the order exists to put the rows somebody actually has near the top.
 */
export const MICRONUTRIENT_IDS = [
  'salt',
  'sodium',
  'potassium',
  'chloride',
  'calcium',
  'phosphorus',
  'magnesium',
  'iron',
  'zinc',
  'copper',
  'manganese',
  'fluoride',
  'selenium',
  'chromium',
  'molybdenum',
  'iodine',
  'vitaminA',
  'vitaminD',
  'vitaminE',
  'vitaminK',
  'vitaminC',
  'thiamin',
  'riboflavin',
  'niacin',
  'vitaminB6',
  'folicAcid',
  'vitaminB12',
  'biotin',
  'pantothenicAcid',
] as const;

export type MacronutrientId = (typeof MACRONUTRIENT_IDS)[number];
export type MicronutrientId = (typeof MICRONUTRIENT_IDS)[number];
export type KnownNutrientId = MacronutrientId | MicronutrientId;

/**
 * One row of a nutrient list, whether or not the table below knows the name.
 *
 * The three fields answer three different questions and none of them can be
 * derived from the others: what it is, what it is measured in, and how much.
 */
export interface NutrientEntry {
  /** A stable id when the nutrient is known, otherwise the name exactly as the note wrote it. */
  name: string;
  /** The unit as written: 'g', 'mg', 'µg', or whatever a vault used. */
  unit: string;
  /** Null when the note states the nutrient but not a figure. */
  value: number | null;
}

interface KnownNutrient {
  labelEn: string;
  labelDe: string;
  /**
   * The unit an editor offers when this row is added.
   *
   * A default, never an override: what a note already wrote is what that note
   * means, even when it disagrees with the convention here, because a figure and
   * a unit that did not arrive together are a figure nobody can trust.
   */
  unit: string;
  /**
   * Spellings beyond the two labels, in either language.
   *
   * Three kinds live here and they are worth telling apart. The old body-section
   * labels (`Protein (g)`, `Fat (g)`, `Carbohydrates (g)`), because notes in the
   * vault carry them today. The declaration wording an imported label keeps
   * (`of which sugars`, `davon Zucker`), because that is how a package prints
   * it. And the other honest name for the same substance (`Fiber`, `Vitamin B1`,
   * `Folate`), because two people writing the same row disagree about those and
   * neither of them is wrong.
   */
  aliases?: readonly string[];
}

/**
 * The table. Ids on the left are the note format's; everything to the right of
 * them is how a human wrote it.
 *
 * The German column is not a translation for display. A consumer that shows a
 * nutrient name looks it up in its own locale files, the way CULItrail's
 * settings layer does; these are text that notes already carry, and matching
 * against them is reading a file rather than translating one.
 */
const KNOWN_NUTRIENTS: Record<KnownNutrientId, KnownNutrient> = {
  // Macronutrients. All in grams, which is the only unit a declaration uses for
  // them, so no note should ever need to disagree.
  fat: { labelEn: 'Fat', labelDe: 'Fett', unit: 'g', aliases: ['Fat (g)', 'Fett (g)'] },
  saturatedFat: {
    labelEn: 'Saturated Fat',
    labelDe: 'Gesättigte Fettsäuren',
    unit: 'g',
    aliases: [
      'Saturates',
      'Saturated Fatty Acids',
      'of which saturates',
      'of which saturated fat',
      'davon gesättigte Fettsäuren',
      'Gesaettigte Fettsaeuren',
    ],
  },
  carbs: {
    labelEn: 'Carbohydrates',
    labelDe: 'Kohlenhydrate',
    unit: 'g',
    aliases: ['Carbohydrates (g)', 'Carbs', 'Carbohydrate', 'Kohlenhydrate (g)'],
  },
  sugar: {
    labelEn: 'Sugar',
    labelDe: 'Zucker',
    unit: 'g',
    aliases: ['Sugars', 'of which sugars', 'davon Zucker'],
  },
  fibre: {
    labelEn: 'Fibre',
    labelDe: 'Ballaststoffe',
    unit: 'g',
    aliases: ['Fiber', 'Dietary Fibre', 'Dietary Fiber'],
  },
  protein: {
    labelEn: 'Protein',
    labelDe: 'Eiweiss',
    unit: 'g',
    aliases: ['Protein (g)', 'Eiweiß', 'Eiweiss (g)', 'Proteine'],
  },

  // Micronutrients.
  salt: { labelEn: 'Salt', labelDe: 'Salz', unit: 'g', aliases: ['Salt equivalent', 'Kochsalz'] },
  sodium: { labelEn: 'Sodium', labelDe: 'Natrium', unit: 'mg' },
  potassium: { labelEn: 'Potassium', labelDe: 'Kalium', unit: 'mg' },
  chloride: { labelEn: 'Chloride', labelDe: 'Chlorid', unit: 'mg' },
  calcium: { labelEn: 'Calcium', labelDe: 'Calcium', unit: 'mg', aliases: ['Kalzium'] },
  phosphorus: { labelEn: 'Phosphorus', labelDe: 'Phosphor', unit: 'mg' },
  magnesium: { labelEn: 'Magnesium', labelDe: 'Magnesium', unit: 'mg' },
  iron: { labelEn: 'Iron', labelDe: 'Eisen', unit: 'mg' },
  zinc: { labelEn: 'Zinc', labelDe: 'Zink', unit: 'mg' },
  copper: { labelEn: 'Copper', labelDe: 'Kupfer', unit: 'mg' },
  manganese: { labelEn: 'Manganese', labelDe: 'Mangan', unit: 'mg' },
  fluoride: { labelEn: 'Fluoride', labelDe: 'Fluorid', unit: 'mg' },
  selenium: { labelEn: 'Selenium', labelDe: 'Selen', unit: 'µg' },
  chromium: { labelEn: 'Chromium', labelDe: 'Chrom', unit: 'µg' },
  molybdenum: { labelEn: 'Molybdenum', labelDe: 'Molybdän', unit: 'µg' },
  iodine: { labelEn: 'Iodine', labelDe: 'Jod', unit: 'µg', aliases: ['Iod'] },
  vitaminA: { labelEn: 'Vitamin A', labelDe: 'Vitamin A', unit: 'µg', aliases: ['Retinol'] },
  vitaminD: { labelEn: 'Vitamin D', labelDe: 'Vitamin D', unit: 'µg' },
  vitaminE: { labelEn: 'Vitamin E', labelDe: 'Vitamin E', unit: 'mg' },
  vitaminK: { labelEn: 'Vitamin K', labelDe: 'Vitamin K', unit: 'µg' },
  vitaminC: {
    labelEn: 'Vitamin C',
    labelDe: 'Vitamin C',
    unit: 'mg',
    aliases: ['Ascorbic Acid', 'Ascorbinsäure'],
  },
  thiamin: {
    labelEn: 'Thiamin',
    labelDe: 'Thiamin',
    unit: 'mg',
    aliases: ['Vitamin B1', 'Thiamine'],
  },
  riboflavin: { labelEn: 'Riboflavin', labelDe: 'Riboflavin', unit: 'mg', aliases: ['Vitamin B2'] },
  niacin: { labelEn: 'Niacin', labelDe: 'Niacin', unit: 'mg', aliases: ['Vitamin B3'] },
  vitaminB6: { labelEn: 'Vitamin B6', labelDe: 'Vitamin B6', unit: 'mg', aliases: ['Pyridoxin'] },
  folicAcid: {
    labelEn: 'Folic Acid',
    labelDe: 'Folsäure',
    unit: 'µg',
    aliases: ['Folate', 'Folat', 'Vitamin B9', 'Folsaeure'],
  },
  vitaminB12: {
    labelEn: 'Vitamin B12',
    labelDe: 'Vitamin B12',
    unit: 'µg',
    aliases: ['Cobalamin'],
  },
  biotin: { labelEn: 'Biotin', labelDe: 'Biotin', unit: 'µg', aliases: ['Vitamin B7'] },
  pantothenicAcid: {
    labelEn: 'Pantothenic Acid',
    labelDe: 'Pantothensäure',
    unit: 'mg',
    aliases: ['Vitamin B5', 'Pantothensaeure'],
  },
};

/** Every known id in declaration order: the macros, then the micros. */
export const NUTRIENT_ORDER: readonly KnownNutrientId[] = [
  ...MACRONUTRIENT_IDS,
  ...MICRONUTRIENT_IDS,
];

/**
 * Trimmed, lowercased, internal whitespace collapsed, a trailing colon dropped.
 *
 * The colon is here because callers hand this function text pulled off a
 * `- **Sugar:** 2.9g` line, and whether the split kept the colon is an accident
 * of which caller it was rather than a thing a note meant.
 */
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/:$/, '').trim().toLowerCase();
}

/**
 * Every spelling of every known nutrient, in one map, built once.
 *
 * First registration wins, so an id earlier in `NUTRIENT_ORDER` keeps a name two
 * of them could claim. Nothing in the table above collides today; the rule is
 * written down so that adding a row cannot quietly change what an existing name
 * resolves to.
 */
const BY_NAME: Map<string, KnownNutrientId> = (() => {
  const map = new Map<string, KnownNutrientId>();
  for (const id of NUTRIENT_ORDER) {
    const known = KNOWN_NUTRIENTS[id];
    const names = [id, known.labelEn, known.labelDe, ...(known.aliases ?? [])];
    for (const name of names) {
      const key = normalize(name);
      if (key !== '' && !map.has(key)) map.set(key, id);
    }
  }
  return map;
})();

export interface NutrientMatch {
  /** The known id, or the name as typed when nothing matched. */
  id: string;
  /** The English label when known, otherwise the name as typed. */
  label: string;
  known: boolean;
}

/**
 * The nutrient a name refers to.
 *
 * Case-insensitive and whitespace-tolerant, across both label tables and every
 * alias, because the names being matched were typed by people rather than
 * chosen from a list.
 *
 * The label it returns is the English one, which is not a display decision: this
 * package holds no user-facing strings, and a consumer with locale files looks
 * the id up in those. It is here so a caller that has none still has a word.
 */
export function matchNutrient(name: string): NutrientMatch {
  const typed = name.trim();
  const id = BY_NAME.get(normalize(typed));
  if (id === undefined) return { id: typed, label: typed, known: false };

  return { id, label: KNOWN_NUTRIENTS[id].labelEn, known: true };
}

/** The English label for an id, or the id itself when nothing here knows it. */
export function nutrientLabel(id: string): string {
  return isKnownNutrientId(id) ? KNOWN_NUTRIENTS[id].labelEn : id;
}

/** The German label for an id, or the id itself when nothing here knows it. */
export function nutrientLabelDe(id: string): string {
  return isKnownNutrientId(id) ? KNOWN_NUTRIENTS[id].labelDe : id;
}

export function isKnownNutrientId(id: string): id is KnownNutrientId {
  return Object.prototype.hasOwnProperty.call(KNOWN_NUTRIENTS, id);
}

/**
 * The unit to offer when a row for this nutrient is added.
 *
 * Empty for a nutrient the table does not know, which is the honest answer: this
 * package has no idea what somebody's own row is measured in, and offering a
 * guessed `g` would put a wrong unit next to a right number.
 */
export function defaultUnitFor(id: string): string {
  return isKnownNutrientId(id) ? KNOWN_NUTRIENTS[id].unit : '';
}

/**
 * Sorts entries into declaration order, with unknown nutrients last.
 *
 * The order is the regulation's rather than the note's, because a label is read
 * in the order labels are printed in, and a vault whose meals list their fat and
 * their protein in whatever order each importer emitted is a vault whose meals
 * cannot be compared at a glance.
 *
 * Unknowns keep the order they arrived in rather than being sorted among
 * themselves: the sequence somebody typed their own rows in is the only thing
 * that ranks them, and alphabetising it would be this function inventing a
 * meaning for a list it does not understand.
 */
export function inNutrientOrder<T extends { name: string }>(entries: readonly T[]): T[] {
  const rank = new Map<string, number>(NUTRIENT_ORDER.map((id, index) => [id, index]));
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const ra = rank.get(a.entry.name) ?? Number.MAX_SAFE_INTEGER;
      const rb = rank.get(b.entry.name) ?? Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return a.index - b.index;
    })
    .map((ranked) => ranked.entry);
}
