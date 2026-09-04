/**
 * The nutrient vocabulary, the per-100 g model, and the bridge from the two body
 * sections a vault is full of today.
 *
 * The failures this file exists to catch are all one shape: something quietly
 * deciding it knows better than the note. A nutrient dropped because nothing
 * recognised its name, a blank figure read as zero, a missing serving weight
 * treated as zero grams, a German label unreadable because the locale happens to
 * be English. Each of those loses or invents data, and none of them raises an
 * error while doing it.
 */
import { describe, expect, it } from 'vitest';
import {
  MACRONUTRIENT_IDS,
  MICRONUTRIENT_IDS,
  defaultUnitFor,
  deriveServingNutrition,
  emptyMealNutrition,
  inNutrientOrder,
  isEmptyMealNutrition,
  matchNutrient,
  nutrientLabel,
  nutrientListValue,
  nutrientValue,
  parseLegacyPer100gSections,
  readNutrientList,
  type MealNutritionPer100g,
  type NutrientEntry,
} from '../../src/meal';

const FIELDS = { name: 'nutrient', unit: 'unit', value: 'value' };

function entry(name: string, unit: string, value: number | null): NutrientEntry {
  return { name, unit, value };
}

describe('the known-id table', () => {
  it('lists the macronutrients in EU declaration order', () => {
    // Regulation (EU) 1169/2011 Annex XV, minus energy: the order a label is
    // printed in, which is the order somebody reads one in.
    expect([...MACRONUTRIENT_IDS]).toEqual([
      'fat',
      'saturatedFat',
      'carbs',
      'sugar',
      'fibre',
      'protein',
    ]);
  });

  it('puts salt first among the micronutrients, and sodium beside it', () => {
    expect(MICRONUTRIENT_IDS[0]).toBe('salt');
    expect(MICRONUTRIENT_IDS[1]).toBe('sodium');
  });

  it('gives macros and salt grams, and the trace nutrients mg or µg', () => {
    for (const id of MACRONUTRIENT_IDS) expect(defaultUnitFor(id)).toBe('g');
    expect(defaultUnitFor('salt')).toBe('g');
    expect(defaultUnitFor('sodium')).toBe('mg');
    expect(defaultUnitFor('iron')).toBe('mg');
    expect(defaultUnitFor('vitaminD')).toBe('µg');
  });

  it('offers no unit for a nutrient it has never heard of', () => {
    // Rather than guessing grams: a wrong unit next to a right number is worse
    // than no unit at all, because it looks like an answer.
    expect(defaultUnitFor('Wasabi')).toBe('');
  });
});

describe('matching a name', () => {
  it('reads the English and the German labels regardless of anything', () => {
    // The point: there is no locale argument to get wrong. Both tables are
    // always consulted, so a vault that switches language keeps reading what it
    // already wrote, and a shared vault holding both stays readable.
    expect(matchNutrient('Saturated Fat').id).toBe('saturatedFat');
    expect(matchNutrient('Gesättigte Fettsäuren').id).toBe('saturatedFat');
    expect(matchNutrient('Kohlenhydrate').id).toBe('carbs');
    expect(matchNutrient('Ballaststoffe').id).toBe('fibre');
    expect(matchNutrient('Eiweiss').id).toBe('protein');
    expect(matchNutrient('Eisen').id).toBe('iron');
    expect(matchNutrient('Folsäure').id).toBe('folicAcid');
  });

  it('tolerates case and whitespace, because people typed these', () => {
    expect(matchNutrient('  saturated   FAT  ').id).toBe('saturatedFat');
    expect(matchNutrient('ZUCKER').id).toBe('sugar');
    // A caller that split a `- **Sugar:** 2.9g` line may or may not have kept
    // the colon, which is nothing the note meant.
    expect(matchNutrient('Sugar:').id).toBe('sugar');
  });

  it('answers to the old body-section labels', () => {
    expect(matchNutrient('Protein (g)').id).toBe('protein');
    expect(matchNutrient('Fat (g)').id).toBe('fat');
    expect(matchNutrient('Carbohydrates (g)').id).toBe('carbs');
    expect(matchNutrient('Sugar').id).toBe('sugar');
    expect(matchNutrient('Saturated Fat').id).toBe('saturatedFat');
  });

  it('reads Sodium as sodium and Salt as salt, and never one as the other', () => {
    // Two quantities off the same label, related by a factor nothing here
    // applies. The old sections' mislabelling is corrected in the one place that
    // knows it was a mistake, not by aliasing a word to something it does not
    // mean.
    expect(matchNutrient('Sodium').id).toBe('sodium');
    expect(matchNutrient('Natrium').id).toBe('sodium');
    expect(matchNutrient('Salt').id).toBe('salt');
    expect(matchNutrient('Salz').id).toBe('salt');
  });

  it('keeps a name it does not know, exactly as typed', () => {
    const match = matchNutrient('  Ashwagandha ');
    expect(match).toEqual({ id: 'Ashwagandha', label: 'Ashwagandha', known: false });
    expect(nutrientLabel('Ashwagandha')).toBe('Ashwagandha');
  });

  it('does not treat energy as a nutrient', () => {
    // Deliberate: calories and kilojoules are two named scalars on the model,
    // because a `calories` row in a list invites the question of whether it is
    // the per-100 g one or the per-serving one.
    expect(matchNutrient('Calories').known).toBe(false);
    expect(matchNutrient('Energy').known).toBe(false);
  });
});

