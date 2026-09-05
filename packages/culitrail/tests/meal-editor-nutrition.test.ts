/**
 * The meal editor's nutrition half, from a note on disk and back again.
 *
 * The figures a meal states per 100 g live in frontmatter, as two energy
 * properties and two lists of nutrients. This suite covers the three journeys
 * that matter and one that has to keep working for years: a converted note read
 * and written back unchanged, an unconverted note read out of its two body
 * sections and converted by the act of saving, a nutrient nothing in the plugin
 * recognises surviving both, and the arithmetic refusing to invent a figure it
 * cannot do.
 *
 * **Both fixtures are real meals, copied byte for byte out of the vault this
 * plugin was built against.** A hand-written fixture agrees with whatever the
 * code does; `Federkohlrisotto` has the blank `- **Sodium:** ` row that 105 of
 * the 126 meals with a label carry, and `Grüne Casarecce mit Poulet` has a
 * Reheating section underneath the two that are being taken out, which is the
 * case that says whether the surgery is as narrow as it claims.
 *
 * One line is missing from each that the vault carried when they were copied:
 * `default_serving_size`, which said the same as `serving_size` and was read by
 * nothing. `scripts/strip-default-serving-size.ts` takes it off real notes, so a
 * fixture that kept it would be a copy of a vault that no longer exists.
 */
import { describe, expect, it } from 'vitest';
import type { App, TFile } from 'obsidian';
import { splitFrontmatterBlock } from '@technosoftware/trail-core';
import { mergeSettings } from '../src/settings/validate';
import { readMealDraft } from '../src/meals/editor/read-draft';
import { writeMealDraft } from '../src/meals/editor/write-draft';
import {
  blankEntry,
  renamedEntry,
  seedBreakdown,
  unusedNutrientIds,
} from '../src/meals/editor/nutrition-form';
import type { MealDraft } from '../src/meals/editor/types';

const settings = mergeSettings({});

// Verbatim. The trailing space after `- **Sodium:**` is what the old writer
// emitted for an unmeasured field and is the whole point of this fixture: it is
// a nutrient the note names without stating, which is a different note from one
// that never mentioned salt. Do not tidy it away.
const FEDERKOHLRISOTTO = `---
type: meal
image: Eating/Meals/_resources/Federkohlrisotto.png
source:
servings: 1
prepTime:
reheatTime:
totalTime:
calories: 575.4
kj: 2406.6
protein: 23.52
fat: 29.82
carbs: 60.9
serving_size: 420g
diet: Vegetarisch
lastEaten: 2026-03-02
eatenCount: 5
icon: ph-fork-knife
created: "2026-08-02T10:37"
modified: "2026-08-13T11:22"
---

mit gebratenen Pilzen und Sbrinz

# Nutritional Information (Per 100g)

- **Calories:** 137 kcal
- **Energy:** 573 kJ
- **Protein (g):** 5.6g
- **Fat (g):** 7.1g
- **Carbohydrates (g):** 14.5g

# Micronutrient Information (Per 100g)

- **Sodium:** 
- **Sugar:** 1.4g
- **Saturated Fat:** 2.5g
`;

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
 * A vault holding one note, readable and writable the way Obsidian's is.
 *
 * The split is Obsidian's own: the frontmatter is an object the metadata cache
 * hands out and `processFrontMatter` mutates, and the body is text that
 * `cachedRead` and `process` see. Keeping the parsed object rather than
 * re-parsing YAML on every pass is not a shortcut around the interesting part:
 * what a nutrient list looks like once Obsidian has serialized it is Obsidian's
 * business, and asserting against its YAML here would be testing a stand-in.
 * What is this plugin's business is which keys end up in that object and what
 * they hold, which is what the tests below read.
 *
 * The block is written back as one line per key with a JSON value, which is
 * valid YAML flow style, so the body still splits off exactly where it should.
 */
