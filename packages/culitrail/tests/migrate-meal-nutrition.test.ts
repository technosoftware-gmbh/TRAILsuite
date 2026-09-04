/**
 * The vault migration: the two per-100 g body sections into the frontmatter
 * lists that replaced them.
 *
 * This is the one change in the refactor that edits somebody's notes rather
 * than the code that reads them, so what is pinned here is mostly what the
 * script must **not** do. It must not recompute a per-serving figure, because
 * those are already right and a note whose serving weight was corrected by hand
 * would have its label quietly rewritten. It must not touch a line it did not
 * come for. It must leave a note it cannot understand exactly as it found it and
 * say so. And it must be safe to run twice, because the first run is a dry run
 * and the second is the real one.
 *
 * **Every fixture is a real meal, copied byte for byte out of the vault this
 * plugin was built against**, and the derived ones are derived from those by a
 * visible transformation rather than typed out. A hand-written fixture agrees
 * with whatever the code does.
 *
 * - `Federkohlrisotto` carries the blank `- **Sodium:** ` row that 105 of the
 *   126 meals with a label carry: a nutrient named without a figure.
 * - `Grüne Casarecce mit Poulet` states a salt figure and carries a Reheating
 *   section under the two being removed, which is what says whether the surgery
 *   is as narrow as it claims.
 * - `Lamm Tikka Masala` writes its rows without bold markers and without a blank
 *   line under the heading, which is the shape a note somebody tidied by hand
 *   ends up in.
 * - `Mediterrane Shrimpspfanne mit Couscous` is the one meal in the vault with
 *   no label at all.
 * - The order note is a real note from `Eating/Orders`, standing in for anything
 *   that is not a meal and happens to be in the folder.
 *
 * One line is missing from the three that carried it: `default_serving_size`,
 * which said the same as `serving_size` and was read by nothing.
 * `scripts/strip-default-serving-size.ts` takes it off real notes, so a fixture
 * that kept it would be a copy of a vault that no longer exists.
 */
import { describe, expect, it } from 'vitest';
import { parseLegacyPer100gSections } from 'trail-core';
import { extractSection } from '../src/meals/parser/body-sections';
import { readPer100g } from '../src/meals/parser/per100g';
import { mergeSettings } from '../src/settings/validate';
import { planNoteMigration } from '../scripts/migrate-meal-nutrition';
import { unifiedDiff } from '../scripts/note-diff';
import { frontmatterOf, parseFrontmatter } from '../scripts/note-text';
import { verifyNote } from '../scripts/verify-meal-nutrition';

const settings = mergeSettings({});

// Verbatim. The trailing space after `- **Sodium:**` is what the old writer
// emitted for an unmeasured field, and it is the whole point of this fixture:
// a nutrient the note names without stating. Do not tidy it away.
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

// Verbatim. No bold markers, no blank line under either heading, and two blank
// lines above the first one.
const LAMM = `---
type: meal
image: Eating/Meals/_resources/LammTikkaMasala.jpg
source: manual_source
servings: 1
prepTime:
reheatTime:
totalTime:
calories: 621
kj: 2592
protein: 29.7
fat: 18.9
carbs: 77.85
serving_size: 450g
diet: Fleisch
icon: ph-fork-knife
created: "2026-08-02T10:37"
modified: "2026-08-04T13:36"
---


# Nutritional Information (Per 100g)
- Calories: 138 kcal
- Energy: 576 kJ
- Protein: 6.6g
- Fat: 4.2g
- Carbs: 17.3g

# Micronutrient Information (Per 100g)
- Sodium: 1g
- Sugar: 3g
- Saturated Fat: 1.6g
`;

