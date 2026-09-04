/**
 * The per-100 g breakdown, from a note on disk to the rows a reader sees.
 *
 * These figures were in the vault for years and the meal view never rendered
 * them. They sat in two body sections, and the only way to read one was to open
 * the note as raw Markdown and read English text a German vault never asked
 * for. So what is pinned here is mostly *honesty*: that a note nobody has
 * migrated shows exactly what its converted twin shows, that a nutrient nothing
 * in the plugin recognises survives with the spelling somebody typed, that a
 * nutrient named without a figure reads as absent rather than as zero, and that
 * the same figures never appear twice on one screen.
 *
 * **The fixture is a real meal, copied byte for byte out of the vault this
 * plugin was built against.** A hand-written one agrees with whatever the code
 * does. `Grüne Casarecce mit Poulet` carries both retired sections with figures
 * in them and a Reheating section underneath, which is what makes it able to
 * say whether the exclusion is as narrow as it claims.
 *
 * One line is missing that the vault carried when it was copied:
 * `default_serving_size`, which said the same as `serving_size` and was read by
 * nothing. `scripts/strip-default-serving-size.ts` takes it off real notes, so a
 * fixture that kept it would be a copy of a vault that no longer exists.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { nutrientListValue, parseLegacyPer100gSections } from 'trail-core';
import { I18nManager } from '../src/lang/I18nManager';
import { mergeSettings } from '../src/settings/validate';
import { nutrientFieldNames } from '../src/meals/nutrient-fields';
import { extractSection, stripFrontmatter } from '../src/meals/parser/body-sections';
import { readMealMeta } from '../src/meals/parser/meal-meta';
import {
  renderedSectionHeadings,
  reservedSectionHeadings,
} from '../src/meals/parser/section-names';
import { splitTrailingSections } from '../src/meals/parser/trailing-sections';
import { nutritionBreakdown } from '../src/meals/view-model/nutrition-breakdown';
import { ABSENT_FIGURE } from '../src/meals/view-model/nutrition-row';

const settings = mergeSettings({});
const manager = I18nManager.getInstance();

// Anything switching locale puts it back, so test order stays irrelevant.
afterEach(async () => {
  await manager.setLocale('en');
});

// Verbatim, Reheating section and all.
const CASARECCE = `---
type: meal
image: Eating/Meals/_resources/CasareccePouletKrautstiel.jpg
source: manual_source
servings: 1
prepTime:
reheatTime:
totalTime:
calories: 646.8
kj: 2688.4
protein: 40.92
fat: 19.8
carbs: 70.4
serving_size: 440g
diet: Fleisch
icon: ph-fork-knife
created: "2026-08-06T16:32"
modified: "2026-08-06T16:36"
price: 17
---

# Nutritional Information (Per 100g)

- **Calories:** 147 kcal
- **Energy:** 611 kJ
- **Protein (g):** 9.3g
- **Fat (g):** 4.5g
- **Carbohydrates (g):** 16g

# Micronutrient Information (Per 100g)

- **Sodium:** 1g
- **Sugar:** 1g
- **Saturated Fat:** 2.1g

# Reheating

## Steamer
[temp:: 95 °C] [time:: 25 min]
`;

/**
 * The frontmatter object Obsidian's metadata cache would hand out.
 *
 * Parsed from the fixture rather than typed out beside it, so the note stays
 * the single source of what the note says and the two cannot drift.
 */