function vaultWith(contents: string): {
  app: App;
  file: TFile;
  frontmatter: () => Record<string, unknown>;
  body: () => string;
  text: () => string;
} {
  const path = 'Eating/Meals/Test.md';
  const file = { path, name: 'Test.md', basename: 'Test', extension: 'md' } as unknown as TFile;

  const split = splitFrontmatterBlock(contents);
  let body = split.body;
  let frontmatter = parseBlock(split.header);

  const render = (): string => {
    const rows = Object.entries(frontmatter).map(([key, value]) => `${key}:${renderValue(value)}`);
    return `---\n${rows.join('\n')}\n---\n${body}`;
  };

  const app = {
    vault: {
      cachedRead: () => Promise.resolve(render()),
      process: (_file: TFile, fn: (text: string) => string) => {
        const next = fn(render());
        body = splitFrontmatterBlock(next).body;
        return Promise.resolve(next);
      },
    },
    metadataCache: {
      getFileCache: () => ({ frontmatter }),
    },
    fileManager: {
      processFrontMatter: (_file: TFile, fn: (fm: Record<string, unknown>) => void) => {
        fn(frontmatter);
        return Promise.resolve();
      },
    },
  } as unknown as App;

  return {
    app,
    file,
    frontmatter: () => frontmatter,
    body: () => body,
    text: render,
  };
}

/** `key: value` lines, the shape both fixtures' frontmatter is written in. */
function parseBlock(header: string): Record<string, unknown> {
  const entries: Record<string, unknown> = {};

  for (const line of header.split('\n')) {
    if (line.trim() === '---' || line.trim() === '') continue;

    const at = line.indexOf(':');
    if (at < 0) continue;

    const key = line.slice(0, at).trim();
    const raw = line.slice(at + 1).trim();
    if (raw === '') {
      entries[key] = null;
      continue;
    }

    const unquoted = raw.replace(/^"(.*)"$/, '$1');
    const asNumber = Number(unquoted);
    entries[key] = unquoted !== '' && !Number.isNaN(asNumber) ? asNumber : unquoted;
  }

  return entries;
}

function renderValue(value: unknown): string {
  // A property somebody cleared is written as a key with nothing after it,
  // which is how every meal in the vault carries its blank `prepTime:`.
  return value === null || value === undefined ? '' : ` ${JSON.stringify(value)}`;
}

/** The nutrient rows a frontmatter list holds, as `id: value` for readability. */
function figures(value: unknown): Record<string, unknown> {
  const rows = (value ?? []) as { name?: unknown; value?: unknown }[];
  const entries = rows.map((row): [string, unknown] => [
    typeof row.name === 'string' ? row.name : '',
    row.value ?? null,
  ]);
  return Object.fromEntries(entries);
}

