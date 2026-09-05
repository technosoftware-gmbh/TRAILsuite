/**
 * Moves a vault's meal notes from the two per-100 g body sections into the
 * frontmatter lists that replaced them.
 *
 * `# Nutritional Information (Per 100g)` and `# Micronutrient Information (Per
 * 100g)` were the only place a meal's label lived for years. They now live in
 * `caloriesPer100g`, `kjPer100g`, `macronutrients` and `micronutrients`, and a
 * note carrying both says the same thing twice in two places that drift apart
 * the first time somebody edits one of them. Opening a meal in the editor and
 * saving it already performs exactly this move; this is that save, for every
 * note at once, without the modal.
 *
 * **It imports the plugin's own reader and writer.** `readPer100g` decides what
 * a note says and where it says it, `parseLegacyPer100gSections` reads the two
 * sections and corrects the label the old format got wrong, `nutrientListValue`
 * builds the records, and `removeSection` takes the sections out. Not one of
 * those rules is restated here. A second implementation of the conversion,
 * living in a script nobody runs twice, is the one failure this file exists to
 * avoid: it would agree with the plugin on the day it was written and disagree
 * silently on every day after.
 *
 * **What it deliberately does not do:**
 *
 * - It does not recompute the per-serving figures. `calories`, `kj`, `protein`,
 *   `fat` and `carbs` are per serving, they are already right in every note
 *   this was built against, and they are left byte for byte. Recomputing them
 *   from the breakdown and the serving weight would look harmless and would
 *   silently rewrite the figures of any note whose weight somebody corrected by
 *   hand after the label was typed in.
 * - It never invents a serving weight, never converts a value into another
 *   unit, and never multiplies anything. The old `Sodium` label held grams of
 *   salt and is relabelled, not converted, and that correction happens inside
 *   `parseLegacyPer100gSections` rather than here.
 * - It does not sort or rearrange. `inNutrientOrder` is a render-time decision;
 *   a migration that wrote sorted lists would undo a reordering somebody made
 *   in the editor the next time they looked at the note.
 * - It does not rewrite the frontmatter block. The new keys are inserted as
 *   lines above the closing `---` and every other key keeps its own spelling,
 *   quoting and order, for the reason `strip-meal-rating.ts` gives next door: a
 *   YAML round trip reformats a whole block to change one key, and that turns a
 *   readable diff into an unreadable one.
 * - It does not touch a note that is not a meal, a note whose frontmatter does
 *   not parse, or a note that already states any of the four properties under a
 *   name it did not put there. Each of those is reported and left alone.
 *
 * Dry run by default, and the dry run prints a unified diff per note so a human
 * can read exactly what would change before anything is written. `--apply`
 * writes. Running it twice is a no-op the second time: a converted note states
 * its breakdown in frontmatter and carries no section to remove.
 *
 *   npx tsx scripts/migrate-meal-nutrition.ts --vault <path> [--apply]
 *       [--folder Eating/Meals] [--quiet]
 *       [--nutrition-heading '<heading>'] [--micronutrient-heading '<heading>']
 *
 * Not shipped with the plugin. It runs once per vault, from a terminal.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import {
  isEmptyMealNutrition,
  matchesType,
  nutrientListValue,
  removeSection,
  type MealNutritionPer100g,
} from '@technosoftware/trail-core';
import { nutrientFieldNames } from '../src/meals/nutrient-fields';
import { readPer100g } from '../src/meals/parser/per100g';
import type { CULItrailSettings } from '../src/settings/types';
import { mergeSettings } from '../src/settings/validate';
import { unifiedDiff } from './note-diff';
import { carriageReturn, frontmatterOf, parseFrontmatter } from './note-text';

/**
 * What happened to one note, and what could happen to it.
 *
 * The five states the vault is actually in, named as the report names them.
 * `sections-removed` is the note that carries both: its frontmatter already
 * won, so the only thing left to do is take the duplicate out.
 */
export type NoteState =
  'converted' | 'sections-removed' | 'already-converted' | 'skipped' | 'failed';

export interface NotePlan {
  state: NoteState;
  /**
   * The note as it would be written. Identical to the input, by reference, for
   * every state but `converted` and `sections-removed`, so a caller can compare
   * with `===` and know nothing moved.
   */
  text: string;
  /** Why it was skipped or what it failed on, in a few words. Empty otherwise. */
  detail: string;
  /** The property names this would add, in the order they are written. */
  added: string[];
}

