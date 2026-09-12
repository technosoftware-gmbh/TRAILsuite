/**
 * A form helper that draws itself draws forever.
 *
 * The four date fields on the goal and project forms were pulled into one
 * `dateFields()` helper by a scripted replace of the old deadline block. The
 * replace ran without a count, so it also rewrote the deadline field *inside*
 * the new helper into a call to the helper. Every form then drew "Erstellt am",
 * called itself, drew "Erstellt am" again, and the dialog came up as a column of
 * identical date boxes. Reported from a real vault as "many many erstellt am
 * fields".
 *
 * Nothing else caught it: the file compiled, the tests passed, and the helper
 * reads correctly until you notice the second call is where the deadline should
 * be. So the check is on the shape rather than on the output -- a method that
 * takes a container and draws into it may not call itself, because there is no
 * base case a form could have.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');

/** Every `.ts` under src/, as path and text. */
function sources(dir: string, prefix = ''): { path: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return sources(full, relative);
    return entry.name.endsWith('.ts') ? [{ path: relative, text: readFileSync(full, 'utf8') }] : [];
  });
}

/** A class method taking an element, one indent deep, up to its closing brace. */
const DRAWS_INTO =
  /^ {2}(?:(?:protected|private|public|override|abstract|async|\s)*)(\w+)\([^)]*HTMLElement/;

/**
 * The name and body of every method that is handed an element to draw into.
 *
 * The block is taken by indentation rather than by parsing: the sources are
 * formatted, so a method opened at two spaces closes at `  }` and nothing in
 * between closes there.
 */
function drawingMethods(text: string): { name: string; body: string }[] {
  const lines = text.split('\n');
  const found: { name: string; body: string }[] = [];
  lines.forEach((line, start) => {
    const match = DRAWS_INTO.exec(line);
    if (!match) return;
    const end = lines.findIndex((later, index) => index > start && later === '  }');
    found.push({
      name: match[1],
      body: lines.slice(start + 1, end === -1 ? undefined : end).join('\n'),
    });
  });
  return found;
}

describe('a form helper', () => {
  it('never calls itself', () => {
    const recursive = sources(SRC).flatMap((file) =>
      drawingMethods(file.text)
        .filter((method) => method.body.includes(`this.${method.name}(`))
        .map((method) => `${file.path}: ${method.name}`)
    );

    expect(recursive).toEqual([]);
  });

  it('is looking at the forms that draw the dates', () => {
    const byPath = new Map(sources(SRC).map((file) => [file.path, file.text]));
    const modals = byPath.get('ui/modals/new-para-modals.ts') ?? '';

    expect(drawingMethods(modals).map((method) => method.name)).toContain('dateFields');
  });
});