// Verbatim. The one meal in the vault that states no label at all, and whose
// per-serving properties are empty as well.
const SHRIMPSPFANNE = `---
type: meal
image: Eating/Meals/_resources/MediterraneShrimpspfannemitCouscous.png
created: "2026-08-14T15:19"
prepTime:
reheatTime:
totalTime:
servings:
diet: Fisch
supplier: "[[TomTasty AG]]"
modified: "2026-08-14T15:23"
calories:
protein:
fat:
carbs:
price: 18
---
`;

// Verbatim, out of `Eating/Orders`. Anything that is not a meal, including one
// that has wandered into the meals folder.
const ORDER = `---
type: order
company: "[[TomTasty AG]]"
orderDate: 2025-06-05
deliveryDate: 2025-06-11
price: 71
priceCurrency: CHF
selections:
  - person: "[[Erika Muster]]"
    meals:
      - "[[Bündner Pizokel mit Gemüse ⚖️]]"
      - "[[Satay Chicken mit Jasminreis ⚖️]]"
  - person: "[[Stefan Muster]]"
    meals:
      - "[[Älpler Magronen mit Speck]]"
      - "[[Satay Chicken mit Jasminreis ⚖️]]"
icon: shopping-cart
created: "2026-08-02T10:37"
modified: "2026-08-04T13:35"
---
`;

/**
 * The same real note with every figure taken out of its rows.
 *
 * Derived from the fixture rather than typed, so it stays the same note in the
 * same shape with one thing changed. No meal in the vault is in this state and
 * one could be tomorrow: the old writer emitted a blank row on purpose, and a
 * note whose label nobody has filled in yet is all blank rows.
 */
const ALL_BLANK = FEDERKOHLRISOTTO.replace(/^(- \*\*[^*]+:\*\*).*$/gm, '$1 ');

/**
 * The same real note with three more body sections, one of them between the two
 * that are being removed.
 *
 * The vault has exactly one note with a section beyond the two, so this is the
 * only fixture here that adds anything. It adds it to a real note rather than
 * inventing a whole one, and what it adds is the shape that would break a
 * careless removal: `# Notes` sits directly under the first section, so a
 * remover that ran to the next heading of *any* level would be fine and one
 * that ran to the end of the note would eat it.
 */
const WITH_SECTIONS = FEDERKOHLRISOTTO.replace(
  '# Micronutrient Information (Per 100g)',
  ['# Notes', '', 'Sbrinz statt Parmesan.', '', '# Micronutrient Information (Per 100g)'].join('\n')
).concat('\n# Eating History\n\n- 2026-03-02\n');

/** The block's own lines, fences excluded. */
function header(note: string): string[] {
  const block = frontmatterOf(note);
  return block ? block.lines.slice(1, block.close) : [];
}

function body(note: string): string[] {
  return frontmatterOf(note)?.body ?? [];
}

function frontmatter(note: string): Record<string, unknown> {
  return parseFrontmatter(frontmatterOf(note)?.yaml ?? '') ?? {};
}

function migrated(note: string): string {
  return planNoteMigration(note, settings).text;
}

/**
 * The note a half-run migration leaves: the properties written, the sections
 * still there.
 *
 * Built by taking what the migration adds to the block and putting it into the
 * untouched note, so the "both" state is the real one rather than an
 * approximation of it. That the added lines are exactly the tail of the new
 * block is asserted on its own below.
 */
function bothStates(note: string): string {
  const added = header(migrated(note)).slice(header(note).length);
  const block = frontmatterOf(note);
  if (!block) throw new Error('the fixture has no frontmatter');

  const lines = block.lines.slice();
  lines.splice(block.close, 0, ...added);
  return lines.join('\n');
}

/**
 * The lines of a diff that carry one marker, marker stripped.
 *
 * The two file lines come off first rather than being filtered out by their
 * shape: a removed line reading `- **Sodium:** ` starts with `--` once its
 * marker is on, and a filter that took that for a header would drop the row
 * this suite is most interested in.
 */
function diffLines(diff: string, marker: '+' | '-'): string[] {
  return diff
    .split('\n')
    .slice(2)
    .filter((line) => line.startsWith(marker))
    .map((line) => line.slice(1));
}

