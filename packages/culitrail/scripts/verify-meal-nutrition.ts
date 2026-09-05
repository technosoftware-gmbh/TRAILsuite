/**
 * Checks a migrated vault, and checks it against the one it was migrated from.
 *
 * Separate from the migration on purpose, the way `verify-plan-notes.ts` is
 * separate from `convert-plan-notes.ts`. That one decides what a note should
 * become; this one reads the note that came out and asks whether it says what
 * it used to say. It catches what the first cannot: a note that failed to be
 * written, a value the serialiser wrote ambiguously, a section that survived
 * because a heading was spelled differently, an edit to a line nobody meant to
 * touch.
 *
 *   npx tsx scripts/verify-meal-nutrition.ts --vault <path> [--before <path>]
 *       [--folder Eating/Meals]
 *       [--nutrition-heading '<heading>'] [--micronutrient-heading '<heading>']
 *
 * With `--before` pointing at a copy of the vault as it was, five things are
 * asserted per note. Without it, the three that a migrated note can answer on
 * its own are, which is what makes it runnable on a vault whose backup has
 * already gone.
 *
 * | check | needs `--before` |
 * | --- | --- |
 * | no legacy section survives | no |
 * | the frontmatter lists round trip through the writer and the reader | no |
 * | no duplicate frontmatter key | no |
 * | the breakdown reads back as the same model it read as before | yes |
 * | the per-serving figures are byte for byte what they were | yes |
 * | nothing outside the four keys and the two sections moved | yes |
 *
 * **The last check is the one worth explaining.** It does not re-run the
 * migration and compare, which would only ever assert that the script agrees
 * with itself. It takes the two sections out of the *before* note and compares
 * the body with the after note's, byte for byte, and it takes the four added
 * keys out of the *after* note's header and compares that with the before
 * note's, line for line. Anything the migration did beyond those two edits
 * shows up as a mismatch, including whitespace.
 *
 * Pass or fail is the exit code: 0 with no problem, 1 with any.
 *
 * Not shipped with the plugin. It runs once per vault, from a terminal.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  matchesType,
  nutrientListValue,
  readNutrientList,
  removeSection,
  type MealNutritionPer100g,
} from '@technosoftware/trail-core';
import { nutrientFieldNames } from '../src/meals/nutrient-fields';
import { extractSection } from '../src/meals/parser/body-sections';
import { readPer100g } from '../src/meals/parser/per100g';
import type { CULItrailSettings } from '../src/settings/types';
import { mergeSettings } from '../src/settings/validate';
import { frontmatterOf, headerKeys, parseFrontmatter } from './note-text';

/** The four keys the migration is allowed to have added. */
function addedProperties(settings: CULItrailSettings): string[] {
  return [
    settings.caloriesPer100gProperty,
    settings.kjPer100gProperty,
    settings.macronutrientsProperty,
    settings.micronutrientsProperty,
  ].filter(Boolean);
}

/**
 * A header with some of its keys taken out, key and continuation lines both.
 *
 * The inverse of what the migration inserted, done on the lines rather than on
 * a parsed object, so what is compared afterwards is the text the vault
 * actually holds and not a normalised version of it. A continuation line is an
 * indented one, which is what a list of maps is made of.
 */