describe('reading a meal written before the move', () => {
  it('finds the breakdown in the two body sections', async () => {
    const vault = vaultWith(FEDERKOHLRISOTTO);
    const draft = await readMealDraft(vault.app, vault.file, settings);

    expect(draft.hasPer100g).toBe(true);
    expect(draft.per100g.caloriesPer100g).toBe(137);
    expect(draft.per100g.kjPer100g).toBe(573);
    expect(figures(draft.per100g.macronutrients)).toEqual({
      fat: 7.1,
      saturatedFat: 2.5,
      carbs: 14.5,
      sugar: 1.4,
      protein: 5.6,
    });
  });

  it('keeps the row the old writer left blank, as a row with no figure', async () => {
    // `- **Sodium:** ` with nothing after it says this meal has salt in it and
    // nobody has measured it. Dropping the row would say it has none, and
    // reading it as zero would say the same thing louder.
    const vault = vaultWith(FEDERKOHLRISOTTO);
    const draft = await readMealDraft(vault.app, vault.file, settings);

    expect(draft.per100g.micronutrients).toEqual([{ name: 'salt', unit: 'g', value: null }]);
  });

  it('reads the serving weight however the note spells it', async () => {
    // `440g`, `440 g` and `440` are one weight written three ways, and a reader
    // that took only the third would divide by nothing on most of the vault.
    for (const stated of ['420g', '420 g', '420']) {
      const vault = vaultWith(
        FEDERKOHLRISOTTO.replace('serving_size: 420g', `serving_size: ${stated}`)
      );
      const draft = await readMealDraft(vault.app, vault.file, settings);

      expect(draft.servingGrams).toBe(420);
    }
  });

  it('is a per-100 g note even with only one of the two sections', async () => {
    // Either section is a note stating its figures per 100 g. Treating one as
    // per-serving would multiply the whole label by the serving weight on the
    // next save.
    const macrosOnly = FEDERKOHLRISOTTO.slice(
      0,
      FEDERKOHLRISOTTO.indexOf('# Micronutrient Information (Per 100g)')
    );
    const vault = vaultWith(macrosOnly);

    expect((await readMealDraft(vault.app, vault.file, settings)).hasPer100g).toBe(true);
  });

  it('has no breakdown when the note states neither', async () => {
    const plain = `---\ntype: meal\ncalories: 575.4\n---\n\nmit Pilzen\n`;
    const vault = vaultWith(plain);
    const draft = await readMealDraft(vault.app, vault.file, settings);

    expect(draft.hasPer100g).toBe(false);
    expect(draft.totals.calories).toBe(575.4);
  });
});

describe('saving a meal written before the move', () => {
  it('writes the lists into frontmatter', async () => {
    const vault = vaultWith(FEDERKOHLRISOTTO);
    const draft = await readMealDraft(vault.app, vault.file, settings);
    await writeMealDraft(vault.app, vault.file, settings, draft);

    const frontmatter = vault.frontmatter();
    expect(frontmatter.caloriesPer100g).toBe(137);
    expect(frontmatter.kjPer100g).toBe(573);
    expect(figures(frontmatter.macronutrients)).toEqual({
      fat: 7.1,
      saturatedFat: 2.5,
      carbs: 14.5,
      sugar: 1.4,
      protein: 5.6,
    });
    // The blank row is written as a name and a unit and no figure, rather than
    // as a name beside a null.
    expect(frontmatter.micronutrients).toEqual([{ name: 'salt', unit: 'g' }]);
  });

  it('takes the two old sections out and leaves the rest of the body alone', async () => {
    const vault = vaultWith(CASARECCE);
    const draft = await readMealDraft(vault.app, vault.file, settings);
    await writeMealDraft(vault.app, vault.file, settings, draft);

    const body = vault.body();
    expect(body).not.toContain('# Nutritional Information (Per 100g)');
    expect(body).not.toContain('# Micronutrient Information (Per 100g)');
    expect(body).not.toContain('- **Sodium:** 1g');
    // The section underneath them, byte for byte, heading level and all.
    expect(body).toContain('# Reheating\n\n## Steamer\n[temp:: 95 °C] [time:: 25 min]');
  });

  it('leaves nothing behind for a second save to remove', async () => {
    // A converted note is saved again on every later edit, so the removal has to
    // be a no-op by then rather than something that keeps trimming the body.
    const vault = vaultWith(CASARECCE);
    const draft = await readMealDraft(vault.app, vault.file, settings);
    await writeMealDraft(vault.app, vault.file, settings, draft);
    const once = vault.body();

    const again = await readMealDraft(vault.app, vault.file, settings);
    await writeMealDraft(vault.app, vault.file, settings, again);

    expect(vault.body()).toBe(once);
  });

  it('derives the per-serving figures from the breakdown and the weight', async () => {
    const vault = vaultWith(CASARECCE);
    const draft = await readMealDraft(vault.app, vault.file, settings);
    await writeMealDraft(vault.app, vault.file, settings, draft);

    const frontmatter = vault.frontmatter();
    expect(frontmatter.calories).toBe(646.8);
    expect(frontmatter.protein).toBe(40.92);
    expect(frontmatter.fat).toBe(19.8);
    expect(frontmatter.carbs).toBe(70.4);
    expect(frontmatter.kj).toBe(2688.4);
  });
});

