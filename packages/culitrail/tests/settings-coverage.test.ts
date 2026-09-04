/**
 * Every setting is reachable from the settings tab.
 *
 * This exists because the failure it catches is invisible. A setting with no
 * row is not an error, does not fail the typechecker, and does not look wrong
 * in any screenshot: it simply cannot be changed, and the only way anybody
 * finds out is by going looking for it and not finding it. CULItrail has
 * around a hundred and twenty of them, spread over one page and five
 * sub-pages, which is exactly the number at which one goes missing quietly.
 *
 * The exemption list below is the point of the test as much as the check is.
 * Each entry says why that setting has no row, and the list is meant to
 * shrink: when the three list editors land, four of these come off and this
 * test is what insists on it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const VIEW_DIR = join(__dirname, '..', 'src', 'settings', 'view');

/**
 * Settings deliberately absent from the page.
 *
 * All three are state rather than configuration, and none will ever have a
 * row. The list settings that were exempt while their editors were being built
 * are covered now, and the third assertion below is what made taking them off
 * this list mandatory rather than optional.
 */
const EXEMPT = new Map<string, string>([
  ['state', 'Runtime state, not configuration. Documented as appearing on no page.'],
  ['gallerySavedState', 'The gallery persists its own filters; the gallery toolbar is its editor.'],
  ['ordersSavedState', 'The orders view persists its own filters; its toolbar is the editor.'],
]);

/** Every file under `settings/view/`: sections, pages and editors alike. */
function tabSource(): string {
  return readdirSync(VIEW_DIR, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8'))
    .join('\n');
}

describe('settings tab coverage', () => {
  const source = tabSource();
  const keys = Object.keys(DEFAULT_SETTINGS);

  /**
   * Coverage is **being written**, not being mentioned.
   *
   * When the Suggester tab listed its modes read-only it *read* that setting
   * while offering no way to change them, and counting that as coverage would
   * have let its exemption come off a year before the editor arrived. An
   * assignment is the thing only a real control does. (The suggester is gone;
   * the rule it taught is not.)
   *
   * The editors write through their own modules rather than in the tab file,
   * so those count too: the tab directory is walked recursively.
   */
  const hasRow = (key: string): boolean =>
    new RegExp(String.raw`settings\.${key}\s*=[^=]`).test(source);

  it('has a row for every setting that is not exempt', () => {
    const missing = keys.filter((key) => !EXEMPT.has(key)).filter((key) => !hasRow(key));
    expect(missing).toEqual([]);
  });

  it('exempts nothing that no longer exists', () => {
    // Otherwise a renamed setting could sit exempted forever under its old
    // name while the new one quietly has no row.
    const stale = [...EXEMPT.keys()].filter((key) => !keys.includes(key));
    expect(stale).toEqual([]);
  });

  it('exempts nothing that does have a row', () => {
    // This is what forced the four list settings off the exemption list the
    // moment their editors landed, rather than leaving it to rot.
    const unnecessary = [...EXEMPT.keys()].filter(hasRow);
    expect(unnecessary).toEqual([]);
  });
});
