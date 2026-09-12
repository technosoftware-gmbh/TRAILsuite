/**
 * The UI conventions, asserted rather than trusted.
 *
 * `CLAUDE.md` lists these and a convention nobody checks lasts one release. Each
 * one below is here because breaking it is silent: none of them fails to
 * compile, and the first three do not fail lint either.
 *
 * The `querySelector` rule earned its place the hard way. A modal redrew itself
 * by finding its own previous output and removing it, which throws on the first
 * render when there is none to find. A modal that throws in `onOpen` shows an
 * empty box rather than an error, so the vault check reported no findings by
 * failing before it had looked for any, and the suite had nothing to say about
 * it. This plugin builds the DOM it owns and keeps the references it needs;
 * asking the document to find them again is how that bug gets written.
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

describe('UI conventions', () => {
  const files = sources(SRC);

  it('has source to check, so a broken walk cannot pass silently', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('never queries the document for DOM it built itself', () => {
    // Rebuild from empty and keep the references you need. A query returns
    // null the first time round, and a null dereference in onOpen is a blank
    // modal rather than a visible error.
    expect(offenders(files, /\.querySelector(All)?\s*\(/)).toEqual([]);
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