describe('declaration order', () => {
  it('sorts known nutrients into the regulation order', () => {
    const sorted = inNutrientOrder([
      entry('protein', 'g', 10.5),
      entry('sugar', 'g', 1.8),
      entry('fat', 'g', 4.5),
      entry('saturatedFat', 'g', 1.5),
      entry('carbs', 'g', 13.8),
    ]);
    expect(sorted.map((row) => row.name)).toEqual([
      'fat',
      'saturatedFat',
      'carbs',
      'sugar',
      'protein',
    ]);
  });

  it('puts unknown nutrients last, in the order they arrived', () => {
    const sorted = inNutrientOrder([
      entry('Ashwagandha', 'mg', 300),
      entry('protein', 'g', 10.5),
      entry('Maca', 'mg', 500),
      entry('fat', 'g', 4.5),
    ]);
    // Nothing alphabetises the tail: the sequence somebody typed their own rows
    // in is the only thing that ranks them.
    expect(sorted.map((row) => row.name)).toEqual(['fat', 'protein', 'Ashwagandha', 'Maca']);
  });

  it('sorts macros ahead of micros when a caller hands it one list', () => {
    const sorted = inNutrientOrder([entry('iron', 'mg', 2), entry('protein', 'g', 10)]);
    expect(sorted.map((row) => row.name)).toEqual(['protein', 'iron']);
  });
});

describe('the empty model', () => {
  it('states nothing at all', () => {
    expect(isEmptyMealNutrition(emptyMealNutrition())).toBe(true);
  });

  it('counts a row with no figure as something stated', () => {
    // "There is salt in this and nobody has measured it" is a different note
    // from one that never mentioned salt, and only the second is empty.
    const nutrition = emptyMealNutrition();
    nutrition.micronutrients.push(entry('salt', 'g', null));
    expect(isEmptyMealNutrition(nutrition)).toBe(false);
  });

  it('hands out fresh lists, so two drafts never share one', () => {
    const one = emptyMealNutrition();
    one.macronutrients.push(entry('fat', 'g', 1));
    expect(one.macronutrients).toHaveLength(1);
    expect(emptyMealNutrition().macronutrients).toEqual([]);
  });
});

describe('reading a nutrient list out of frontmatter', () => {
  it('resolves names to ids and keeps unknown ones as written', () => {
    const rows = readNutrientList(
      [
        { nutrient: 'Fett', unit: 'g', value: 6.8 },
        { nutrient: 'Ashwagandha', unit: 'mg', value: 300 },
      ],
      FIELDS
    );
    expect(rows).toEqual([entry('fat', 'g', 6.8), entry('Ashwagandha', 'mg', 300)]);
  });

  it('reads a figure stored as a string, because a text property keeps it that way', () => {
    expect(readNutrientList([{ nutrient: 'Sugar', unit: 'g', value: '2.9' }], FIELDS)).toEqual([
      entry('sugar', 'g', 2.9),
    ]);
  });

  it('reads a missing or unreadable figure as null, never as zero', () => {
    // Zero is a measurement: it says this meal contains no sugar. Null says
    // nobody has measured it. A reader that confuses the two invents a fact
    // that then gets averaged and charted.
    const rows = readNutrientList(
      [
        { nutrient: 'Sugar', unit: 'g' },
        { nutrient: 'Salt', unit: 'g', value: '' },
        { nutrient: 'Fibre', unit: 'g', value: 'some' },
        { nutrient: 'Fat', unit: 'g', value: 0 },
      ],
      FIELDS
    );
    expect(rows.map((row) => row.value)).toEqual([null, null, null, 0]);
  });

  it('reads a missing unit as an empty string rather than inventing one', () => {
    expect(readNutrientList([{ nutrient: 'Iron', value: 2 }], FIELDS)).toEqual([
      entry('iron', '', 2),
    ]);
  });

  it('drops a row with no usable name, because the nutrient is the row', () => {
    const rows = readNutrientList(
      [{ unit: 'g', value: 3 }, { nutrient: '   ' }, 'not a map', null, { nutrient: 'Zinc' }],
      FIELDS
    );
    expect(rows).toEqual([entry('zinc', '', null)]);
  });

  it('accepts a lone map, and reads nothing out of nothing', () => {
    expect(readNutrientList({ nutrient: 'Salt', unit: 'g', value: 1 }, FIELDS)).toEqual([
      entry('salt', 'g', 1),
    ]);
    expect(readNutrientList(undefined, FIELDS)).toEqual([]);
    expect(readNutrientList(null, FIELDS)).toEqual([]);
  });
});

