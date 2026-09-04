/**
 * Converts a vault's meal-plan notes from the Markdown checklist to the
 * frontmatter shape.
 *
 * **It imports the plugin's own reader and writer.** That is the point of it
 * being TypeScript rather than a throwaway script in another language: the
 * conversion and the code that will read the result afterwards are literally
 * the same functions, so there is no second implementation of the line format
 * to disagree with the first.
 *
 * Dry run by default. `--apply` writes. Either way it verifies every note by
 * re-reading what it produced with `parsePlanNote` and comparing entry for
 * entry against what the checklist said, and it refuses to write a note whose
 * verification fails.
 *
 *   npx tsx scripts/convert-plan-notes.ts --vault <path> [--apply]
 *
 * Not shipped with the plugin. It runs once per vault, from a terminal.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Document, isScalar, parse as parseYaml, Scalar, visit } from 'yaml';
import { bodyWithoutPlan, planEntriesFromBody } from '../src/planning/meal-plan/legacy-body';
import {
  buildPlanFrontmatter,
  hasPlanEntries,
  parsePlanNote,
  planProperties,
  type PlanEntryContent,
  type PlanProperties,
} from '../src/planning/meal-plan/plan-note';
import { mergeSettings } from '../src/settings/validate';

const settings = mergeSettings({});
const properties: PlanProperties = planProperties(settings);

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const vault = argv[argv.indexOf('--vault') + 1];

if (!vault || argv.indexOf('--vault') === -1) {
  console.error('usage: convert-plan-notes.ts --vault <path> [--apply]');
  process.exit(2);
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

/** The frontmatter block and the body, on the same terms the plugin splits them. */
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

function weekOfPath(path: string): string | null {
  const match = /(\d{4})-W(\d{2})/.exec(path);
  return match ? `${match[1]}-W${match[2]}` : null;
}

/**
 * The person a plan filename names, from the vault's People folder.
 *
 * Built from the folder rather than guessed out of the filename, because
 * `StefanMuster` does not say where the space went.
 */
