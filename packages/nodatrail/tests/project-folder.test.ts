/**
 * A project as a folder, and the grouping folder that must keep working.
 *
 * A project here collects documents over weeks, a hundred a year. A folder each
 * puts the note, its papers and its picture together and lets archiving move
 * all three.
 *
 * **Ownership is read off the vault rather than out of a setting**: a project
 * owns its folder when the folder carries the note's own name. That is the
 * whole rule, and it is what lets `3 Projekte/Fotografie/` keep behaving as it
 * always has -- it holds two projects and is named after neither, so neither
 * owns it and archiving one moves that note alone.
 *
 * The second guard is subtler and this file exists mostly for it: a folder
 * holding **two** notes is a grouping folder that happens to share a name with
 * one of them. Taking it would take the other note into the archive with it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { newProjectFolder, ownsFolderNamed } from '../src/para/project-folder';

describe('where a new project is written', () => {
  it('goes into a folder named after it', () => {
    expect(newProjectFolder(DEFAULT_SETTINGS, 'CN-1095688')).toBe(
      `${DEFAULT_SETTINGS.projectsFolder}/CN-1095688`
    );
  });

  it('goes straight into the projects root when the setting is off', () => {
    const flat = { ...DEFAULT_SETTINGS, projectFolderPerNote: false };
    expect(newProjectFolder(flat, 'CN-1095688')).toBe(flat.projectsFolder);
  });

  it('falls back to the root rather than making a folder with no name', () => {
    expect(newProjectFolder(DEFAULT_SETTINGS, '   ')).toBe(DEFAULT_SETTINGS.projectsFolder);
  });
});

describe('whether a note owns its folder', () => {
  it('owns one that carries its name and holds only it', () => {
    expect(ownsFolderNamed('CN-1095688', 'CN-1095688', ['CN-1095688.md'])).toBe(true);
  });

  it('owns nothing in a grouping folder', () => {
    // The real one: two projects under `Fotografie`, named after neither.
    const notes = ['365 Tage, jeden Tag ein Bild.md', 'Alte Dias einscannen.md'];
    expect(ownsFolderNamed('365 Tage, jeden Tag ein Bild', 'Fotografie', notes)).toBe(false);
    expect(ownsFolderNamed('Alte Dias einscannen', 'Fotografie', notes)).toBe(false);
  });

  it('refuses a folder that shares its name but holds another note too', () => {
    // The guard this file is mostly for. Moving that folder would take the
    // second note into the archive with it.
    expect(ownsFolderNamed('CN-1095688', 'CN-1095688', ['CN-1095688.md', 'Notizen.md'])).toBe(
      false
    );
  });

  it('refuses a folder holding no note at all, which cannot happen and is not assumed', () => {
    expect(ownsFolderNamed('CN-1095688', 'CN-1095688', [])).toBe(false);
  });
});

describe('what archiving moves', () => {
  const source = readFileSync(join(__dirname, '..', 'src', 'para', 'archive.ts'), 'utf8');

  it('moves the folder when the project owns one, and the note otherwise', () => {
    expect((source.match(/const owned = ownedFolder\(file\);/g) ?? []).length).toBe(2);
    expect((source.match(/const moving = owned \?\? file;/g) ?? []).length).toBe(2);
    expect(source).toContain('renameFile(moving, target)');
    expect(source).not.toContain('renameFile(file, target)');
  });

  it('reports the note path even when a folder moved, so a caller can open it', () => {
    expect((source.match(/owned \? `\$\{target\}\/\$\{file\.name\}` : target/g) ?? []).length).toBe(
      2
    );
  });

  it('does the same on the way back, so documents return with the project', () => {
    const back = source.slice(source.indexOf('export async function unarchiveNote'));
    expect(back).toContain('ownedFolder(file)');
    expect(back).toContain('renameFile(moving, target)');
  });
});

describe('the picture, after its folder moved under it', () => {
  const source = readFileSync(join(__dirname, '..', 'src', 'para', 'archive.ts'), 'utf8');

  /** The rewrite, as the module performs it, so the rule can be exercised without a vault. */
  const repoint = (value: string, from: string, to: string) =>
    value.startsWith(`${from}/`) ? `${to}/${value.slice(from.length + 1)}` : value;

  it('follows the folder it was inside', () => {
    // The bug this exists for, from the real note: the file moved into the
    // archive with its folder and `image:` still named where it used to be.
    // Obsidian rewrites links on a rename; `image:` is a plain path, not a
    // link, so nothing rewrote it and the picture vanished from the note while
    // the file sat intact in the folder that had just moved.
    expect(
      repoint(
        '3 Projekte/Alte Dias einscannen/_resources/AlteDiasEinscannen.jpeg',
        '3 Projekte/Alte Dias einscannen',
        '6 Archiv/3 Projekte/2026/Alte Dias einscannen'
      )
    ).toBe('6 Archiv/3 Projekte/2026/Alte Dias einscannen/_resources/AlteDiasEinscannen.jpeg');
  });

  it('leaves an image that lives somewhere else alone', () => {
    // It did not move. Rewriting it would point the note at a file that was
    // never there.
    const elsewhere = 'Plätze/States/_resources/Schaffhausen.png';
    expect(
      repoint(elsewhere, '3 Projekte/Ein Projekt', '6 Archiv/3 Projekte/2026/Ein Projekt')
    ).toBe(elsewhere);
  });

  it('leaves a bare name alone, because those resolve by search', () => {
    expect(repoint('TT_Tom_ohne', '3 Projekte/X', '6 Archiv/3 Projekte/2026/X')).toBe(
      'TT_Tom_ohne'
    );
  });

  it('is done on both ways, and only when a folder actually moved', () => {
    expect((source.match(/if \(owned\) await retargetImage\(/g) ?? []).length).toBe(2);
  });

  it('captures the old path before the rename, not after', () => {
    // The ordering is the bug, not the line. After a rename `moving.path` is
    // the NEW path, so `from === to`, the rewrite bails out and the picture
    // stays broken -- with the code still reading as though it repointed it.
    for (const fn of ['export async function archiveNote', 'export async function unarchiveNote']) {
      const body = source.slice(source.indexOf(fn));
      const captured = body.indexOf('const from = moving.path;');
      const renamed = body.indexOf('renameFile(moving, target)');
      expect(captured).toBeGreaterThan(-1);
      expect(renamed).toBeGreaterThan(-1);
      expect(captured).toBeLessThan(renamed);
    }
  });

  it('does nothing when the image property is turned off', () => {
    expect(source).toContain('const key = settings.imageProperty.trim();');
    expect(source).toContain('if (!key || from === to) return;');
  });
});