describe('writing a nutrient list back', () => {
  it('omits each sub-key individually when it is absent', () => {
    const records = nutrientListValue(
      [entry('salt', 'g', 1), entry('sugar', '', null), entry('fat', '', 0)],
      FIELDS
    );
    expect(records).toEqual([
      { nutrient: 'salt', unit: 'g', value: 1 },
      { nutrient: 'sugar' },
      { nutrient: 'fat', value: 0 },
    ]);
  });

  it('uses the sub-key names it is given, because the vault owns them', () => {
    const records = nutrientListValue([entry('salt', 'g', 1)], {
      name: 'naehrstoff',
      unit: 'einheit',
      value: 'wert',
    });
    expect(records).toEqual([{ naehrstoff: 'salt', einheit: 'g', wert: 1 }]);
  });

  it('round trips every shape a row can be in', () => {
    const rows = [
      entry('fat', 'g', 6.8),
      entry('saturatedFat', 'g', 0),
      entry('salt', 'g', null),
      entry('iron', 'mg', 2.4),
      entry('Ashwagandha', 'mg', 300),
      entry('Maca', '', null),
    ];
    expect(readNutrientList(nutrientListValue(rows, FIELDS), FIELDS)).toEqual(rows);
  });
});

describe('deriving the per-serving figures', () => {
  const nutrition: MealNutritionPer100g = {
    caloriesPer100g: 143,
    kjPer100g: 600,
    macronutrients: [
      entry('fat', 'g', 4.5),
      entry('carbs', 'g', 13.8),
      entry('protein', 'g', 10.5),
    ],
    micronutrients: [entry('salt', 'g', 1)],
  };

  it('scales the five frontmatter figures by the serving weight', () => {
    expect(deriveServingNutrition(nutrition, 450)).toEqual({
      calories: 643.5,
      kj: 2700,
      protein: 47.25,
      fat: 20.25,
      carbs: 62.1,
    });
  });

  it('returns null for everything when there is no serving weight', () => {
    // The bug this replaces: `draft.servingGrams ?? 0` multiplied a full label
    // by zero grams and wrote `calories: 0` into the note. Zero is a claim about
    // the food; null is the truth that the arithmetic cannot be done.
    const none = { calories: null, kj: null, protein: null, fat: null, carbs: null };
    expect(deriveServingNutrition(nutrition, null)).toEqual(none);
    expect(deriveServingNutrition(nutrition, 0)).toEqual(none);
    expect(deriveServingNutrition(nutrition, -430)).toEqual(none);
  });

  it('leaves a macro the label never stated as null', () => {
    const partial: MealNutritionPer100g = {
      ...emptyMealNutrition(),
      caloriesPer100g: 158,
      macronutrients: [entry('protein', 'g', 4.1)],
    };
    expect(deriveServingNutrition(partial, 430)).toEqual({
      calories: 679.4,
      kj: null,
      protein: 17.63,
      fat: null,
      carbs: null,
    });
  });

  it('ignores a macro id that only appears in the micronutrient list', () => {
    // Nothing rearranges somebody's lists, but the derivation looks where the
    // figures belong, and a fat row filed under micronutrients is not one.
    const odd: MealNutritionPer100g = {
      ...emptyMealNutrition(),
      micronutrients: [entry('fat', 'g', 4.5)],
    };
    expect(deriveServingNutrition(odd, 450).fat).toBeNull();
  });
});

