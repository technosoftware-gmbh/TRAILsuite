/**
 * An icon goes in a slot inside a button, never straight into the button.
 *
 * This is a bug report turned into a rule. In CULItrail, a gallery's icon-only
 * filter and sort buttons drew nothing at all on an iPad while every labelled
 * button beside them drew its icon: those wrapped theirs in a span and the
 * icon-only ones called `setIcon()` on the button element itself. Wrapping them
 * fixed it.
 *
 * **The mechanism was never pinned down**, and that is the honest reason for a
 * test rather than a comment. `setIcon()` on a button renders on a desktop every
 * time, renders on iOS in some contexts and not in others, and the difference is
 * somewhere in the app's own stylesheet where this repository cannot see it.
 * What is known is that a child element has never failed. So the rule is the
 * shape, not the explanation, and it is checked rather than remembered: **the
 * version that breaks is the one that looks right and passes review on the
 * machine it was written on.**
 *
 * A source scan, because these views cannot be rendered outside Obsidian.
 *
 * **A target is resolved against the nearest preceding declaration**, not
 * against every declaration in the file. Collecting button names file-wide
 * reported two false positives when this check was first run across the suite:
 * `const btn = wrap.createDiv({ role: 'button' })` in a file that also declares
 * a real `const btn = ....createEl('button')` further down. A name is only a
 * button where it was most recently made one.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..', 'src');

/** Any element assigned to a name, with the tag it was created as. */
const DECLARED =
  /(?:(?:const|let)\s+(\w+)|this\.(\w+))(?:\s*:[^=]+)?\s*=\s*[^;]*?\.createEl\(\s*['"](\w+)['"]/gs;

/**
 * A call to the bare `setIcon(target, ...)`, with its target.
 *
 * The lookbehind skips `item.setIcon(...)`, which is a menu item's own builder
 * and has nothing to do with the DOM.
 */
const SET_ICON = /(?<![.\w])setIcon\(\s*([^,]+?)\s*,/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

/** The tag a name most recently held before `at`, or null if it was never made an element. */
function tagBefore(source: string, name: string, at: number): string | null {
  let tag: string | null = null;
  for (const match of source.matchAll(DECLARED)) {
    if ((match.index ?? 0) >= at) break;
    const declared = match[1] ?? (match[2] ? `this.${match[2]}` : undefined);
    if (declared === name) tag = match[3];
  }
  return tag;
}

describe('icons in buttons', () => {
  const files = sourceFiles(SRC).map((path) => ({ path, source: readFileSync(path, 'utf8') }));

  it('finds the call sites, so a broken scan fails loudly', () => {
    // Guards the regex itself: were it to stop matching, the check below would
    // pass by looking at nothing.
    const calls = files.flatMap(({ source }) => [...source.matchAll(SET_ICON)]);
    expect(calls.length).toBeGreaterThan(5);
  });

  it('never aims setIcon at a button element', () => {
    const wrong: string[] = [];

    for (const { path, source } of files) {
      for (const match of source.matchAll(SET_ICON)) {
        const target = match[1].trim();
        const at = match.index ?? 0;
        const inline = /\.createEl\(\s*['"]button['"]/.test(target);
        if (!inline && tagBefore(source, target, at) !== 'button') continue;

        const line = source.slice(0, at).split('\n').length;
        wrong.push(`${relative(SRC, path)}:${line} setIcon(${target}, ...)`);
      }
    }

    // The fix is always the same: `setIcon(button.createSpan({ cls:
    // 'culi-icon-slot' }), icon)`.
    expect(wrong).toEqual([]);
  });
});
