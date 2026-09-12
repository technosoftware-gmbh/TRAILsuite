/**
 * The stylesheet and the source agree about which classes exist.
 *
 * Two failures this catches, and neither is visible in a diff. A class the
 * source sets and the sheet has no rule for is an element that renders unstyled
 * in a way nobody notices until a theme changes. A rule the source never sets is
 * dead weight that the next person to edit the sheet has to reason about.
 *
 * The six fence languages are excluded, because they are strings a reader types
 * into a note rather than classes anything sets.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const FENCE_LANGUAGES = new Set([
  'nod-bills',
  'nod-budget',
  'nod-period',
  'nod-projects',
  'nod-spending',
  'nod-tasks',
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') ? [readFileSync(full, 'utf8')] : [];
  });
}

const stylesheet = readFileSync(join(ROOT, 'styles.css'), 'utf8');
const defined = new Set([...stylesheet.matchAll(/\.(nod-[a-z0-9-]+)/g)].map((m) => m[1]));

/**
 * Every class the source sets, read out of its quoted string literals.
 *
 * **A literal may hold several classes**, as `cls: 'nod-a nod-b'` does, and each
 * of them counts. Reading the whole literal as one name reported the second as
 * a rule nothing sets, twice in one week, and the workaround both times was to
 * split the call rather than the string -- which is a source file bent around a
 * test's regex. A name assembled at runtime is still invisible here, and that
 * is the part worth being strict about: the pattern refuses anything but the
 * literal characters of a class name.
 */
const used = new Set<string>();
for (const source of sourceFiles(join(ROOT, 'src'))) {
  for (const match of source.matchAll(/'((?:nod-[a-z0-9-]+)(?:\s+nod-[a-z0-9-]+)*)'/g)) {
    for (const name of (match[1] ?? '').split(/\s+/)) {
      if (name && !FENCE_LANGUAGES.has(name)) used.add(name);
    }
  }
}

describe('the stylesheet', () => {
  it('has classes to check, so a broken scan cannot pass silently', () => {
    expect(defined.size).toBeGreaterThan(20);
    expect(used.size).toBeGreaterThan(20);
  });

  it('has a rule for every class the source sets', () => {
    expect([...used].filter((name) => !defined.has(name)).sort()).toEqual([]);
  });

  it('has no rule for a class nothing sets', () => {
    expect([...defined].filter((name) => !used.has(name)).sort()).toEqual([]);
  });

  it('uses no physical inline offsets, so the sheet works in either direction', () => {
    // `margin-left` and friends. `border-block-end` and `inset-inline-end` are
    // the logical spellings and are what this insists on.
    const physical = [...stylesheet.matchAll(/^\s*(margin|padding|border)-(left|right):/gm)];
    expect(physical.map((match) => match[0].trim())).toEqual([]);
  });
});