function frontmatterOf(note: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---/.exec(note);
  if (!match) return {};

  const parsed: unknown = parseYaml(match[1]);
  return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

function bodyOf(note: string): string[] {
  return stripFrontmatter(note).split('\n');
}

/** What the section actually says, one string per row, in the order it draws them. */
function rowsOf(frontmatter: Record<string, unknown>, body: string[] = []): string[] {
  const meta = readMealMeta(frontmatter, settings, body);
  return nutritionBreakdown(meta.per100g).map((row) => `${row.label}: ${row.value}`);
}

/**
 * The same note after the migration: the two sections read into the two lists
 * and written as properties, exactly as `write-draft.ts` writes them.
 *
 * Built from the fixture rather than hand-written beside it, because the claim
 * being tested is that converting a note changes nothing a reader sees, and a
 * hand-written "converted" note would only ever test whether two things
 * somebody typed agree.
 */
function converted(note: string): Record<string, unknown> {
  const lines = bodyOf(note);
  const legacy = parseLegacyPer100gSections(
    extractSection(lines, settings.nutritionHeading).content,
    extractSection(lines, settings.micronutrientHeading).content
  );
  const fields = nutrientFieldNames(settings);

  return {
    ...frontmatterOf(note),
    [settings.caloriesPer100gProperty]: legacy.caloriesPer100g,
    [settings.kjPer100gProperty]: legacy.kjPer100g,
    [settings.macronutrientsProperty]: nutrientListValue(legacy.macronutrients, fields),
    [settings.micronutrientsProperty]: nutrientListValue(legacy.micronutrients, fields),
  };
}

/** A breakdown in frontmatter, without a note around it. */
function stated(
  macronutrients: Record<string, unknown>[],
  micronutrients: Record<string, unknown>[] = [],
  energy: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...energy,
    [settings.macronutrientsProperty]: macronutrients,
    [settings.micronutrientsProperty]: micronutrients,
  };
}

describe('a note that has not been migrated', () => {
  it('shows the label its two body sections carry, which nothing used to render', () => {
    expect(rowsOf(frontmatterOf(CASARECCE), bodyOf(CASARECCE))).toEqual([
      'Calories: 147 kcal',
      'Kilojoules: 611 kJ',
      'Fat: 4.5 g',
      'of which saturates: 2.1 g',
      'Carbohydrate: 16 g',
      'of which sugars: 1 g',
      'Protein: 9.3 g',
      'Salt: 1 g',
    ]);
  });

  it('shows exactly what its converted equivalent shows', () => {
    // The whole point of the fallback. Until the vault migration runs, a
    // library is half one shape and half the other, and a reader should not be
    // able to tell which half a meal is in.
    expect(rowsOf(converted(CASARECCE), [])).toEqual(
      rowsOf(frontmatterOf(CASARECCE), bodyOf(CASARECCE))
    );
  });

  it('says Salt over the figure the old section labelled Sodium', () => {
    // The one correction the legacy bridge makes. Those grams were always salt;
    // the word above them was wrong, and nothing multiplies the number.
    const rows = rowsOf(frontmatterOf(CASARECCE), bodyOf(CASARECCE));
    expect(rows).toContain('Salt: 1 g');
    expect(rows.join('\n')).not.toContain('Sodium');
  });

  it('lets the frontmatter win outright when a note carries both', () => {
    // The third state: half migrated, with a section somebody has not deleted
    // and a figure somebody has since corrected. Merging would let the stale
    // section overwrite the correction.
    const half = { ...frontmatterOf(CASARECCE), caloriesPer100g: 152 };
    expect(rowsOf(half, bodyOf(CASARECCE))).toEqual(['Calories: 152 kcal']);
  });
});

describe('a note that states nothing per 100 g', () => {
  it('gets no rows at all, so the view can leave the card out', () => {
    expect(rowsOf({ calories: 646.8, protein: 40.92 })).toEqual([]);
  });

  it('gets no rows from a body with neither section in it', () => {
    expect(rowsOf({}, ['A meal with a description and nothing else.'])).toEqual([]);
  });
});