function withoutKeys(yaml: string, keys: string[]): string[] {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const lines = yaml === '' ? [] : yaml.split('\n');
  const kept: string[] = [];

  let dropping = false;
  for (const line of lines) {
    const key = /^([^\s#][^:]*):/.exec(line)?.[1]?.trim();
    if (key !== undefined) dropping = wanted.has(key.toLowerCase());
    else if (!/^\s/.test(line)) dropping = false;

    if (!dropping) kept.push(line);
  }

  return kept;
}

/** True when this note is one the migration would have looked at. */
export function isMealNote(text: string, settings: CULItrailSettings): boolean {
  const block = frontmatterOf(text);
  if (!block) return false;

  const frontmatter = parseFrontmatter(block.yaml);
  if (frontmatter === null) return false;

  return matchesType(frontmatter, settings.typePropertyName, settings.mealTypeValue);
}

/** The two lists, written and read straight back, which is the round trip. */
function roundTrips(per100g: MealNutritionPer100g, settings: CULItrailSettings): boolean {
  const fields = nutrientFieldNames(settings);
  const again = (entries: MealNutritionPer100g['macronutrients']): boolean =>
    JSON.stringify(readNutrientList(nutrientListValue(entries, fields), fields)) ===
    JSON.stringify(entries);

  return again(per100g.macronutrients) && again(per100g.micronutrients);
}

/**
 * Everything wrong with one migrated note, as sentences.
 *
 * `before` is the same note as it was, or null when there is no copy to compare
 * with. Pure, so the checks are testable without two vaults on disk.
 */
export function verifyNote(
  after: string,
  before: string | null,
  settings: CULItrailSettings
): string[] {
  const problems: string[] = [];

  const block = frontmatterOf(after);
  if (!block) return ['no frontmatter block'];

  // Before the parse rather than after it, so a duplicate key is reported as a
  // duplicate key. This parser refuses one outright and would otherwise report
  // it as a block that does not parse, which is true and says nothing about
  // what to fix.
  const keys = headerKeys(block.yaml);
  const duplicate = keys.find((key, index) => keys.indexOf(key) !== index);
  if (duplicate) problems.push(`duplicate frontmatter key ${duplicate}`);

  const frontmatter = parseFrontmatter(block.yaml);
  if (frontmatter === null) return [...problems, 'the frontmatter does not parse'];

  for (const heading of [settings.nutritionHeading, settings.micronutrientHeading]) {
    if (extractSection(block.body, heading).exists)
      problems.push(`the ${heading} section survived`);
  }

  const reading = readPer100g(frontmatter, settings, block.body);
  if (!roundTrips(reading.per100g, settings)) {
    problems.push('the nutrient lists do not read back as what was written');
  }

  if (before === null) return problems;

  const was = frontmatterOf(before);
  if (!was) return [...problems, 'the note had no frontmatter block before'];

  const wasFrontmatter = parseFrontmatter(was.yaml);
  if (wasFrontmatter === null) return [...problems, 'the frontmatter did not parse before'];

  const wasReading = readPer100g(wasFrontmatter, settings, was.body);
  if (JSON.stringify(wasReading.per100g) !== JSON.stringify(reading.per100g)) {
    problems.push(
      `the breakdown changed\n  was ${JSON.stringify(wasReading.per100g)}\n  now ${JSON.stringify(reading.per100g)}`
    );
  }

  // Named separately from the header comparison below, which would also catch
  // it, because this is the figure a migration has no business touching and a
  // reader of the output should not have to work out which line moved.
  const perServing = [
    settings.caloriesProperty,
    settings.kjProperty,
    settings.proteinProperty,
    settings.fatProperty,
    settings.carbsProperty,
    settings.servingSizeProperty,
  ].filter(Boolean);

  for (const property of perServing) {
    const lineOf = (yaml: string): string[] =>
      yaml
        .split('\n')
        .filter((line) => line.toLowerCase().startsWith(`${property.toLowerCase()}:`));
    if (lineOf(was.yaml).join('\n') !== lineOf(block.yaml).join('\n')) {
      problems.push(`the per-serving ${property} changed`);
    }
  }

  const added = addedProperties(settings).filter(
    (key) => !headerKeys(was.yaml).some((had) => had.toLowerCase() === key.toLowerCase())
  );
  if (withoutKeys(block.yaml, added).join('\n') !== was.yaml) {
    problems.push('the frontmatter changed beyond the properties this adds');
  }

  const strippedBefore = removeSection(
    removeSection(before, settings.nutritionHeading),
    settings.micronutrientHeading
  );
  const wasBody = frontmatterOf(strippedBefore)?.body ?? [];
  if (wasBody.join('\n') !== block.body.join('\n')) {
    problems.push('the body changed beyond the two sections this removes');
  }

  return problems;
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
  const option = (name: string, fallback: string): string =>
    argv.includes(name) ? (argv[argv.indexOf(name) + 1] ?? fallback) : fallback;

  const vault = option('--vault', '');
  if (!vault) {
    console.error(
      'usage: verify-meal-nutrition.ts --vault <path> [--before <path>] [--folder <path>]' +
        ' [--nutrition-heading <heading>] [--micronutrient-heading <heading>]'
    );
    process.exit(2);
  }

  const before = option('--before', '');
  const defaults = mergeSettings({});
  const settings = mergeSettings({
    nutritionHeading: option('--nutrition-heading', defaults.nutritionHeading),
    micronutrientHeading: option('--micronutrient-heading', defaults.micronutrientHeading),
  });

  const folderName = option('--folder', settings.mealsFolder);
  const folder = join(vault, folderName);

  const problems: string[] = [];
  let notes = 0;
  let checked = 0;
  let withBreakdown = 0;

  for (const path of markdownFiles(folder)) {
    const key = relative(folder, path);
    const after = readFileSync(path, 'utf8');
    notes += 1;

    if (!isMealNote(after, settings)) continue;
    checked += 1;

    let source: string | null = null;
    if (before) {
      try {
        source = readFileSync(join(before, folderName, key), 'utf8');
      } catch {
        problems.push(`${key}: missing from the before vault`);
        continue;
      }
    }

    for (const problem of verifyNote(after, source, settings)) problems.push(`${key}: ${problem}`);

    const block = frontmatterOf(after);
    const frontmatter = block ? parseFrontmatter(block.yaml) : null;
    if (block && frontmatter && readPer100g(frontmatter, settings, block.body).stated) {
      withBreakdown += 1;
    }
  }

  console.log({
    notes,
    meals: checked,
    withBreakdown,
    comparedAgainst: before || 'nothing',
    problems: problems.length,
  });
  for (const problem of problems) console.log(problem);
  console.log(problems.length > 0 ? 'FAIL' : 'PASS');

  process.exit(problems.length > 0 ? 1 : 0);
}

// Only when run as a program, so the tests can import the checks above.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
