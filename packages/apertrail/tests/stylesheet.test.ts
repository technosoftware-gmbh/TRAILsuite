/**
 * The stylesheet and the source agree about which classes exist.
 *
 * Two failures this catches, and neither is visible in a diff, a typecheck or
 * any other test. A class the source sets and the sheet has no rule for is an
 * element that renders unstyled in a way nobody notices until a theme changes.
 * A rule the source never sets is dead weight left behind by a rename, and the
 * next person to reuse that name inherits it by accident.
 *
 * This package was the last of the three to get this suite, which is why it
 * starts with a list rather than with a clean sheet: see UNSTYLED below. The
 * suite-wide statement of these rules is `docs/ui-conventions.md`.
 *
 * **Class names are read out of single quotes and template literals alike, and
 * split on whitespace**, because `cls: 'apt-a apt-b'` is one string carrying two
 * classes and `cls: \`apt-x apt-x--${role}\`` is the shape this package uses for
 * anything with a variant. A scan that read only single-quoted whole strings
 * reported twenty-six orphans here, every one of them a false alarm.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PHOTO_SPOT_MOTIF_ROLES } from '../src/places/photo-spot-note';

const ROOT = join(__dirname, '..');
const CSS = readFileSync(join(ROOT, 'styles.css'), 'utf8');

/**
 * Classes composed at runtime, which a scan cannot see.
 *
 * Derived from the constant that drives them rather than typed out, so a role
 * added without a rule fails here instead of rendering unstyled.
 */
const RUNTIME_BUILT = new Set([
  ...PHOTO_SPOT_MOTIF_ROLES.map((role) => `apt-photo-spot-motif--${role}`),
  ...PHOTO_SPOT_MOTIF_ROLES.map((role) => `apt-photo-spot-role--${role}`),
]);

/**
 * Names that look like classes to the scan and are element ids.
 *
 * Both are the `id` of a `<datalist>` an input points at through its `list`
 * attribute. They carry the package prefix because every name this plugin puts
 * in somebody's DOM does, and they will never have a rule, because a rule for
 * an id is written `#name` and a `<datalist>` renders nothing of its own.
 *
 * The scan reads quoted strings and cannot tell where one is used, so these two
 * are named here rather than the scan made cleverer. A regex that tried to tell
 * a `cls:` from an `attr: { id }` would be a second parser to keep right.
 */
const ELEMENT_IDS = new Set(['apt-crm-tag-suggestions', 'apt-travel-type-suggestions']);

/**
 * Classes the source sets that this sheet does not style.
 *
 * Empty, and meant to stay that way. It held fourteen entries when this check
 * was first switched on: two of them were the ids above and the other twelve
 * were structural hooks -- modal roots, wrapper divs, a cancel button -- that
 * were set on an element and never styled.
 *
 * They were deleted rather than styled, which is the convention the other two
 * packages already keep by having nothing to exempt: **a class goes on an
 * element in the same edit that gives it a rule.** A hook put there for a
 * stylesheet somebody intends to write later is indistinguishable from one that
 * was meant to be styled and was missed, and this check exists to catch the
 * second kind. Adding the class back alongside its rule costs one line.
 */
const UNSTYLED = new Set<string>([]);

/** Class selectors written as a bare rule: `.foo {`, no pseudo, compound or comma. */
function bareRules(): string[] {
  return [...CSS.matchAll(/^\.([a-zA-Z0-9_-]+)\s*\{/gm)].map((match) => match[1]);
}

/** Every `apt-` class named anywhere in the sheet, compound selectors included. */
function styled(): Set<string> {
  return new Set([...CSS.matchAll(/\.(apt-[a-zA-Z0-9_-]+)/g)].map((match) => match[1]));
}

/** Every `apt-` class the source actually puts on an element. */
function classesUsedInSource(): Set<string> {
  const used = new Set<string>();

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;

      const source = readFileSync(path, 'utf8');
      for (const match of source.matchAll(/['`]([^'`]*apt-[^'`]*)['`]/g)) {
        for (const token of match[1].split(/\s+/)) {
          if (/^apt-[a-zA-Z0-9_-]+$/.test(token)) used.add(token);
        }
      }
    }
  };

  walk(join(ROOT, 'src'));
  return used;
}

describe('the stylesheet', () => {
  const used = classesUsedInSource();

  it('has classes to check, so a broken scan cannot pass silently', () => {
    expect(styled().size).toBeGreaterThan(20);
    expect(used.size).toBeGreaterThan(20);
  });

  it('has a rule for every class the source sets', () => {
    const rules = styled();
    const missing = [...used]
      .filter((name) => !rules.has(name) && !UNSTYLED.has(name) && !ELEMENT_IDS.has(name))
      .sort();
    expect(missing).toEqual([]);
  });

  it('keeps no entry in UNSTYLED that has since been styled', () => {
    // The list is meant to shrink, and an entry that stopped being true is a
    // comment asserting something false.
    const rules = styled();
    expect([...UNSTYLED].filter((name) => rules.has(name)).sort()).toEqual([]);
  });

  it('has no bare rule for a class nothing sets', () => {
    const orphans = [...new Set(bareRules())]
      .filter((name) => name.startsWith('apt-'))
      .filter((name) => !used.has(name) && !RUNTIME_BUILT.has(name))
      .sort();
    expect(orphans).toEqual([]);
  });

  it('uses no physical inline offsets, so the sheet works in either direction', () => {
    // `margin-left` and friends. `margin-inline-start` and `inset-inline-end`
    // are the logical spellings, and this package's CLAUDE.md already requires
    // them; until now nothing checked.
    const physical = [...CSS.matchAll(/^\s*(margin|padding|border)-(left|right):/gm)];
    expect(physical.map((match) => match[0].trim())).toEqual([]);
  });
});