describe('a breakdown with no serving weight', () => {
  const weightless = FEDERKOHLRISOTTO.replace('serving_size: 420g\n', '');

  it('derives nothing rather than writing zeros', async () => {
    // This used to read `draft.servingGrams ?? 0` and multiply, so a meal with a
    // full label and no weight wrote `calories: 0` into its own frontmatter,
    // which is a claim that a portion of it contains no energy.
    const vault = vaultWith(weightless);
    const draft = await readMealDraft(vault.app, vault.file, settings);
    expect(draft.servingGrams).toBeNull();

    await writeMealDraft(vault.app, vault.file, settings, draft);

    const frontmatter = vault.frontmatter();
    for (const key of ['calories', 'kj', 'protein', 'fat', 'carbs']) {
      expect(frontmatter[key]).toBeNull();
    }
    // And a null reaches the note as a property with nothing after it, never as
    // a figure. `calories: 0` is the shape this test exists to keep out.
    expect(vault.text()).toContain('\ncalories:\n');
    expect(vault.text()).not.toMatch(/\ncalories: 0\b/);
  });

  it('still writes the breakdown itself, which is what the note does know', async () => {
    const vault = vaultWith(weightless);
    const draft = await readMealDraft(vault.app, vault.file, settings);
    await writeMealDraft(vault.app, vault.file, settings, draft);

    expect(vault.frontmatter().caloriesPer100g).toBe(137);
  });
});

describe('the property names a note already uses', () => {
  it('writes the per-serving figures back under the note’s own key', async () => {
    // The bug: the per-serving writes assigned `settings.caloriesProperty`
    // directly and skipped the alias resolution every other field goes through,
    // so a note keyed `kcal:` gained a second `calories:` and orphaned the first.
    const vault = vaultWith(CASARECCE.replace('calories: 646.8', 'kcal: 646.8'));
    const draft = await readMealDraft(vault.app, vault.file, settings);
    // Halve the portion, so the derived figure differs from the one the note
    // arrived with and the assertion cannot pass on the old value sitting there.
    draft.servingGrams = 220;
    await writeMealDraft(vault.app, vault.file, settings, draft);

    const frontmatter = vault.frontmatter();
    expect(frontmatter.kcal).toBe(323.4);
    expect(Object.keys(frontmatter)).not.toContain('calories');
  });

  it('matches an existing key without regard to case', async () => {
    const vault = vaultWith(CASARECCE.replace('kj: 2688.4', 'KJ: 2688.4'));
    const draft = await readMealDraft(vault.app, vault.file, settings);
    draft.servingGrams = 220;
    await writeMealDraft(vault.app, vault.file, settings, draft);

    expect(vault.frontmatter().KJ).toBe(1344.2);
    expect(Object.keys(vault.frontmatter())).not.toContain('kj');
  });
});

