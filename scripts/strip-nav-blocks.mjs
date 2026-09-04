/**
 * A one-off sweep: takes the old navigation block off every period note.
 *
 * The plugin strips a block whenever it writes to a period note, which cleans a
 * note the next time there is a reason to touch it. This is for the notes there
 * will never be a reason to touch, and it is a one-off: once it has run, no
 * vault has blocks and nothing writes another.
 *
 * **It mirrors `packages/nodatrail/src/plan/nav-block.ts` and is not the same
 * code.** Two implementations of one rule normally drift, and the reason that
 * is acceptable here is that this one runs once and is then dead. The rule is
 * small enough to state twice: the block is the run of lines carrying a
 * navigation arrow, plus blank lines, at the very top of the body, and scanning
 * stops at the first line that is neither.
 *
 * **The `---` under the week notes' block stays.** It is migrated formatting,
 * not ours.
 *
 * Usage:
 *   node scripts/strip-nav-blocks.mjs <vault> <plan folder>          # dry run
 *   node scripts/strip-nav-blocks.mjs <vault> <plan folder> --write  # apply
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [vault, planFolder] = process.argv.slice(2);
const write = process.argv.includes('--write');
if (!vault || !planFolder) {
  console.error('usage: node scripts/strip-nav-blocks.mjs <vault> <plan folder> [--write]');
  process.exit(2);
}

const NAV = /[\u{23EE}\u{23ED}\u{2B05}\u{27A1}]/u;

/** The frontmatter block and the body, split the way the plugin splits them. */
function split(text) {
  if (!text.startsWith('---\n')) return { header: '', body: text };
  const close = text.indexOf('\n---\n', 3);
  if (close === -1) return { header: '', body: text };
  const end = close + '\n---\n'.length;
  return { header: text.slice(0, end), body: text.slice(end) };
}

function strip(body) {
  const lines = body.split('\n');
  let end = 0;
  let sawNav = false;
  while (end < lines.length) {
    const line = lines[end] ?? '';
    if (line.trim() === '') {
      end += 1;
      continue;
    }
    if (!NAV.test(line)) break;
    sawNav = true;
    end += 1;
  }
  if (!sawNav) return body;
  return lines.slice(end).join('\n');
}

function markdownFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...markdownFiles(path));
    else if (entry.endsWith('.md')) out.push(path);
  }
  return out;
}

const files = markdownFiles(join(vault, planFolder)).sort();
let changed = 0;
let emptied = 0;
let keptRule = 0;

for (const path of files) {
  const text = readFileSync(path, 'utf8');
  const { header, body } = split(text);
  const stripped = strip(body);
  if (stripped === body) continue;

  changed += 1;
  if (stripped.trim() === '') emptied += 1;
  if (stripped.trimStart().startsWith('---')) keptRule += 1;

  const next = `${header}${stripped}`;
  if (write) writeFileSync(path, next, 'utf8');
  else {
    const before = body.split('\n').length;
    const after = stripped.split('\n').length;
    console.log(
      `${path.slice(vault.length + 1)}  ${before} -> ${after} body lines` +
        (stripped.trim() === '' ? '  [no content left]' : '')
    );
  }
}

console.log(
  `\n${files.length} notes scanned, ${changed} carried a block` +
    `, ${emptied} of them had no content under it` +
    `, ${keptRule} keep a --- rule at the top.` +
    (write ? '  WRITTEN.' : '  Dry run: nothing written.')
);
