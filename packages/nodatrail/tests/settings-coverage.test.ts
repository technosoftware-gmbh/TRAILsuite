/**
 * Every setting has somewhere to be edited.
 *
 * A setting with no control is a setting only `data.json` can reach, which is a
 * real answer for some of them and an accident for the rest. The difference has
 * to be a decision somebody wrote down, so this splits them: a key is either
 * wired into a page, or named in the list below with the reason it is not.
 *
 * CULItrail carries the same suite for the same reason. What this adds is the
 * exemption list and, more usefully, the check in the other direction: an
 * exemption that has stopped being true is a comment asserting something false,
 * and it caught nine of those the first time it ran.
 *
 * NODAtrail turns out to need almost no exemptions. APERtrail leaves thirty-two
 * `*Field` sub-keys off its pages on the grounds that a sub-key is the shape of
 * a value rather than a property of a note; here the property-keys page is
 * built from a table rather than by hand, so listing them cost nine lines
 * instead of nine builder chains and there was no reason not to.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const SRC = join(__dirname, '..', 'src');

/**
 * Settings deliberately edited in `data.json` alone, each with its reason.
 *
 * Adding a key here is the decision; the test only insists that the decision be
 * made rather than defaulted into.
 */
const NO_ROW: Record<string, string> = {
  // Read once in onload(), before the settings page exists, and answered by
  // Obsidian's own language setting rather than by this plugin's. A row here
  // would be a second place to say something the vault has already said.
  language: 'follows Obsidian',
};

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

/**
 * Just the settings pages: a key read in a view does not make it editable.
 *
 * **Named files rather than the whole of `src/settings`**, which also holds
 * `defaults.ts`, `types.ts`, `store.ts`, `validate.ts`, `links.ts` and
 * `foreign-settings-import.ts`. Scanning the directory made this check pass on
 * a setting that had no control at all: the adoption list in
 * `foreign-settings-import.ts` names its keys as string literals, the `'<key>'`
 * alternative below matched one, and `eligiblePersonTags` counted as wired for
 * as long as it was named there. A test that reads more than it means to is a
 * test that cannot fail.
 *
 * **One narrower blind spot survives on purpose.** `page-folders.ts` declares a
 * `FolderKey` union naming every folder key as a string literal, so a folder key
 * matches whether or not it is rendered. Every one of the eighteen currently has
 * a `folder()` call, and the union is added in the same edit as the call, so
 * nothing is hidden today. Keying on the call instead would tie this test to one
 * page's helper name, which is a worse trade than writing the limit down.
 */
const PAGES = [join(SRC, 'ui', 'settings'), join(SRC, 'settings', 'settings-tab.ts')]
  .map(sourceText)
  .join('\n');

describe('settings coverage', () => {
  const keys = Object.keys(DEFAULT_SETTINGS);

  it('has settings to check', () => {
    expect(keys.length).toBeGreaterThan(100);
  });

  it('gives every setting a control, or a stated reason for having none', () => {
    const orphans = keys.filter((key) => {
      if (key in NO_ROW) return false;
      // `settings.<key>` for a hand-wired row, `'<key>'` for the table the
      // property-keys page is built from.
      return !new RegExp(String.raw`settings\.${key}\b|'${key}'`).test(PAGES);
    });

    expect(orphans.sort()).toEqual([]);
  });

  it('exempts nothing that actually has a control', () => {
    // The other direction: an exemption that stopped being true is a comment
    // asserting something false.
    const stale = Object.keys(NO_ROW).filter((key) =>
      new RegExp(String.raw`settings\.${key}\b|'${key}'`).test(PAGES)
    );
    expect(stale).toEqual([]);
  });

  it('keeps the exemption list short, because a long one is a page nobody finished', () => {
    // Not a style rule: every exemption is a setting only a text editor can
    // reach, and a list that grows is a settings page quietly becoming
    // optional.
    expect(Object.keys(NO_ROW).length).toBeLessThanOrEqual(3);
  });

  it('exempts nothing vault-facing', () => {
    // A key naming a property, a folder or a path is what somebody actually
    // needs to change, and it belongs on a page whatever else is true of it.
    const wrongShape = Object.keys(NO_ROW).filter((key) =>
      /(?:Property|TypeValue|Field|Folder|Path)$/.test(key)
    );
    expect(wrongShape).toEqual([]);
  });
});
