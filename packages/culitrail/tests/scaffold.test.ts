/**
 * Scaffold guards.
 *
 * Not a feature test. These pin the handful of facts about this repository
 * that other things silently depend on, and that are easy to break by hand
 * long before there is any feature code to notice.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, name), 'utf8')) as Record<string, unknown>;
}

describe('manifest.json', () => {
  const manifest = readJson('manifest.json');

  it('uses the plugin id the docs and the install path are written against', () => {
    // Changing this orphans every vault's .obsidian/plugins/culitrail folder
    // and every docs reference to it.
    expect(manifest.id).toBe('culitrail');
  });

  it('is not desktop-only', () => {
    // The meal view has a dedicated mobile layout, and a meal is looked up in
    // a kitchen as often as at a desk. Flipping this to true silently drops
    // one of the two platforms the plugin was designed around.
    expect(manifest.isDesktopOnly).toBe(false);
  });

  it('targets the same minimum Obsidian version the docs claim', () => {
    expect(manifest.minAppVersion).toBe('1.12.0');
  });
});

describe('package.json', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');

  it('agrees with manifest.json on the version', () => {
    // sync-version.js exists to keep these two in step on `npm version`.
    // This test is what notices when someone edits one by hand instead.
    expect(manifest.version).toBe(pkg.version);
  });

  it('declares the licence the inherited Recipe Box code requires', () => {
    // GPL-3.0-or-later is not a preference here, it travels with the code.
    // See NOTICE.md, and note that APERtrail is deliberately licensed
    // differently, so this is also the guard against copying the wrong
    // LICENSE file in from the sibling repo.
    expect(pkg.license).toBe('GPL-3.0-or-later');
  });

  it('ships a LICENSE that is actually the GPL', () => {
    const license = readFileSync(join(root, 'LICENSE'), 'utf8');
    expect(license).toContain('GNU GENERAL PUBLIC LICENSE');
    expect(license).toContain('Version 3, 29 June 2007');
  });
});