/**
 * Copied verbatim out of `Eating/Meals/Beef Stroganoff mit Spätzli.md`, which is
 * a note somebody's vault actually holds. The blank-Sodium variant below is from
 * `Auberginen Curry 🌶.md`, and between them the two shapes account for every one
 * of the 126 meals in there that carry a label at all, out of 127.
 */
const REAL_NUTRITION_SECTION = [
  '- **Calories:** 143 kcal',
  '- **Energy:** 600 kJ',
  '- **Protein (g):** 10.5g',
  '- **Fat (g):** 4.5g',
  '- **Carbohydrates (g):** 13.8g',
].join('\n');

const REAL_MICRONUTRIENT_SECTION = [
  '- **Sodium:** 1g',
  '- **Sugar:** 1.8g',
  '- **Saturated Fat:** 1.5g',
].join('\n');

describe('reading the old body sections into the new model', () => {
  const nutrition = parseLegacyPer100gSections(REAL_NUTRITION_SECTION, REAL_MICRONUTRIENT_SECTION);

  it('keeps energy as the two scalars rather than as rows', () => {
    expect(nutrition.caloriesPer100g).toBe(143);
    expect(nutrition.kjPer100g).toBe(600);
    expect(nutrition.macronutrients.map((row) => row.name)).not.toContain('calories');
  });

  it('puts sugar and saturated fat among the macronutrients, in order', () => {
    // Their old home under `# Micronutrient Information` was that heading being
    // used as "the second section" rather than as a category.
    expect(nutrition.macronutrients).toEqual([
      entry('fat', 'g', 4.5),
      entry('saturatedFat', 'g', 1.5),
      entry('carbs', 'g', 13.8),
      entry('sugar', 'g', 1.8),
      entry('protein', 'g', 10.5),
    ]);
  });

  it('reads the Sodium row as salt, with the figure untouched', () => {
    // 1 g per 100 g is salt. Nothing is converted or multiplied here; the label,
    // the English string and the German `Natrium` were simply all wrong about a
    // number that was always right.
    expect(nutrition.micronutrients).toEqual([entry('salt', 'g', 1)]);
  });

  it('derives the same per-serving figures the note already carries', () => {
    // The frontmatter of that note says 643.5 kcal, 2700 kJ, 47.25 protein,
    // 20.25 fat, 62.1 carbs at serving_size 450g. End to end, unchanged.
    expect(deriveServingNutrition(nutrition, 450)).toEqual({
      calories: 643.5,
      kj: 2700,
      protein: 47.25,
      fat: 20.25,
      carbs: 62.1,
    });
  });

  it('keeps a stated-but-blank row as a row with no figure', () => {
    // `- **Sodium:** ` is what the old writer emitted for an unmeasured field,
    // and it means somebody can fill it in. Read as absent, the row would
    // vanish out of a note that had shown it.
    const blank = parseLegacyPer100gSections(
      REAL_NUTRITION_SECTION,
      ['- **Sodium:** ', '- **Sugar:** 2.9g', '- **Saturated Fat:** 4.4g'].join('\n')
    );
    expect(blank.micronutrients).toEqual([entry('salt', 'g', null)]);
    expect(nutrientValue(blank.micronutrients, 'salt')).toBeNull();
  });

  it('leaves out a nutrient the sections never named', () => {
    const macros = parseLegacyPer100gSections('- **Calories:** 158 kcal', '');
    expect(macros.macronutrients).toEqual([]);
    expect(macros.micronutrients).toEqual([]);
    expect(macros.caloriesPer100g).toBe(158);
  });

  it('reads two empty sections as a note that states nothing', () => {
    expect(isEmptyMealNutrition(parseLegacyPer100gSections('', ''))).toBe(true);
  });

  it('survives a note somebody cleaned the bold markers off', () => {
    const plain = parseLegacyPer100gSections('- Calories: 143 kcal\n- Fat: 4.5g', '- Salt: 1g');
    expect(plain.caloriesPer100g).toBe(143);
    expect(plain.macronutrients).toEqual([entry('fat', 'g', 4.5)]);
    expect(plain.micronutrients).toEqual([entry('salt', 'g', 1)]);
  });

  it('round trips through frontmatter unchanged', () => {
    const macros = readNutrientList(nutrientListValue(nutrition.macronutrients, FIELDS), FIELDS);
    const micros = readNutrientList(nutrientListValue(nutrition.micronutrients, FIELDS), FIELDS);
    expect(macros).toEqual(nutrition.macronutrients);
    expect(micros).toEqual(nutrition.micronutrients);
  });
});
