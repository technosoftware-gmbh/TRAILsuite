/**
 * Checks a converted vault against the one it was converted from.
 *
 * Separate from the converter on purpose. That one verifies each note against
 * the text it is about to write; this one reads both vaults back off disk
 * afterwards, so it also catches what the first cannot: a value the YAML
 * serialiser wrote ambiguously, a note that failed to be written at all, a file
 * that went missing.
 *
 *   npx tsx scripts/verify-plan-notes.ts --before <path> --after <path>
 *
 * Ids are compared loosely, since the converter mints one for every entry the
 * checklist gave none. Everything else has to agree exactly.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { planEntriesFromBody } from '../src/planning/meal-plan/legacy-body';
import {
  parsePlanNote,
  planProperties,
  type PlanEntryContent,
} from '../src/planning/meal-plan/plan-note';
import { mergeSettings } from '../src/settings/validate';

const settings = mergeSettings({});
const properties = planProperties(settings);

const argv = process.argv.slice(2);
const before = argv[argv.indexOf('--before') + 1];
const after = argv[argv.indexOf('--after') + 1];

if (argv.indexOf('--before') === -1 || argv.indexOf('--after') === -1) {
  console.error('usage: verify-plan-notes.ts --before <path> --after <path>');
  process.exit(2);
}

function markdownFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...markdownFiles(path));
    else if (name.endsWith('.md')) found.push(path);
  }
  return found;
}

function split(text: string): { header: string; body: string } {
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') return { header: '', body: text };

  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      return { header: lines.slice(1, i).join('\n'), body: lines.slice(i + 1).join('\n') };
    }
  }
  return { header: '', body: text };
}

/** Every field but the id, which the converter is allowed to have invented. */
function comparable(entry: PlanEntryContent): string {
  const { id: _id, ...rest } = entry;
  return JSON.stringify(rest);
}

const problems: string[] = [];
let notes = 0;
let entries = 0;
let eaten = 0;

const plansFolder = join(before, settings.mealPlansFolder);

for (const path of markdownFiles(plansFolder)) {
  const key = relative(plansFolder, path);
  const target = join(after, settings.mealPlansFolder, key);
  notes += 1;

  let migrated: string;
  try {
    migrated = readFileSync(target, 'utf8');
  } catch {
    problems.push(`missing after conversion: ${key}`);
    continue;
  }

  const was = planEntriesFromBody(split(readFileSync(path, 'utf8')).body, settings);
  const header = split(migrated).header;

  // Duplicate keys are the failure a parse check does not catch: YAML tolerates
  // them and hands back the last, while Obsidian rejects the note outright and
  // it drops out of every view. Counted here rather than assumed away.
  const keys = header
    .split('\n')
    .map((line) => /^([A-Za-z0-9_-]+):/.exec(line)?.[1])
    .filter(Boolean);
  const duplicate = keys.find((name, index) => keys.indexOf(name) !== index);
  if (duplicate) problems.push(`duplicate key ${duplicate}: ${key}`);

  const now = parsePlanNote({
    frontmatter: (parseYaml(header) as Record<string, unknown>) ?? {},
    properties,
  });

  if (was.length !== now.entries.length) {
    problems.push(`${was.length} entries became ${now.entries.length}: ${key}`);
    continue;
  }

  for (let i = 0; i < was.length; i++) {
    if (comparable(was[i]) !== comparable(now.entries[i])) {
      problems.push(
        `entry ${i + 1} changed: ${key}\n  was ${comparable(was[i])}\n  now ${comparable(now.entries[i])}`
      );
    }
    if (!now.entries[i].id) problems.push(`entry ${i + 1} has no id: ${key}`);
  }

  entries += now.entries.length;
  eaten += now.entries.filter((entry) => entry.eaten).length;
}

console.log({ notes, entries, eaten, problems: problems.length });
for (const problem of problems) console.log(problem);

process.exit(problems.length > 0 ? 1 : 0);
