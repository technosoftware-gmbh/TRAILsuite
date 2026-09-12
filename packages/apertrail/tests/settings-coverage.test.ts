/**
 * Every setting is reachable, or is a sub-key with a stated reason not to be.
 *
 * A setting with no control is a setting only `data.json` can reach, which is a
 * real answer for some of them and an accident for the rest. The difference has
 * to be a decision somebody wrote down. CULItrail and NODAtrail carry the same
 * suite; this package was the last to get one, which is why it draws the line by
 * rule rather than by list.
 *
 * **The line here is shape, not count.** A top-level property of a note gets a
 * row on the Property keys page. A `*Field` naming a sub-key inside a list entry
 * does not: a sub-key is the shape of a value rather than a property of a note,
 * and a row each would cost the page its readability without answering a
 * question anybody asks. `docs/settings.md` section 8 has the reasoning and the
 * current counts.
 *
 * That exemption is only honest while those sub-keys are genuinely honoured, so
 * the second test checks exactly that: a `*Field` nothing outside the settings
 * plumbing ever reads is not an editable-in-`data.json` setting, it is a dead
 * one, and it should be deleted rather than exempted.
 *
 * **PAGES names its files rather than walking `src/settings`**, which also holds
 * `defaults.ts`, `types.ts`, `store.ts`, `validate.ts` and `links.ts`. NODAtrail's
 * copy of this test walked the directory and counted a key as wired because an
 * unrelated file happened to name it in a string; a test that reads more than it
 * means to is a test that cannot fail.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const SRC = join(__dirname, '..', 'src');

/** Every `.ts` under a directory, or one named file, as one string. */
function sourceText(path: string): string {
  if (statSync(path).isFile()) return readFileSync(path, 'utf8');
  return readdirSync(path, { withFileTypes: true })
    .map((entry) => {
      const full = join(path, entry.name);
      if (entry.isDirectory()) return sourceText(full);
      return entry.name.endsWith('.ts') ? readFileSync(full, 'utf8') : '';
    })
    .join('\n');
}

const PAGES = [
  join(SRC, 'ui', 'settings'),
  join(SRC, 'settings', 'settings-tab-shell.ts'),
  join(SRC, 'settings', 'settings-tab.ts'),
  join(SRC, 'settings', 'section-about.ts'),
]
  .map(sourceText)
  .join('\n');

/**
 * The plugin apart from the settings plumbing, for "is this honoured anywhere".
 *
 * `defaults.ts`, `types.ts` and `validate.ts` are excluded deliberately: every
 * key appears in all three by construction, so a scan that included them would
 * report every sub-key as honoured and the check below could never fail.
 */
const PLUMBING = new Set(['defaults.ts', 'types.ts', 'validate.ts']);

function behaviourText(dir: string): string {
  return readdirSync(dir, { withFileTypes: true })
    .map((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return behaviourText(full);
      if (!entry.name.endsWith('.ts') || PLUMBING.has(entry.name)) return '';
      return readFileSync(full, 'utf8');
    })
    .join('\n');
}

const BEHAVIOUR = behaviourText(SRC);

/** A sub-key naming a field inside a list entry, rather than a property of a note. */
function isSubKey(key: string): boolean {
  return key.endsWith('Field');
}

function wired(key: string, haystack: string): boolean {
  return new RegExp(String.raw`settings\.${key}\b|'${key}'`).test(haystack);
}

describe('settings coverage', () => {
  const keys = Object.keys(DEFAULT_SETTINGS);

  it('has settings to check', () => {
    expect(keys.length).toBeGreaterThan(100);
  });

  it('gives every setting a control, except a sub-key inside a list entry', () => {
    const orphans = keys.filter((key) => !isSubKey(key) && !wired(key, PAGES));
    expect(orphans.sort()).toEqual([]);
  });

  it('honours every sub-key it declines to give a row', () => {
    // The exemption's justification. A sub-key the reader, the writer and the
    // validator all ignore is dead rather than advanced, and exempting it here
    // would be this file asserting something false.
    const dead = keys.filter(
      (key) => isSubKey(key) && !new RegExp(String.raw`\b${key}\b`).test(BEHAVIOUR)
    );
    expect(dead.sort()).toEqual([]);
  });
});