function personTokens(): Map<string, string> {
  const byToken = new Map<string, string>();
  const folder = join(vault, settings.personsFolder);

  try {
    for (const name of readdirSync(folder)) {
      if (!name.endsWith('.md')) continue;
      const title = name.slice(0, -3);
      byToken.set(title.replace(/[\\/:*?"<>|[\]#^]/g, '').replace(/\s+/g, ''), title);
    }
  } catch {
    // No People folder is a legitimate vault. Every plan then carries no person.
  }
  return byToken;
}

const tokens = personTokens();

function personOfPath(path: string): string | null {
  for (const [token, title] of tokens) {
    if (token && path.includes(token)) return title;
  }
  return null;
}

/**
 * A stable id for an entry the checklist gave none.
 *
 * Derived rather than random, so running this twice produces the same note and
 * a re-run is a no-op rather than a second set of ids. Week, person and
 * position are unique across the vault, which is what state needs of an id.
 */
function mintId(week: string | null, person: string | null, index: number): string {
  const who = (person ?? 'nobody').replace(/\s+/g, '');
  return `mp-${week ?? 'undated'}-${who}-${index + 1}`;
}

/**
 * The frontmatter as text, with every clock time quoted.
 *
 * `time: 11:40` is a plain string under the YAML 1.2 core schema this library
 * follows, and a sexagesimal number under 1.1, which some parsers still
 * implement. Obsidian's is the one that has to read this and it is not this
 * library, so the ambiguity is removed rather than reasoned about: an unquoted
 * clock time that came back as 700 would be a lost field nothing would report.
 */
function toYaml(value: Record<string, unknown>): string {
  const doc = new Document(value);

  visit(doc, {
    Pair(_key, pair) {
      const key = pair.key;
      const scalar = pair.value;
      if (!isScalar(key) || key.value !== properties.entryTimeField) return;
      if (isScalar(scalar)) scalar.type = Scalar.QUOTE_DOUBLE;
    },
  });

  return doc.toString();
}

/** Two entry lists agree about every field. */
function sameEntries(a: PlanEntryContent[], b: PlanEntryContent[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface Report {
  path: string;
  entries: number;
  eaten: number;
  keptBody: number;
  status: 'converted' | 'already' | 'empty' | 'FAILED';
  detail?: string;
}

const reports: Report[] = [];

for (const path of markdownFiles(join(vault, settings.mealPlansFolder))) {
  const text = readFileSync(path, 'utf8');
  const { header, body } = split(text);

  const existing = (header ? (parseYaml(header) as Record<string, unknown>) : {}) ?? {};
  if (hasPlanEntries(existing, properties)) {
    reports.push({ path, entries: 0, eaten: 0, keptBody: 0, status: 'already' });
    continue;
  }

  const week = weekOfPath(path);
  const person = personOfPath(path);

  const entries = planEntriesFromBody(body, settings).map((entry, index) => ({
    ...entry,
    id: entry.id || mintId(week, person, index),
  }));

  const kept = bodyWithoutPlan(body, settings);
  const plan = buildPlanFrontmatter(properties, { week, personTitle: person, entries });

  // A key the note already had, that the plan format also owns, with a
  // different value. Renaming into a key that is already there is what turned
  // three notes into notes with no readable frontmatter at all during the
  // folder migration, and a parse check does not catch it because a YAML
  // parser tolerates duplicates. This one refuses.
  const clash = Object.keys(plan).find(
    (key) => key in existing && JSON.stringify(existing[key]) !== JSON.stringify(plan[key])
  );
  if (clash && clash !== properties.typePropertyName) {
    reports.push({
      path,
      entries: entries.length,
      eaten: 0,
      keptBody: kept.length,
      status: 'FAILED',
      detail: `the note already states ${clash}`,
    });
    continue;
  }

  const merged = { ...existing, ...plan };
  const out = `---\n${toYaml(merged).trimEnd()}\n---\n${kept ? `\n${kept}\n` : ''}`;

  // The verification: read back what was produced, with the reader the plugin
  // itself will use, and insist it says the same thing the checklist did.
  const back = parsePlanNote({
    frontmatter: (parseYaml(split(out).header) as Record<string, unknown>) ?? {},
    properties,
  });

  if (!sameEntries(back.entries, entries)) {
    reports.push({
      path,
      entries: entries.length,
      eaten: 0,
      keptBody: kept.length,
      status: 'FAILED',
      detail: 'the note does not read back as what it was',
    });
    continue;
  }

  if (apply) writeFileSync(path, out, 'utf8');

  reports.push({
    path,
    entries: entries.length,
    eaten: entries.filter((entry) => entry.eaten).length,
    keptBody: kept.length,
    status: entries.length === 0 ? 'empty' : 'converted',
  });
}

const failed = reports.filter((report) => report.status === 'FAILED');
const converted = reports.filter((report) => report.status === 'converted');
const totals = {
  notes: reports.length,
  converted: converted.length,
  alreadyDone: reports.filter((report) => report.status === 'already').length,
  emptyWeeks: reports.filter((report) => report.status === 'empty').length,
  failed: failed.length,
  entries: converted.reduce((sum, report) => sum + report.entries, 0),
  eaten: converted.reduce((sum, report) => sum + report.eaten, 0),
  notesKeepingBodyText: reports.filter((report) => report.keptBody > 0).length,
};

console.log(apply ? 'APPLIED' : 'DRY RUN, nothing written');
console.log(totals);

for (const report of failed) console.log('FAILED', report.path, report.detail);
for (const report of reports.filter((r) => r.keptBody > 0)) {
  console.log('kept body text:', report.path, `${report.keptBody} chars`);
}

process.exit(failed.length > 0 ? 1 : 0);