describe('the five states a vault is in', () => {
  it('converts a note that keeps its breakdown in the two sections', () => {
    const plan = planNoteMigration(FEDERKOHLRISOTTO, settings);

    expect(plan.state).toBe('converted');
    expect(plan.added).toEqual([
      'caloriesPer100g',
      'kjPer100g',
      'macronutrients',
      'micronutrients',
    ]);
    expect(extractSection(body(plan.text), settings.nutritionHeading).exists).toBe(false);
    expect(extractSection(body(plan.text), settings.micronutrientHeading).exists).toBe(false);
  });

  it('removes the sections only when the frontmatter already states the breakdown', () => {
    const note = bothStates(FEDERKOHLRISOTTO);
    const plan = planNoteMigration(note, settings);

    expect(plan.state).toBe('sections-removed');
    expect(plan.added).toEqual([]);
    // The frontmatter won, so not one line of it moves.
    expect(header(plan.text)).toEqual(header(note));
    expect(extractSection(body(plan.text), settings.nutritionHeading).exists).toBe(false);
  });

  it('leaves a note that has already been converted exactly as it is', () => {
    const converted = migrated(FEDERKOHLRISOTTO);
    const plan = planNoteMigration(converted, settings);

    expect(plan.state).toBe('already-converted');
    expect(plan.text).toBe(converted);
  });

  it('leaves a note that states no breakdown in either place untouched', () => {
    const plan = planNoteMigration(SHRIMPSPFANNE, settings);

    expect(plan.state).toBe('skipped');
    expect(plan.detail).toBe('no per-100 g breakdown in either place');
    expect(plan.text).toBe(SHRIMPSPFANNE);
  });

  it('leaves a note that is not a meal alone, sections or no sections', () => {
    expect(planNoteMigration(ORDER, settings).state).toBe('skipped');
    expect(planNoteMigration(ORDER, settings).text).toBe(ORDER);

    // The same meal, retyped. It is the type property that decides, not the
    // presence of two headings the note happens to carry.
    const notAMeal = FEDERKOHLRISOTTO.replace('type: meal', 'type: order');
    expect(planNoteMigration(notAMeal, settings).state).toBe('skipped');
    expect(planNoteMigration(notAMeal, settings).text).toBe(notAMeal);
  });
});

