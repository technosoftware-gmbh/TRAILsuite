/**
 * Every multiline row carries the class that makes it usable.
 *
 * Obsidian lays a setting row out as info on the left and control on the
 * right, and the control takes only the width it asks for -- so a textarea in
 * one is a small square however tall it is told to be, and a description of
 * any length squeezes it further. The row needs a class, not just the box.
 *
 * **This is a source-reading test because the alternative could not fail.**
 * The rule lived in DOM building, where this package deliberately does not
 * test, and the evidence that it does not hold on its own is that it did not:
 * `nod-form-multiline`'s predecessor was on exactly one field of one dialog
 * while six others -- a cabin's description, a vehicle's, a variant's, a day's
 * note, a motif's note and its technique -- were four words wide, and the one
 * that got noticed got noticed by somebody filling in a real ship.
 *
 * Removing the class from a row is what this goes red on. It has been done on
 * purpose and watched.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');
const CLASS = 'nod-form-multiline';

function sources(dir: string, out: { path: string; text: string }[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sources(full, out);
    else if (entry.name.endsWith('.ts')) out.push({ path: full, text: readFileSync(full, 'utf8') });
  }
  return out;
}

/**
 * Each `new Setting(...)` chain, as its own chunk of text.
 *
 * Split rather than parsed: a chain is written as one expression and always
 * starts with that call, so the text between one and the next is exactly the
 * one row's builder calls. A parser would be more correct and would be a
 * second thing to keep right.
 */
function settingChains(text: string): string[] {
  return text.split('new Setting(').slice(1);
}

describe('multiline setting rows', () => {
  const files = sources(SRC);

  it('has rows to check, so a broken scan cannot pass silently', () => {
    // A floor rather than a census: this plugin builds nearly every multiline
    // row through `FormModal.multiline`, so there are two written by hand and
    // a number here that tracked the total would fail on every new form. What
    // it guards is the scan -- a `settingChains` that stopped matching would
    // otherwise make the check below pass over nothing.
    const rows = files
      .flatMap((file) => settingChains(file.text))
      .filter((c) => c.includes('.addTextArea('));
    expect(rows.length).toBeGreaterThan(1);
  });

  it('gives every textarea row the class that lets it grow', () => {
    const missing: string[] = [];
    for (const file of files) {
      for (const chain of settingChains(file.text)) {
        const area = chain.indexOf('.addTextArea(');
        if (area === -1) continue;
        // Only what precedes the textarea in the same chain: a later chain in
        // the same chunk is somebody else's row.
        if (!chain.slice(0, area).includes(`.setClass('${CLASS}')`)) {
          const name = /\.setName\(([^)]*)\)/.exec(chain.slice(0, area))?.[1] ?? '(unnamed row)';
          missing.push(`${file.path.slice(SRC.length + 1)}: ${name}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
