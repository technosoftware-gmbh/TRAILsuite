/**
 * The UI conventions, asserted rather than trusted.
 *
 * `CLAUDE.md` lists these and a convention nobody checks lasts one release.
 * Each one below is here because breaking it is silent: none of them fails to
 * compile, and most do not fail lint either. The suite-wide statement of these
 * rules is `docs/ui-conventions.md`; this is one package's half of it.
 *
 * The `querySelector` rule earned its place the hard way, in NODAtrail: a modal
 * redrew itself by finding its own previous output and removing it, which throws
 * on the first render when there is none to find. A modal that throws in
 * `onOpen` shows an empty box rather than an error, so a check reported no
 * findings by failing before it had looked for any.
 *
 * **Where a query is legitimate it is named below with its reason**, rather than
 * the rule being dropped. Two shapes are legitimate and neither is that bug:
 * reading back DOM this plugin deliberately threw away, and reading DOM
 * Obsidian built. The second direction is checked too: an exemption that has
 * stopped being true is a comment asserting something false.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');

interface Source {
  path: string;
  text: string;
}

function sources(dir: string, prefix = ''): Source[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) return sources(full, relative);
    return entry.name.endsWith('.ts') ? [{ path: relative, text: readFileSync(full, 'utf8') }] : [];
  });
}

/** The files that break a rule, so a failure names them rather than merely counting. */
function offenders(files: readonly Source[], pattern: RegExp): string[] {
  return files
    .filter((file) => pattern.test(file.text))
    .map((file) => file.path)
    .sort();
}

const QUERY = /\.querySelector(All)?\s*\(/;

/** Files allowed to query, each with the reason it is not the bug above. */
const MAY_QUERY: Record<string, string> = {
  'meals/gallery/gallery-view.ts':
    'restores search focus and caret across a full redraw; the old subtree is discarded on purpose, so there is no reference left to keep, and every read is null-guarded',
  'orders/view/order-view.ts': 'the same focus restore, for the orders list',
  'planning/view/drag.ts':
    'clears the drop-target class from every column at once, a sweep rather than a lookup of something it holds',
  'settings/view/rows.ts':
    "filters Obsidian's own .setting-item rows, which this plugin did not build and holds no reference to",
};

describe('UI conventions', () => {
  const files = sources(SRC);

  it('has source to check, so a broken walk cannot pass silently', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('never queries the document for DOM it built itself', () => {
    const unexplained = offenders(files, QUERY).filter((path) => !(path in MAY_QUERY));
    expect(unexplained).toEqual([]);
  });

  it('exempts nothing that has stopped querying', () => {
    const queried = new Set(offenders(files, QUERY));
    const stale = Object.keys(MAY_QUERY).filter((path) => !queried.has(path));
    expect(stale.sort()).toEqual([]);
  });

  it('builds elements rather than assigning markup', () => {
    expect(offenders(files, /\.(inner|outer)HTML\b/)).toEqual([]);
  });

  it('leaves no console logging in shipped code', () => {
    // Obsidian's own plugin review flags this directly.
    expect(offenders(files, /\bconsole\.(log|debug|info)\s*\(/)).toEqual([]);
  });

  it('styles through classes rather than through inline style assignment', () => {
    // `setCssProps` is the exception and is for genuinely dynamic values; a
    // direct `element.style.x =` is a look decided somewhere styles.css cannot
    // see.
    expect(offenders(files, /\.style\.[A-Za-z-]+\s*=/)).toEqual([]);
  });

  it('hands no bare async callback to an event listener', () => {
    // A floating promise in a listener is a rejection nobody sees. Make the
    // callback synchronous and `void` the call inside it.
    expect(offenders(files, /addEventListener\([^)]*,\s*async\s/)).toEqual([]);
  });
});