describe('what a row says', () => {
  it('renders each figure with the unit the note stored, never an assumed one', () => {
    // Iron is usually mg and occasionally µg. A reader that assumed the usual
    // would be out by a factor of a thousand with nothing looking wrong.
    expect(
      rowsOf(
        stated(
          [{ name: 'fat', unit: 'g', value: 4.5 }],
          [
            { name: 'iron', unit: 'µg', value: 820 },
            { name: 'vitaminC', unit: 'mg', value: 12 },
          ]
        )
      )
    ).toEqual(['Fat: 4.5 g', 'Iron: 820 µg', 'Vitamin C: 12 mg']);
  });

  it('renders a nutrient named without a figure as absent, and never as zero', () => {
    // 105 of the 126 meals with a label in the vault carry a blank row like
    // this. Somebody wrote that the meal has salt in it and has not measured
    // it; `0 g` would be the view inventing a measurement.
    const rows = rowsOf(stated([], [{ name: 'salt', unit: 'g' }]));
    expect(rows).toEqual([`Salt: ${ABSENT_FIGURE}`]);
    expect(rows[0]).not.toContain('0');
  });

  it('keeps a real zero a zero, because somebody measured that', () => {
    expect(rowsOf(stated([{ name: 'sugar', unit: 'g', value: 0 }]))).toEqual([
      'of which sugars: 0 g',
    ]);
  });

  it('keeps a micronutrient stated in hundredths rather than rounding it away', () => {
    // The reason this does not share the header strip's formatter, which floors
    // at one decimal: 0.02 mg of thiamin would read as 0.
    expect(rowsOf(stated([], [{ name: 'thiamin', unit: 'mg', value: 0.02 }]))).toEqual([
      'Thiamin: 0.02 mg',
    ]);
  });

  it('leaves out an energy figure the note does not state', () => {
    // A scalar has no named-but-unmeasured state: null means nobody wrote it.
    const energyOnly = stated([{ name: 'fat', unit: 'g', value: 4.5 }], [], { kjPer100g: 611 });
    expect(rowsOf(energyOnly)).toEqual(['Kilojoules: 611 kJ', 'Fat: 4.5 g']);
  });
});

describe('a nutrient nothing in the plugin knows', () => {
  it('renders with the name the note gave it, exactly as typed', () => {
    // The whole reason the figures became lists. A form that only draws rows it
    // has a label for drops them on save; a view that only draws rows it has a
    // label for tells somebody their data is gone.
    expect(
      rowsOf(
        stated(
          [{ name: 'fat', unit: 'g', value: 4.5 }],
          [{ name: 'Kreatin', unit: 'mg', value: 30 }]
        )
      )
    ).toEqual(['Fat: 4.5 g', 'Kreatin: 30 mg']);
  });

  it('sorts after the nutrients it does know, without being dropped', () => {
    expect(
      rowsOf(
        stated([
          { name: 'Kreatin', unit: 'mg', value: 30 },
          { name: 'protein', unit: 'g', value: 9.3 },
        ])
      )
    ).toEqual(['Protein: 9.3 g', 'Kreatin: 30 mg']);
  });
});

describe('the order rows come out in', () => {
  it('is the declaration order, whatever order the note stored', () => {
    // The lists are written in whatever order the editor left them, and the
    // writer deliberately does not sort on the way past, so that reordering a
    // list survives a save. Which order a reader sees is decided here.
    expect(
      rowsOf(
        stated(
          [
            { name: 'protein', unit: 'g', value: 9.3 },
            { name: 'sugar', unit: 'g', value: 1 },
            { name: 'fat', unit: 'g', value: 4.5 },
          ],
          [
            { name: 'iron', unit: 'mg', value: 2 },
            { name: 'salt', unit: 'g', value: 1 },
          ]
        )
      )
    ).toEqual(['Fat: 4.5 g', 'of which sugars: 1 g', 'Protein: 9.3 g', 'Salt: 1 g', 'Iron: 2 mg']);
  });

  it('does not rearrange an entry between the two lists', () => {
    // A note that filed iron under the macros is a note this plugin can read.
    // Moving it would be the view rewriting somebody's file in front of them.
    expect(
      rowsOf(
        stated([{ name: 'iron', unit: 'mg', value: 2 }], [{ name: 'salt', unit: 'g', value: 1 }])
      )
    ).toEqual(['Iron: 2 mg', 'Salt: 1 g']);
  });

  it('rules off between the groups, and never above the first row', () => {
    const groups = (frontmatter: Record<string, unknown>): boolean[] =>
      nutritionBreakdown(readMealMeta(frontmatter, settings).per100g).map(
        (row) => row.groupStart === true
      );

    expect(
      groups(
        stated([{ name: 'fat', unit: 'g', value: 4.5 }], [{ name: 'salt', unit: 'g', value: 1 }], {
          caloriesPer100g: 147,
        })
      )
    ).toEqual([false, true, true]);

    // Without energy the macros lead, and a rule across the top of the card
    // would be a boundary with nothing on the other side of it.
    expect(groups(stated([{ name: 'fat', unit: 'g', value: 4.5 }]))).toEqual([false]);
  });
});

