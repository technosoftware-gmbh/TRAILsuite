/**
 * Every property-name row on the settings page is rendered through the one
 * helper that can lock it.
 *
 * The rule is not visible in any single row, which is why it needs a test
 * rather than a convention: a folder row and a property row are the same
 * `Setting` with the same text box, and the difference only shows up
 * afterwards. Repoint a folder and every note is found again the moment it
 * points somewhere real. Rename a property and every note carrying the old name
 * stops answering - a trip loses its dates, a place loses its coordinates -
 * with no error anywhere, because a property no note has is not an error.
 *
 * So what is checked is the shape of the page: any setting whose name ends in
 * `Property`, `TypeValue`, `Field` or `FieldName` names something inside a
 * note, and none of them may be wired into a text box that was built by hand.
 * The next one somebody adds inline is caught by the same pattern that caught
 * these, without anybody having to remember a list.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const SETTINGS_UI_DIR = join(__dirname, '..', 'src', 'ui', 'settings');

/** A setting whose value is a property name, a field inside one, or a type value. */
const VAULT_FACING = /(?:Property|PropertyName|TypeValue|Field|FieldName)$/;

/** The text of the call whose opening paren follows `open`, quotes skipped. */
function callBody(source: string, open: number): string {
  let depth = 0;
  let quote = '';
  for (let i = open; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') quote = char;
    else if (char === '(') depth++;
    else if (char === ')') {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return source.slice(open);
}

function settingsUiFiles(): { path: string; source: string }[] {
  return readdirSync(SETTINGS_UI_DIR, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => ({
      path: join(entry.parentPath, entry.name),
      source: readFileSync(join(entry.parentPath, entry.name), 'utf8'),
    }));
}

describe('property name lock', () => {
  const files = settingsUiFiles();
  const keys = Object.keys(DEFAULT_SETTINGS).filter((key) => VAULT_FACING.test(key));

  it('has vault-facing settings to protect', () => {
    // A guard on the guard: were the naming convention to change, this suite
    // would otherwise pass by checking nothing at all.
    expect(keys.length).toBeGreaterThan(60);
    expect(keys).toContain('typePropertyName');
    expect(keys).toContain('billDueDateProperty');
    expect(keys).toContain('budgetLineAmountField');
  });

  it('wires none of them into a hand-built text box', () => {
    const inline: string[] = [];
    for (const { path, source } of files) {
      for (const match of source.matchAll(/\.addText\(/g)) {
        const body = callBody(source, match.index + '.addText'.length);
        for (const key of keys) {
          // `settings[key]` is how the two property loops read theirs, and it
          // belongs to the helper's callers rather than to a text box.
          if (new RegExp(String.raw`settings\.${key}\b`).test(body)) {
            inline.push(`${key} in ${path}`);
          }
        }
        if (/settings\[key\]/.test(body)) inline.push(`a keyed property row in ${path}`);
      }
    }
    expect(inline).toEqual([]);
  });

  it('locks the helper on the setting rather than on a local flag', () => {
    const helper = files.find(({ path }) => path.endsWith('property-row.ts'));
    expect(helper).toBeDefined();
    expect(helper?.source).toContain('if (!settings.unlockPropertyNames)');
    expect(helper?.source).toContain('text.setDisabled(true)');
  });

  it('offers the switch that unlocks them', () => {
    const helper = files.find(({ path }) => path.endsWith('property-row.ts'));
    expect(helper?.source).toContain('settings.unlockPropertyNames = value');
    expect(helper?.source).toContain("t('settings.properties.unlock')");
  });

  /**
   * The switch belongs on the page that holds the rows it governs, and
   * nowhere else. It used to be drawn at the top of the folders tab as well,
   * where it was a mode an unrelated page was in; the drill-down page is what
   * made that unnecessary, and this keeps it from creeping back.
   */
  it('draws the switch on the property-keys page alone', () => {
    const drawn = files.filter(({ source }) => source.includes('renderPropertyLockRow('));
    expect(drawn.map(({ path }) => path.split('/').pop()).sort()).toEqual([
      'page-property-keys.ts',
      'property-row.ts',
    ]);
  });

  it('starts locked', () => {
    expect(DEFAULT_SETTINGS.unlockPropertyNames).toBe(false);
  });
});