describe('what the conversion writes', () => {
  it('reads back through the plugin as the sections read', () => {
    for (const note of [FEDERKOHLRISOTTO, CASARECCE, LAMM]) {
      const was = parseLegacyPer100gSections(
        extractSection(body(note), settings.nutritionHeading).content,
        extractSection(body(note), settings.micronutrientHeading).content
      );
      const converted = migrated(note);

      expect(readPer100g(frontmatter(converted), settings, body(converted)).per100g).toEqual(was);
    }
  });

  it('keeps a named-but-unmeasured nutrient as a row with no figure', () => {
    const converted = migrated(FEDERKOHLRISOTTO);
    const salt = frontmatter(converted).micronutrients as Record<string, unknown>[];

    // The blank `- **Sodium:** ` row survives as a row. A migration that dropped
    // it would lose the fact that this note names salt at all, which is a
    // different note from one that never mentioned it.
    expect(salt).toEqual([{ name: 'salt', unit: 'g' }]);
    expect(JSON.stringify(salt)).not.toContain('value');
  });

  it('converts a note whose rows are all present and all blank', () => {
    const plan = planNoteMigration(ALL_BLANK, settings);

    expect(plan.state).toBe('converted');
    // No energy figure was stated, so no energy property is invented; every
    // nutrient the sections named is kept, with nothing after its name.
    expect(plan.added).toEqual(['macronutrients', 'micronutrients']);
    expect(frontmatter(plan.text).macronutrients).toEqual([
      { name: 'fat', unit: 'g' },
      { name: 'saturatedFat', unit: 'g' },
      { name: 'carbs', unit: 'g' },
      { name: 'sugar', unit: 'g' },
      { name: 'protein', unit: 'g' },
    ]);
    expect(frontmatter(plan.text).micronutrients).toEqual([{ name: 'salt', unit: 'g' }]);
  });

  it('moves nothing between the two lists beyond what the legacy bridge does', () => {
    const converted = migrated(CASARECCE);
    const macros = frontmatter(converted).macronutrients as { name: string }[];
    const micros = frontmatter(converted).micronutrients as { name: string }[];

    // Sugar and saturated fat sat under the micronutrient heading and are
    // macronutrients; salt is the one micronutrient. That correction is the
    // bridge's, and this asserts the script let it happen rather than doing it
    // again or undoing it.
    expect(macros.map((entry) => entry.name)).toEqual([
      'fat',
      'saturatedFat',
      'carbs',
      'sugar',
      'protein',
    ]);
    expect(micros.map((entry) => entry.name)).toEqual(['salt']);
  });

  it('relabels the old Sodium row as salt without converting the figure', () => {
    const micros = frontmatter(migrated(CASARECCE)).micronutrients as Record<string, unknown>[];
    expect(micros).toEqual([{ name: 'salt', unit: 'g', value: 1 }]);
  });

  it('adds its keys at the end of the block and moves nothing above them', () => {
    const before = header(FEDERKOHLRISOTTO);
    const after = header(migrated(FEDERKOHLRISOTTO));

    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.length).toBeGreaterThan(before.length);
  });
});

describe('what it must not touch', () => {
  it('leaves the per-serving figures exactly as they are', () => {
    const perServing = ['calories:', 'kj:', 'protein:', 'fat:', 'carbs:', 'serving_size:'];
    const stated = (note: string): string[] =>
      header(note).filter((line) => perServing.some((key) => line.startsWith(key)));

    expect(stated(migrated(FEDERKOHLRISOTTO))).toEqual(stated(FEDERKOHLRISOTTO));
  });

  it('does not recompute a per-serving figure from a serving weight somebody edited', () => {
    // 137 kcal per 100 g over 400 g is 548, and this note says 575.4, because
    // the weight was 420 g when the label was typed in. A migration that
    // recomputed would overwrite a figure nobody asked it to touch, and the
    // note would look measured either way.
    const edited = FEDERKOHLRISOTTO.replace('serving_size: 420g', 'serving_size: 400g');
    const converted = migrated(edited);

    expect(header(converted)).toContain('calories: 575.4');
    expect(header(converted)).toContain('serving_size: 400g');
    expect(header(converted)).not.toContain('calories: 548');
  });

  it('leaves every other section of the body byte for byte', () => {
    const converted = migrated(CASARECCE);

    expect(converted).toContain('\n# Reheating\n\n## Steamer\n[temp:: 95 °C] [time:: 25 min]\n');
    expect(body(converted).join('\n')).toBe(
      '\n# Reheating\n\n## Steamer\n[temp:: 95 °C] [time:: 25 min]\n'
    );
  });

  it('leaves a section sitting between the two it removes', () => {
    const converted = migrated(WITH_SECTIONS);

    expect(body(converted).join('\n')).toBe(
      [
        '',
        'mit gebratenen Pilzen und Sbrinz',
        '',
        '# Notes',
        '',
        'Sbrinz statt Parmesan.',
        '',
        '# Eating History',
        '',
        '- 2026-03-02',
        '',
      ].join('\n')
    );
  });

  it('changes nothing in the body but the two sections, and nothing in the block but the four keys', () => {
    // The verifier's whole job, run over every fixture: the block up to the
    // added keys is the block it was, line for line, and the body is the body
    // it was with the two sections taken out.
    for (const note of [FEDERKOHLRISOTTO, CASARECCE, LAMM, WITH_SECTIONS, ALL_BLANK]) {
      const converted = migrated(note);

      expect(header(converted).slice(0, header(note).length)).toEqual(header(note));
      expect(verifyNote(converted, note, settings)).toEqual([]);
    }
  });
});