describe('the language the labels are in', () => {
  it('reads a German vault in German, from the same note', async () => {
    // What this whole refactor was for. The ids in the file are language-free,
    // so the words come from the locale rather than from whatever the note was
    // written with, and the same unmigrated note reads either way.
    expect(rowsOf(frontmatterOf(CASARECCE), bodyOf(CASARECCE))).toContain(
      'of which saturates: 2.1 g'
    );

    await manager.setLocale('de');
    expect(rowsOf(frontmatterOf(CASARECCE), bodyOf(CASARECCE))).toEqual([
      'Kalorien: 147 kcal',
      'Kilojoule: 611 kJ',
      'Fett: 4.5 g',
      'davon gesättigte Fettsäuren: 2.1 g',
      'Kohlenhydrate: 16 g',
      'davon Zucker: 1 g',
      'Eiweiss: 9.3 g',
      'Salz: 1 g',
    ]);
  });

  it('leaves an unknown nutrient in the words the note used, in either locale', async () => {
    const note = stated([], [{ name: 'Kreatin', unit: 'mg', value: 30 }]);
    expect(rowsOf(note)).toEqual(['Kreatin: 30 mg']);

    await manager.setLocale('de');
    expect(rowsOf(note)).toEqual(['Kreatin: 30 mg']);
  });
});

describe('the two retired headings', () => {
  it('are never offered as trailing-section cards', () => {
    // Otherwise an unmigrated note shows its label twice: once as the breakdown
    // card, and once as a card of raw `- **Sodium:** 1g`. Before this phase
    // nothing rendered those figures, so the raw card was the only sight of
    // them; now it is a duplicate.
    const headings = splitTrailingSections(
      stripFrontmatter(CASARECCE),
      renderedSectionHeadings(settings),
      reservedSectionHeadings(settings)
    ).map((section) => section.heading);

    expect(headings).toEqual([]);
  });

  it('are on both lists, which answer different questions', () => {
    // `reserved` is about parsing: a heading that ends somebody else's section.
    // `rendered` is about drawing: a heading this plugin presents itself. Both
    // have to hold, and a heading dropped from either one fails differently.
    for (const heading of [settings.nutritionHeading, settings.micronutrientHeading]) {
      expect(reservedSectionHeadings(settings)).toContain(heading);
      expect(renderedSectionHeadings(settings)).toContain(heading);
    }
  });

  it('leave a section nothing renders exactly where it was', () => {
    // The check that the exclusion is narrow. Notes is on the reserved list and
    // deliberately not on the rendered one, because its card is the only place
    // that content appears.
    const note = [
      '# Nutritional Information (Per 100g)',
      '',
      '- **Calories:** 147 kcal',
      '',
      '# Notes',
      '',
      'Reheats badly twice.',
    ].join('\n');

    expect(
      splitTrailingSections(
        note,
        renderedSectionHeadings(settings),
        reservedSectionHeadings(settings)
      )
    ).toEqual([{ heading: 'Notes', body: 'Reheats badly twice.' }]);
  });
});