describe('a nutrient nothing in the plugin knows', () => {
  const withCreatine = (): ReturnType<typeof vaultWith> => {
    const vault = vaultWith(CASARECCE);
    // Written the way a converted note carries it, since that is the only way an
    // unknown nutrient can arrive: the old sections had no line for one.
    vault.frontmatter().macronutrients = [
      { name: 'fat', unit: 'g', value: 4.5 },
      { name: 'Kreatin', unit: 'mg', value: 12 },
    ];
    return vault;
  };

  it('survives read, an edit elsewhere in the form, and write', async () => {
    const vault = withCreatine();
    const draft = await readMealDraft(vault.app, vault.file, settings);

    expect(draft.per100g.macronutrients[1]).toEqual({ name: 'Kreatin', unit: 'mg', value: 12 });

    // What the form does to another row while this one is merely on screen.
    draft.per100g.macronutrients[0].value = 5;
    draft.per100g.macronutrients.push(blankEntry('fibre'));
    await writeMealDraft(vault.app, vault.file, settings, draft);

    expect(vault.frontmatter().macronutrients).toEqual([
      { name: 'fat', unit: 'g', value: 5 },
      { name: 'Kreatin', unit: 'mg', value: 12 },
      { name: 'fibre', unit: 'g' },
    ]);
  });

  it('does not become one of the figures a serving is derived from', async () => {
    // `deriveServingNutrition` looks up protein, fat and carbs by id. A row it
    // cannot identify contributes to nothing rather than being guessed at.
    const vault = withCreatine();
    const draft = await readMealDraft(vault.app, vault.file, settings);
    await writeMealDraft(vault.app, vault.file, settings, draft);

    const frontmatter = vault.frontmatter();
    expect(frontmatter.fat).toBe(19.8);
    expect(frontmatter.protein).toBeNull();
  });
});

describe('a breakdown in frontmatter', () => {
  it('round-trips: read it, write it back, read it again', async () => {
    const vault = vaultWith(CASARECCE);
    const first = await readMealDraft(vault.app, vault.file, settings);
    await writeMealDraft(vault.app, vault.file, settings, first);

    const second = await readMealDraft(vault.app, vault.file, settings);
    expect(second.per100g).toEqual(first.per100g);

    await writeMealDraft(vault.app, vault.file, settings, second);
    const third = await readMealDraft(vault.app, vault.file, settings);
    expect(third.per100g).toEqual(first.per100g);
  });

  it('wins over a body section the note still carries', async () => {
    // A half-migrated note: the frontmatter has been corrected and the old
    // section has not. Merging the two would let the stale figure win back.
    const vault = vaultWith(CASARECCE);
    vault.frontmatter().caloriesPer100g = 200;
    vault.frontmatter().macronutrients = [{ name: 'fat', unit: 'g', value: 9 }];

    const draft = await readMealDraft(vault.app, vault.file, settings);
    expect(draft.per100g.caloriesPer100g).toBe(200);
    expect(figures(draft.per100g.macronutrients)).toEqual({ fat: 9 });
  });

  it('removes a list somebody has emptied rather than writing an empty one', async () => {
    const vault = vaultWith(CASARECCE);
    const draft = await readMealDraft(vault.app, vault.file, settings);
    draft.per100g.micronutrients = [];
    await writeMealDraft(vault.app, vault.file, settings, draft);

    expect(Object.keys(vault.frontmatter())).not.toContain('micronutrients');
  });

  it('leaves out a row nobody named', async () => {
    // The row the form adds before somebody has chosen a nutrient. It is the
    // nutrient that makes a row mean anything, so an unnamed one is not written.
    const vault = vaultWith(CASARECCE);
    const draft = await readMealDraft(vault.app, vault.file, settings);
    draft.per100g.macronutrients = [blankEntry(''), blankEntry('fat')];
    await writeMealDraft(vault.app, vault.file, settings, draft);

    expect(vault.frontmatter().macronutrients).toEqual([{ name: 'fat', unit: 'g' }]);
  });
});

