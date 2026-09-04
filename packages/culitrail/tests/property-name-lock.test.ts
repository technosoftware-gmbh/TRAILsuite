/**
 * Every setting that names something inside a note is rendered locked.
 *
 * The rule this enforces is not obvious from any single row, which is why it
 * needs a test rather than a convention: a folder row and a property row are
 * the same `Setting` with the same text box, and the difference only shows up
 * afterwards. Repoint a folder and the notes are still found the moment it
 * points somewhere real again. Rename a property and every note carrying the
 * old name goes quiet - the gallery empties, the diet filter offers nothing -
 * with no error anywhere, because a property no note has is not an error.
 *
 * So the check is by shape, not by list. Any setting whose name ends in
 * `Property`, `TypeValue`, `Field` or `FieldName` is a name the vault is read
 * by, and the next one somebody adds is caught by the same pattern that caught
 * these seventy-seven without anybody remembering to add it anywhere.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const VIEW_DIR = join(__dirname, '..', 'src', 'settings', 'view');

/** A setting whose value is a property name, a field inside one, or a type value. */
const VAULT_FACING = /(?:Property|PropertyName|TypeValue|Field|FieldName)$/;

interface Call {
  callee: string;
  start: number;
  end: number;
  body: string;
}

/**
 * The calls in a file, with the text of each.
 *
 * A hand-rolled scan rather than a parser because the only thing it has to get
 * right is which call an assignment sits inside, and the one thing that would
 * break a brace count - a parenthesis inside a translated string - is what the
 * quote skipping is for.
 */
function calls(source: string): Call[] {
  const found: Call[] = [];
  for (const match of source.matchAll(/\b([A-Za-z_]\w*)\(/g)) {
    const open = match.index + match[1].length;
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
        if (depth === 0) {
          found.push({
            callee: match[1],
            start: match.index,
            end: i + 1,
            body: source.slice(open, i + 1),
          });
          break;
        }
      }
    }
  }
  return found;
}

/**
 * Local helpers that forward to `identifierRow`.
 *
 * The tabs used to define one each, because eighteen rows differing only in
 * their label read better as eighteen one-liners. The property-keys page
 * writes them out in full instead, but the resolution stays: a helper that
 * forwarded to `textRow` would defeat the whole check, so any helper is
 * resolved rather than trusted.
 */
function forwardingHelpers(source: string): Set<string> {
  const names = new Set<string>();
  // The parameter list is skipped loosely rather than matched, because it
  // contains arrow types of its own and a balanced-paren pattern for that is
  // more machinery than the question deserves.
  for (const match of source.matchAll(/const (\w+) =[\s\S]{0,200}?=> \{\s*identifierRow\(/g)) {
    names.add(match[1]);
  }
  return names;
}

function viewFiles(): { path: string; source: string }[] {
  return readdirSync(VIEW_DIR, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => ({
      path: join(entry.parentPath, entry.name),
      source: readFileSync(join(entry.parentPath, entry.name), 'utf8'),
    }));
}

describe('property name lock', () => {
  const files = viewFiles();
  const keys = Object.keys(DEFAULT_SETTINGS).filter((key) => VAULT_FACING.test(key));

  it('has vault-facing settings to protect', () => {
    // A guard on the guard: if the naming convention ever changes, this test
    // would otherwise pass by checking nothing at all.
    expect(keys.length).toBeGreaterThan(50);
    expect(keys).toContain('typePropertyName');
    expect(keys).toContain('dietProperty');
  });

  it('renders every one of them through identifierRow', () => {
    const wrong: string[] = [];
    for (const { path, source } of files) {
      const all = calls(source);
      const helpers = forwardingHelpers(source);
      for (const key of keys) {
        const writes = new RegExp(String.raw`settings\.${key}\s*=[^=]`, 'g');
        for (const assignment of source.matchAll(writes)) {
          // The innermost call containing the assignment is the row that
          // writes it; the outer ones are whatever it is nested in.
          const containing = all
            .filter((call) => call.start < assignment.index && call.end > assignment.index)
            .sort((a, b) => a.end - a.start - (b.end - b.start))[0];
          if (!containing) continue;
          if (containing.callee === 'identifierRow' || helpers.has(containing.callee)) continue;
          wrong.push(`${key} in ${path} rendered by ${containing.callee}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  /**
   * The switch belongs on the page that holds the rows it governs, and nowhere
   * else. It used to be drawn at the top of all four tabs that carried one of
   * these rows, because the rows were spread across four tabs and a switch
   * reachable only from one of them would have meant leaving the row you were
   * trying to edit to find it. One page made that unnecessary; this keeps the
   * repetition from creeping back, and catches a property row drawn anywhere
   * but on that page, where nothing would unlock it at all.
   */
  it('draws those rows on one page, with the switch on it', () => {
    const drawing = files
      .filter(({ path }) => !path.endsWith('identifier-row.ts'))
      .filter(({ source }) => /\bidentifierRow\(/.test(source));

    expect(drawing.map(({ path }) => basename(path))).toEqual(['property-keys.ts']);
    expect(drawing[0]?.source).toContain('propertyNameLockRow(top, context)');
  });

  it('starts locked', () => {
    expect(DEFAULT_SETTINGS.unlockPropertyNames).toBe(false);
  });
});
