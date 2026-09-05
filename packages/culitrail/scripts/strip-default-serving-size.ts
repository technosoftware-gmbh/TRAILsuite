/**
 * Takes the `default_serving_size:` property off a vault's meal notes.
 *
 * The editor wrote it beside `serving_size` from the same number, and nothing
 * anywhere ever read it back: not a view, not a parser, not the editor that
 * wrote it. Two names for one weight is not redundancy that protects anything,
 * it is a second place for a reader to look and a second thing for a hand edit
 * to contradict, so the property is gone from the plugin and this takes it off
 * the notes that already carry it.
 *
 * **A script of its own rather than a flag on `migrate-meal-nutrition.ts`,**
 * which is the other script that edits these same notes. That one moves a
 * breakdown from the body into the frontmatter and its whole vocabulary is
 * about that move: `converted`, `sections-removed`, `already-converted`, and a
 * verifier next door whose central check is that nothing outside *the four keys
 * it adds* moved. A deletion folded into it would have to be exempted from that
 * check, which is the check the migration is trusted by. The two also have
 * different lifetimes: the nutrition move is a one-off that a migrated vault
 * has finished with, while this runs against a vault that has already been
 * through it. `strip-meal-rating.ts` next door is the precedent, and this is
 * the same job with a stricter refusal.
 *
 * **What it refuses to do is the point.** In the vault this was built against
 * the two properties agree in all 126 notes that carry them, so every refusal
 * below is for a note that does not exist yet. That is exactly why they are
 * here: a script that silently deletes the only weight a note carries is the
 * wrong script to leave lying around for the next vault, or for this one after
 * somebody edits a note by hand.
 *
 * - The value differs from `serving_size`: refused. `440g`, `440 g` and `440`
 *   are the same weight and are compared as one through the plugin's own
 *   `readGrams`, but `430g` beside `440g` is a disagreement somebody has to
 *   settle, and this is not somebody.
 * - `serving_size` is absent or blank while this one states a weight: refused.
 *   Removing it there would take the note's only serving weight with it.
 * - The note states it twice, or its value runs past one line: refused. A
 *   duplicate key drops a note out of every view in Obsidian and is worth
 *   naming rather than half-fixing; a multi-line value is some other property
 *   that happens to share the name.
 * - The frontmatter does not parse: refused, and nothing is written. A block
 *   nothing can read is a block nothing should touch.
 *
 * A blank `default_serving_size:` is removed whatever `serving_size` says,
 * including when that is blank too, which is the state of two real notes. An
 * empty property states nothing, so nothing is lost with it.
 *
 * Dry run by default, and the dry run prints a unified diff per note so a human
 * can read exactly what would change before anything is written. `--apply`
 * writes. Running it twice is a no-op the second time: the second run finds no
 * such key and reports every note as already stripped.
 *
 *   npx tsx scripts/strip-default-serving-size.ts --vault <path> [--apply]
 *       [--folder Eating/Meals] [--quiet] [--property default_serving_size]
 *
 * `--property` exists because this script is now the only place in the codebase
 * that knows the name: the setting that used to hold it has been removed, so a
 * vault that spelled it differently has nowhere else to say so.
 *
 * Not shipped with the plugin. It runs once per vault, from a terminal.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchesType, readString } from '@technosoftware/trail-core';
import { readGrams } from '../src/meals/parser/serving-size';
import type { CULItrailSettings } from '../src/settings/types';
import { mergeSettings } from '../src/settings/validate';
import { unifiedDiff } from './note-diff';
import { frontmatterOf, headerKeys, parseFrontmatter } from './note-text';

/** The name the plugin used to write, and no longer has a setting for. */
export const DEFAULT_SERVING_SIZE_PROPERTY = 'default_serving_size';

/**
 * What happened to one note.
 *
 * `already-stripped` covers both halves of "nothing to do": a note this has
 * been run over before and a note that never carried the property. They are
 * indistinguishable from the outside and the run does the same nothing to
 * either, so naming them apart would be an invented distinction.
 */
export type StripState = 'stripped' | 'already-stripped' | 'skipped' | 'failed';

export interface StripPlan {
  state: StripState;
  /**
   * The note as it would be written. Identical to the input, by reference, for
   * every state but `stripped`, so a caller can compare with `===` and know
   * nothing moved.
   */
  text: string;
  /** Why it was skipped or what it refused on, in a few words. Empty otherwise. */
  detail: string;
}

/** True for a value that states nothing: absent, null, or whitespace. */
function blank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const text = readString(value);
  return text !== null && text.trim() === '';
}

/**
 * Whether two serving weights are the same weight.
 *
 * Two tests rather than one, and both have to be satisfiable for the property
 * to go. `readGrams` is what makes `440g` and `440 g` one weight, which is the
 * whole reason a textual comparison is not enough. But it returns null for
 * anything it cannot read a number out of, and two unreadable values are not
 * thereby equal: `default_serving_size: eine Schale` beside
 * `serving_size: ein Teller` would compare null to null and lose a sentence
 * somebody wrote. So a pair that parses to the same number counts, and so does
 * a pair whose text is identical, and nothing else does.
 */
function sameWeight(left: unknown, right: unknown): boolean {
  const leftGrams = readGrams(left);
  const rightGrams = readGrams(right);
  if (leftGrams !== null && rightGrams !== null) return leftGrams === rightGrams;

  const leftText = readString(left);
  const rightText = readString(right);
  if (leftText !== null && rightText !== null) return leftText.trim() === rightText.trim();

  return false;
}