describe('running it twice', () => {
  it('is a no-op the second time, for every fixture', () => {
    for (const note of [
      FEDERKOHLRISOTTO,
      CASARECCE,
      LAMM,
      SHRIMPSPFANNE,
      ORDER,
      ALL_BLANK,
      WITH_SECTIONS,
      bothStates(CASARECCE),
    ]) {
      const once = migrated(note);
      const twice = planNoteMigration(once, settings);

      expect(twice.text).toBe(once);
      expect(twice.state).not.toBe('converted');
      expect(twice.state).not.toBe('sections-removed');
      expect(twice.state).not.toBe('failed');
    }
  });

  it('reports a note it converted as already converted, not as converted again', () => {
    expect(planNoteMigration(migrated(LAMM), settings).state).toBe('already-converted');
    expect(planNoteMigration(migrated(bothStates(CASARECCE)), settings).state).toBe(
      'already-converted'
    );
  });
});

describe('what it refuses', () => {
  it('leaves a note whose frontmatter does not parse alone, and says so', () => {
    const broken = FEDERKOHLRISOTTO.replace('diet: Vegetarisch', 'diet: [Vegetarisch');
    const plan = planNoteMigration(broken, settings);

    expect(plan.state).toBe('failed');
    expect(plan.detail).toBe('the frontmatter does not parse');
    expect(plan.text).toBe(broken);
  });

  it('refuses a note that already carries one of the four keys with something else in it', () => {
    // An empty list reads as no entries, so the note is not "already
    // converted", and writing a second `macronutrients:` would leave a
    // duplicate key. Obsidian rejects a note with one outright.
    const clashing = FEDERKOHLRISOTTO.replace(
      'diet: Vegetarisch',
      'macronutrients: []\ndiet: Vegetarisch'
    );
    const plan = planNoteMigration(clashing, settings);

    expect(plan.state).toBe('failed');
    expect(plan.detail).toBe('the note already states macronutrients');
    expect(plan.text).toBe(clashing);
  });

  it('refuses a key the note spells in another case', () => {
    const clashing = FEDERKOHLRISOTTO.replace('diet: Vegetarisch', 'Macronutrients: []\ndiet: X');
    expect(planNoteMigration(clashing, settings).state).toBe('failed');
  });

  it('leaves a note with no frontmatter block alone', () => {
    const bare = '# Nutritional Information (Per 100g)\n\n- **Calories:** 100 kcal\n';
    const plan = planNoteMigration(bare, settings);

    expect(plan.state).toBe('skipped');
    expect(plan.text).toBe(bare);
  });
});

describe('the dry run', () => {
  it('shows the keys it would add and the sections it would remove', () => {
    const diff = unifiedDiff(FEDERKOHLRISOTTO, migrated(FEDERKOHLRISOTTO), 'Federkohlrisotto.md');

    expect(diffLines(diff, '+')).toContain('caloriesPer100g: 137');
    expect(diffLines(diff, '+')).toContain('  - name: salt');
    expect(diffLines(diff, '-')).toContain('# Nutritional Information (Per 100g)');
    expect(diffLines(diff, '-')).toContain('- **Sodium:** ');
    expect(diff.startsWith('--- a/Federkohlrisotto.md\n+++ b/Federkohlrisotto.md\n@@ ')).toBe(true);
  });

  it('shows nothing for a note it would not change', () => {
    expect(unifiedDiff(SHRIMPSPFANNE, SHRIMPSPFANNE, 'x.md')).toBe('');
  });

  it('applies each line of the diff back onto the original', () => {
    // A diff nobody can apply is a diff nobody should trust. The removals and
    // the context, in order, are the note as it was.
    const converted = migrated(CASARECCE);
    const diff = unifiedDiff(CASARECCE, converted, 'x.md');

    const context = diff
      .split('\n')
      .filter((line) => line.startsWith(' ') || line.startsWith('-'))
      .filter((line) => !line.startsWith('--- '));
    for (const line of context) expect(CASARECCE.split('\n')).toContain(line.slice(1));
  });
});

