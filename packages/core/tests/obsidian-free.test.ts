/**
 * The invariant, asserted rather than trusted.
 *
 * ESLint's `no-restricted-imports` already forbids importing `obsidian` here,
 * but a lint rule is only run when somebody runs lint, and it can be silenced
 * with a disable comment in the same edit that breaks the rule. This reads the
 * source instead, so the whole package is checked by the ordinary test run.
 *
 * `src/obsidian/` is exempt by design: when the vault port lands, its Obsidian
 * implementation goes there and is the one file allowed to know.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const EXEMPT = 'obsidian';

function sourceFiles(dir: string, prefix = ''): { path: string; text: string }[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    const relative = prefix ? `${prefix}/${entry}` : entry;

    if (statSync(full).isDirectory()) {
      return entry === EXEMPT ? [] : sourceFiles(full, relative);
    }
    return entry.endsWith('.ts') ? [{ path: relative, text: readFileSync(full, 'utf8') }] : [];
  });
}

describe('the core is Obsidian-free', () => {
  const files = sourceFiles(SRC);

  it('has source files to check, so an empty walk cannot pass silently', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => file.path))('%s does not import obsidian', (path) => {
    const file = files.find((candidate) => candidate.path === path);
    expect(file).toBeDefined();
    expect(file?.text).not.toMatch(/from\s+['"]obsidian['"]/);
    expect(file?.text).not.toMatch(/require\(\s*['"]obsidian['"]\s*\)/);
  });

  it.each(files.map((file) => file.path))('%s touches no DOM global', (path) => {
    const file = files.find((candidate) => candidate.path === path);
    // A core module that reaches for `document` is a UI module that has not
    // noticed yet, and it would fail on the first non-browser host.
    expect(file?.text).not.toMatch(/\b(document|window|activeDocument)\./);
  });
});