/**
 * What the strip would do to one note, and the note it would leave behind.
 *
 * Pure: text in, text out, no file system. Everything the CLI below does is
 * this function plus reporting, which is what makes every refusal testable
 * without a vault.
 *
 * Line-oriented, like every other script here. Parsing a block and writing it
 * back out reformats every key in it, which turns a one-line deletion into a
 * diff nobody can read and quietly overrules every quoting and ordering
 * decision the vault made. The parsed object decides *whether* the line goes;
 * the lines decide *which* line.
 */
export function planNoteStrip(
  text: string,
  settings: CULItrailSettings,
  property: string = DEFAULT_SERVING_SIZE_PROPERTY
): StripPlan {
  const unchanged = (state: StripState, detail = ''): StripPlan => ({ state, text, detail });

  const block = frontmatterOf(text);
  // A note with no frontmatter block cannot be a meal: the type property is
  // what makes one, and it has nowhere to carry the property either.
  if (!block) return unchanged('skipped', 'no frontmatter block');

  const frontmatter = parseFrontmatter(block.yaml);
  if (frontmatter === null) {
    // A duplicate key is why the parser refused, often enough to be worth
    // naming: the object cannot show it, the lines can, and `headerKeys` exists
    // for exactly this. Two `default_serving_size:` lines are not a note to
    // half-fix by taking one of them out, because the note is already invisible
    // in Obsidian and the fix is a human deciding which value is right.
    const duplicated = headerKeys(block.yaml).filter((key) => key === property).length > 1;
    return unchanged(
      'failed',
      duplicated ? `the note states ${property} twice` : 'the frontmatter does not parse'
    );
  }

  if (!matchesType(frontmatter, settings.typePropertyName, settings.mealTypeValue)) {
    return unchanged('skipped', `not a ${settings.mealTypeValue || 'meal'} note`);
  }

  if (!headerKeys(block.yaml).includes(property)) return unchanged('already-stripped');

  const at = block.lines.findIndex(
    (line, index) => index > 0 && index < block.close && line.startsWith(`${property}:`)
  );
  // Unreachable while `headerKeys` and this agree on what a top-level key looks
  // like. Refused rather than asserted away, because a wrong index here would
  // delete a line this script never came for.
  if (at === -1) return unchanged('failed', `${property} is stated but its line was not found`);

  // A continuation line is indented. One under the key means the value is a
  // block or a list, which a serving weight is not, so this is some other
  // property that happens to share the name. Asked before the values are
  // compared, so such a note is reported as what it is rather than as a
  // disagreement about a weight neither line states.
  if (/^\s/.test(block.lines[at + 1] ?? '')) {
    return unchanged('failed', 'the value is not a single line');
  }

  const value = frontmatter[property];
  const servingSize = frontmatter[settings.servingSizeProperty];

  // An empty property states nothing, so nothing goes with it. This is the
  // state of two real meals, whose serving weight is blank in both places.
  if (!blank(value)) {
    if (blank(servingSize)) {
      const how = settings.servingSizeProperty in frontmatter ? 'blank' : 'absent';
      return unchanged(
        'failed',
        `${settings.servingSizeProperty} is ${how} and this states a weight`
      );
    }
    if (!sameWeight(value, servingSize)) {
      return unchanged('failed', `it disagrees with ${settings.servingSizeProperty}`);
    }
  }

  return {
    state: 'stripped',
    text: [...block.lines.slice(0, at), ...block.lines.slice(at + 1)].join('\n'),
    detail: '',
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
    'usage: strip-default-serving-size.ts --vault <path> [--apply] [--folder <path>]' +
    ' [--quiet] [--property default_serving_size]';

  const vault = option('--vault', '');
  if (!vault) {
    console.error(usage);
    process.exit(2);
  }

  const settings = mergeSettings({});
  const property = option('--property', DEFAULT_SERVING_SIZE_PROPERTY);
  const folder = join(vault, option('--folder', settings.mealsFolder));

  const counts: Record<StripState, number> = {
    stripped: 0,
    'already-stripped': 0,
    skipped: 0,
    failed: 0,
  };
  const failures: string[] = [];
  const diffs: string[] = [];

  console.log(apply ? 'APPLIED' : 'DRY RUN, nothing written');
  console.log(`property: ${property}, compared against: ${settings.servingSizeProperty}`);
  console.log('');

  for (const path of markdownFiles(folder)) {
    const key = relative(vault, path);
    const text = readFileSync(path, 'utf8');
    const plan = planNoteStrip(text, settings, property);

    counts[plan.state] += 1;
    if (plan.state === 'failed') failures.push(`${key}: ${plan.detail}`);

    const changed = plan.text !== text;
    if (changed && apply) writeFileSync(path, plan.text, 'utf8');

    console.log([plan.state.padEnd(18), key, plan.detail ? `  (${plan.detail})` : ''].join(''));

    // The diff belongs to the dry run: it is what somebody reads before
    // deciding, and reprinting it after the write says nothing new.
    if (changed && !apply && !quiet) diffs.push(unifiedDiff(text, plan.text, key));
  }

  for (const diff of diffs) console.log(`\n${diff}`);

  console.log('');
  console.log({
    notes: Object.values(counts).reduce((sum, count) => sum + count, 0),
    stripped: counts.stripped,
    alreadyStripped: counts['already-stripped'],
    skipped: counts.skipped,
    failed: counts.failed,
  });
  for (const failure of failures) console.log('REFUSED', failure);

  process.exit(counts.failed > 0 ? 1 : 0);
}

// Only when run as a program. The function above is imported by the tests,
// which want the decision without a vault being walked on import.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