describe('the verifier', () => {
  it('passes every fixture the migration wrote', () => {
    for (const note of [FEDERKOHLRISOTTO, CASARECCE, LAMM, ALL_BLANK, WITH_SECTIONS]) {
      expect(verifyNote(migrated(note), note, settings)).toEqual([]);
    }
  });

  it('passes a migrated note with no copy of the original to compare with', () => {
    expect(verifyNote(migrated(CASARECCE), null, settings)).toEqual([]);
  });

  it('fails when a legacy section survived', () => {
    const problems = verifyNote(
      `${migrated(CASARECCE)}\n# Micronutrient Information (Per 100g)\n\n- **Sodium:** 1g\n`,
      CASARECCE,
      settings
    );

    expect(problems).toContain('the Micronutrient Information (Per 100g) section survived');
  });

  it('fails when a per-serving figure changed', () => {
    const tampered = migrated(CASARECCE).replace('calories: 646.8', 'calories: 647');
    expect(verifyNote(tampered, CASARECCE, settings)).toContain('the per-serving calories changed');
  });

  it('fails when any other line in the block moved', () => {
    const tampered = migrated(CASARECCE).replace('diet: Fleisch', 'diet: Fisch');
    expect(verifyNote(tampered, CASARECCE, settings)).toContain(
      'the frontmatter changed beyond the properties this adds'
    );
  });

  it('fails when any other line in the body moved', () => {
    const tampered = migrated(CASARECCE).replace('[temp:: 95 °C]', '[temp:: 90 °C]');
    expect(verifyNote(tampered, CASARECCE, settings)).toContain(
      'the body changed beyond the two sections this removes'
    );
  });

  it('fails when the breakdown does not read back as what it was', () => {
    const tampered = migrated(CASARECCE).replace('value: 4.5', 'value: 4.6');
    const problems = verifyNote(tampered, CASARECCE, settings);

    expect(problems.some((problem) => problem.startsWith('the breakdown changed'))).toBe(true);
  });

  it('fails on a duplicate frontmatter key, which a YAML parser would not', () => {
    const tampered = migrated(CASARECCE).replace('price: 17', 'price: 17\nprice: 18');
    expect(verifyNote(tampered, null, settings)).toContain('duplicate frontmatter key price');
  });

  it('fails when a note was never migrated at all', () => {
    const problems = verifyNote(CASARECCE, CASARECCE, settings);

    expect(problems).toContain('the Nutritional Information (Per 100g) section survived');
    expect(problems).toContain('the Micronutrient Information (Per 100g) section survived');
  });
});

describe('the headings are options, not constants', () => {
  it('reads and removes whatever headings the vault settings name', () => {
    const german = mergeSettings({
      nutritionHeading: 'Nährwerte (pro 100g)',
      micronutrientHeading: 'Mikronährstoffe (pro 100g)',
    });
    const note = FEDERKOHLRISOTTO.replace(
      '# Nutritional Information (Per 100g)',
      '# Nährwerte (pro 100g)'
    ).replace('# Micronutrient Information (Per 100g)', '# Mikronährstoffe (pro 100g)');

    const plan = planNoteMigration(note, german);

    expect(plan.state).toBe('converted');
    expect(plan.text).not.toContain('Nährwerte (pro 100g)');
    expect(frontmatter(plan.text).caloriesPer100g).toBe(137);

    // The shipped headings find nothing in that note, which is the other half of
    // the same claim: the script reads the setting rather than a constant.
    expect(planNoteMigration(note, settings).state).toBe('skipped');
  });
});