describe('the form as somebody builds a breakdown', () => {
  const emptyTotals = { calories: null, protein: null, fat: null, carbs: null };

  it('starts a new meal with the six a declaration carries, in the regulation order', () => {
    const seeded = seedBreakdown(emptyTotals, null);

    expect(seeded.macronutrients.map((entry) => entry.name)).toEqual([
      'fat',
      'saturatedFat',
      'carbs',
      'sugar',
      'fibre',
      'protein',
    ]);
    // Names with no figures. A list somebody has to build a row at a time before
    // typing a number is a list nobody fills in.
    expect(seeded.macronutrients.every((entry) => entry.value === null)).toBe(true);
    expect(seeded.macronutrients.every((entry) => entry.unit === 'g')).toBe(true);
  });

  it('starts the micronutrients with salt and nothing else', () => {
    // The one micronutrient a label must declare, and the row almost every meal
    // in this vault already carries. Seeding the rest of Annex XIII would put
    // twenty-eight blank vitamins into a note.
    expect(seedBreakdown(emptyTotals, null).micronutrients).toEqual([
      { name: 'salt', unit: 'g', value: null },
    ]);
  });

  it('seeds from what was typed and the serving weight', () => {
    const seeded = seedBreakdown({ calories: 585.2, protein: 32, fat: 12, carbs: 92 }, 440);

    expect(seeded.caloriesPer100g).toBe(133);
    expect(seeded.macronutrients.find((entry) => entry.name === 'protein')?.value).toBe(7.27);
    expect(seeded.macronutrients.find((entry) => entry.name === 'sugar')?.value).toBeNull();
  });

  it('seeds nothing at all without a serving weight to divide by', () => {
    const seeded = seedBreakdown({ calories: 585.2, protein: 32, fat: 12, carbs: 92 }, null);

    expect(seeded.caloriesPer100g).toBeNull();
    expect(seeded.macronutrients.every((entry) => entry.value === null)).toBe(true);
  });

  it('resolves a typed name to the id the note is written in', () => {
    // Whatever a person types, in either language and in either wording.
    expect(renamedEntry(blankEntry(''), 'Fett').name).toBe('fat');
    expect(renamedEntry(blankEntry(''), 'of which sugars').name).toBe('sugar');
    expect(renamedEntry(blankEntry(''), '  Vitamin B1 ').name).toBe('thiamin');
  });

  it('keeps a name it does not know, exactly as it was typed', () => {
    expect(renamedEntry(blankEntry(''), 'Kreatin').name).toBe('Kreatin');
  });

  it('fills the unit in from the nutrient, and never over one already there', () => {
    expect(renamedEntry(blankEntry(''), 'Iron').unit).toBe('mg');
    // A packet stating iron in micrograms is a packet, not a mistake, and a unit
    // replaced by the usual one is a figure out by a factor of a thousand.
    expect(renamedEntry({ name: 'iron', unit: 'µg', value: 40 }, 'Iron').unit).toBe('µg');
    // Nothing to suggest for a nutrient the table does not know.
    expect(renamedEntry(blankEntry(''), 'Kreatin').unit).toBe('');
  });

  it('suggests only the nutrients the list has not got', () => {
    const entries = [blankEntry('fat'), blankEntry('protein')];

    expect(unusedNutrientIds(['fat', 'saturatedFat', 'protein'], entries)).toEqual([
      'saturatedFat',
    ]);
  });
});

describe('a meal with no breakdown', () => {
  it('writes what was typed and derives nothing', async () => {
    const vault = vaultWith(`---\ntype: meal\n---\n\nmit Pilzen\n`);
    const draft: MealDraft = {
      ...(await readMealDraft(vault.app, vault.file, settings)),
      totals: { calories: 585, protein: 32, fat: 12, carbs: 92 },
    };
    await writeMealDraft(vault.app, vault.file, settings, draft);

    const frontmatter = vault.frontmatter();
    expect(frontmatter.calories).toBe(585);
    expect(frontmatter.protein).toBe(32);
    // No per-100 g properties are invented from them: the note has no serving
    // weight and nothing to state per 100 g.
    expect(Object.keys(frontmatter)).not.toContain('caloriesPer100g');
    expect(Object.keys(frontmatter)).not.toContain('macronutrients');
  });

  it('leaves the body alone entirely', async () => {
    const vault = vaultWith(`---\ntype: meal\n---\n\nmit Pilzen\n\n# Reheating\n\n- Steamer\n`);
    const draft = await readMealDraft(vault.app, vault.file, settings);
    await writeMealDraft(vault.app, vault.file, settings, draft);

    expect(vault.body()).toContain('# Reheating\n\n- Steamer');
  });
});
