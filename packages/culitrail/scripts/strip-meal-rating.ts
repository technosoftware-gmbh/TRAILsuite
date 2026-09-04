/**
 * Takes the `rating:` property off a vault's meal notes.
 *
 * Optional. A rating left on a note is read by nothing after this release, so
 * this exists only for a vault that would rather not carry a dead property.
 *
 * Dry run by default. `--apply` writes.
 *
 *   npx tsx scripts/strip-meal-rating.ts --vault <path> [--apply] [--property rating]
 *
 * Line-oriented rather than a YAML round-trip, and deliberately so: rewriting
 * a whole frontmatter block to remove one key reformats every other key in it,
 * which turns a one-property change into a diff nobody can read. A key whose
 * value spans more than one line is refused rather than guessed at, since a
 * rating never has one and anything that does is not the property this means.
 *
 * Not shipped with the plugin. It runs once per vault, from a terminal.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeSettings } from '../src/settings/validate';

const settings = mergeSettings({});

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const vault = argv[argv.indexOf('--vault') + 1];
const property = argv.includes('--property') ? argv[argv.indexOf('--property') + 1] : 'rating';

if (argv.indexOf('--vault') === -1 || !vault) {
  console.error('usage: strip-meal-rating.ts --vault <path> [--apply] [--property rating]');
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

const changed: string[] = [];
const refused: string[] = [];

for (const path of markdownFiles(join(vault, settings.mealsFolder))) {
  const lines = readFileSync(path, 'utf8').split('\n');
  if (lines[0]?.trim() !== '---') continue;

  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (close === -1) continue;

  const at = lines.findIndex(
    (line, index) => index > 0 && index < close && line.startsWith(`${property}:`)
  );
  if (at === -1) continue;

  // A continuation line is indented. One under the key means the value is a
  // block or a list, which a rating is not, so this is some other property
  // that happens to share the name.
  if (/^\s/.test(lines[at + 1] ?? '')) {
    refused.push(path);
    continue;
  }

  changed.push(path);
  if (apply)
    writeFileSync(path, [...lines.slice(0, at), ...lines.slice(at + 1)].join('\n'), 'utf8');
}

console.log(apply ? 'APPLIED' : 'DRY RUN, nothing written');
console.log({
  carrying: changed.length + refused.length,
  removed: changed.length,
  refused: refused.length,
});
for (const path of changed) console.log('  -', path);
for (const path of refused) console.log('  refused, the value is not a single line:', path);