/** A key the note already has, whatever case it spelled it in. */
function existingKey(frontmatter: Record<string, unknown>, name: string): string | null {
  const target = name.toLowerCase();
  return Object.keys(frontmatter).find((key) => key.toLowerCase() === target) ?? null;
}

/**
 * The four properties, in the order `write-draft.ts` assigns them.
 *
 * An energy figure is written only when the note stated one, and a list only
 * when it has entries. That is the editor's rule for the lists ("a meal that
 * names no micronutrient has not stated an empty set of them") extended to the
 * two scalars, which have no named-but-unmeasured state: a null there means
 * nobody wrote the figure, not that somebody wrote it blank. Adding
 * `caloriesPer100g:` with nothing after it to a note that never mentioned
 * energy would be this script inventing a field.
 */
export function per100gProperties(
  per100g: MealNutritionPer100g,
  settings: CULItrailSettings
): Record<string, unknown> {
  const fields = nutrientFieldNames(settings);
  const properties: Record<string, unknown> = {};

  const scalars = [
    { property: settings.caloriesPer100gProperty, value: per100g.caloriesPer100g },
    { property: settings.kjPer100gProperty, value: per100g.kjPer100g },
  ];
  for (const scalar of scalars) {
    if (scalar.property && scalar.value !== null) properties[scalar.property] = scalar.value;
  }

  const lists = [
    { property: settings.macronutrientsProperty, entries: per100g.macronutrients },
    { property: settings.micronutrientsProperty, entries: per100g.micronutrients },
  ];
  for (const list of lists) {
    if (!list.property) continue;
    const records = nutrientListValue(list.entries, fields);
    if (records.length > 0) properties[list.property] = records;
  }

  return properties;
}

/**
 * The new keys as frontmatter lines.
 *
 * `yaml` writes only the four keys, never the block they go into, so nothing
 * that was already in the note passes through a serialiser. Folding is switched
 * off: a wrapped value is still valid YAML and is unreadable in a diff. A line
 * going into a CRLF note carries its own `\r`, since every line around it does.
 */
function renderProperties(properties: Record<string, unknown>, crlf: boolean): string[] {
  const lines = stringifyYaml(properties, { lineWidth: 0 }).replace(/\n$/, '').split('\n');
  return crlf ? lines.map((line) => `${line}\r`) : lines;
}

/**
 * What the migration would do to one note, and the note it would leave behind.
 *
 * Pure: text in, text out, no file system and no settings beyond the ones
 * handed to it. Everything the CLI below does is this function plus reporting,
 * which is what makes the states testable without a vault.
 */
export function planNoteMigration(text: string, settings: CULItrailSettings): NotePlan {
  const unchanged = (state: NoteState, detail = ''): NotePlan => ({
    state,
    text,
    detail,
    added: [],
  });

  const block = frontmatterOf(text);
  // A note with no frontmatter block cannot be a meal: the type property is
  // what makes one, and the plugin's own reader would not see it either.
  if (!block) return unchanged('skipped', 'no frontmatter block');

  const frontmatter = parseFrontmatter(block.yaml);
  if (frontmatter === null) {
    return unchanged('failed', 'the frontmatter does not parse');
  }

  if (!matchesType(frontmatter, settings.typePropertyName, settings.mealTypeValue)) {
    return unchanged('skipped', `not a ${settings.mealTypeValue || 'meal'} note`);
  }

  const reading = readPer100g(frontmatter, settings, block.body);

  // No section to remove. Either the note has already been through this, or it
  // never stated a breakdown at all, and neither is something to do anything
  // about.
  if (!reading.legacy) {
    return reading.stated
      ? unchanged('already-converted')
      : unchanged('skipped', 'no per-100 g breakdown in either place');
  }

  const stripped = removeSection(
    removeSection(text, settings.nutritionHeading),
    settings.micronutrientHeading
  );

  // The frontmatter already won, so the sections are the duplicate and go
  // without anything being written. The same is true of a note whose sections
  // hold nothing the reader can find: there is no figure to move, and the
  // headings are then two empty claims.
  if (reading.stated || isEmptyMealNutrition(reading.per100g)) {
    return {
      state: 'sections-removed',
      text: stripped,
      detail: reading.stated
        ? 'the frontmatter already states the breakdown'
        : 'the sections state nothing this can read',
      added: [],
    };
  }

  const properties = per100gProperties(reading.per100g, settings);
  if (Object.keys(properties).length === 0) {
    return {
      state: 'sections-removed',
      text: stripped,
      detail: 'the sections state nothing this can write',
      added: [],
    };
  }

  // A key the note already carries, that this is about to write, with the
  // reader having found nothing under it. It holds something neither this nor
  // the plugin understands, so writing a second one would leave the note with a
  // duplicate key, and a note with one drops out of every view in Obsidian.
  // Refused rather than merged, the same rule `convert-plan-notes.ts` follows.
  const clash = Object.keys(properties).find((key) => existingKey(frontmatter, key) !== null);
  if (clash) return unchanged('failed', `the note already states ${clash}`);

  const lines = renderProperties(properties, carriageReturn(text));
  const at = frontmatterOf(stripped);
  // Unreachable: removing a body section cannot remove the frontmatter block.
  // Refused rather than asserted away, because a partial write is the one
  // outcome this script must never produce.
  if (!at) return unchanged('failed', 'the frontmatter block went missing');

  const written = at.lines.slice();
  written.splice(at.close, 0, ...lines);

  return {
    state: 'converted',
    text: written.join('\n'),
    detail: '',
    added: Object.keys(properties),
  };
}

/** Every Markdown file under a folder, recursively. */
function markdownFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...markdownFiles(path));
    else if (name.endsWith('.md')) found.push(path);
  }
  return found;
}

function main(): void {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const quiet = argv.includes('--quiet');

  const option = (name: string, fallback: string): string =>
    argv.includes(name) ? (argv[argv.indexOf(name) + 1] ?? fallback) : fallback;

  const usage =
    'usage: migrate-meal-nutrition.ts --vault <path> [--apply] [--folder <path>] [--quiet]' +
    ' [--nutrition-heading <heading>] [--micronutrient-heading <heading>]';

  const vault = option('--vault', '');
  if (!vault) {
    console.error(usage);
    process.exit(2);
  }

  const defaults = mergeSettings({});
  const settings = mergeSettings({
    nutritionHeading: option('--nutrition-heading', defaults.nutritionHeading),
    micronutrientHeading: option('--micronutrient-heading', defaults.micronutrientHeading),
  });

  const folder = join(vault, option('--folder', settings.mealsFolder));

  const counts: Record<NoteState, number> = {
    converted: 0,
    'sections-removed': 0,
    'already-converted': 0,
    skipped: 0,
    failed: 0,
  };
  const failures: string[] = [];
  const diffs: string[] = [];

  console.log(apply ? 'APPLIED' : 'DRY RUN, nothing written');
  console.log(`headings: ${settings.nutritionHeading} / ${settings.micronutrientHeading}`);
  console.log('');

  for (const path of markdownFiles(folder)) {
    const key = relative(vault, path);
    const text = readFileSync(path, 'utf8');
    const plan = planNoteMigration(text, settings);

    counts[plan.state] += 1;
    if (plan.state === 'failed') failures.push(`${key}: ${plan.detail}`);

    const changed = plan.text !== text;
    if (changed && apply) writeFileSync(path, plan.text, 'utf8');

    const note = [
      plan.state.padEnd(18),
      key,
      plan.added.length > 0 ? `  +${plan.added.join(' +')}` : '',
      plan.detail ? `  (${plan.detail})` : '',
    ].join('');
    console.log(note);

    // The diff belongs to the dry run: it is what somebody reads before
    // deciding, and reprinting it after the write says nothing new.
    if (changed && !apply && !quiet) diffs.push(unifiedDiff(text, plan.text, key));
  }

  for (const diff of diffs) console.log(`\n${diff}`);

  console.log('');
  console.log({
    notes: Object.values(counts).reduce((sum, count) => sum + count, 0),
    converted: counts.converted,
    sectionsRemovedOnly: counts['sections-removed'],
    alreadyConverted: counts['already-converted'],
    skipped: counts.skipped,
    failed: counts.failed,
  });
  for (const failure of failures) console.log('FAILED', failure);

  process.exit(counts.failed > 0 ? 1 : 0);
}

// Only when run as a program. The functions above are imported by the tests,
// which want the conversion without a vault being walked on import.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
