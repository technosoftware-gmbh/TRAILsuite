/**
 * Where an archived note is filed, and what must not move.
 *
 * Around a hundred projects a year end up in the archive here. A year folder is
 * what keeps that browsable; a month folder would be twelve folders of ten and
 * a memory test, and the active folders stay flat because fifteen run at a time
 * and a running project filed under the month it started is filed where nobody
 * would look for it.
 *
 * **The year is when it was archived**, not when the note was made: this is the
 * shelf a thing is put on, and the day it was put there is the one fact the
 * move itself knows.
 *
 * The rule that carries the risk is the other one. A note already filed under
 * last year's folder is archived, and the "is this already archived?" question
 * has to be asked of the **category** folder rather than this year's -- or
 * re-archiving would drag every old note forward into the current year,
 * restamping and moving things that were already where they belonged.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isUnderFolder } from '@technosoftware/trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { archiveFolderFor, archiveFolderOn } from '../src/vault/entity-types';

const IN_2026 = new Date(2026, 7, 29);
const source = readFileSync(join(__dirname, '..', 'src', 'para', 'archive.ts'), 'utf8');

describe('the folder a note is archived into', () => {
  it('is the category, then the year it was archived in', () => {
    expect(archiveFolderOn(DEFAULT_SETTINGS, 'project', IN_2026)).toBe(
      `${archiveFolderFor(DEFAULT_SETTINGS, 'project')}/2026`
    );
  });

  it('is the category alone when year folders are off', () => {
    const flat = { ...DEFAULT_SETTINGS, archiveYearFolders: false };
    expect(archiveFolderOn(flat, 'project', IN_2026)).toBe(archiveFolderFor(flat, 'project'));
  });

  it('stays inside the category folder either way, so reading is unaffected', () => {
    // The archive readers ask for the category and `isUnderFolder` matches
    // everything beneath it. This is what lets the setting be turned on or off
    // without stranding a note that is already filed.
    const category = archiveFolderFor(DEFAULT_SETTINGS, 'project');
    expect(category).not.toBeNull();
    for (const settings of [DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, archiveYearFolders: false }]) {
      const folder = archiveFolderOn(settings, 'project', IN_2026);
      expect(isUnderFolder(`${folder}/Ein Projekt.md`, category)).toBe(true);
    }
  });

  it('answers null for a kind with no archive category', () => {
    const none = { ...DEFAULT_SETTINGS, archiveFolder: '' };
    expect(archiveFolderOn(none, 'project', IN_2026)).toBeNull();
  });
});

describe('re-archiving something already filed', () => {
  it('asks the category folder, not this year one', () => {
    // The whole bug in one assertion. Against the dated folder, a note in
    // Projects/2025 would read as not archived and be moved into 2026.
    expect(source).toContain('const archiveRoot = archiveFolderFor(settings, type);');
    expect(source).toContain('if (archiveRoot && isArchivedPath(file.path, archiveRoot))');
    expect(source).not.toContain('isArchivedPath(file.path, destinationFolder)');
  });

  it('still moves into the dated folder when it is not archived yet', () => {
    expect(source).toContain('archiveFolderOn(settings, type, today)');
  });
});

describe('the archive sub-folder each kind uses', () => {
  it('comes from a setting rather than a literal', () => {
    // It was `Projects`, hardcoded -- the one folder name in the plugin that
    // did not come from the translation tables, which is why a German vault
    // ended up with `6 Archiv/Projects` among `1 Bereiche` and `3 Projekte`.
    const named = { ...DEFAULT_SETTINGS, projectsArchiveFolder: 'Projekte' };
    expect(archiveFolderFor(named, 'project')).toBe(`${named.archiveFolder}/Projekte`);
    expect(archiveFolderOn(named, 'project', IN_2026)).toBe(`${named.archiveFolder}/Projekte/2026`);
  });

  it('is separate per kind, so renaming one leaves the others alone', () => {
    const named = { ...DEFAULT_SETTINGS, projectsArchiveFolder: 'Projekte' };
    expect(archiveFolderFor(named, 'goal')).toBe(
      `${named.archiveFolder}/${DEFAULT_SETTINGS.goalsArchiveFolder}`
    );
  });

  it('refuses to archive a kind whose sub-folder was blanked', () => {
    // The fail-safe direction: an empty name would otherwise file the note
    // straight into the archive root, mixed with every other kind.
    const blank = { ...DEFAULT_SETTINGS, projectsArchiveFolder: '   ' };
    expect(archiveFolderFor(blank, 'project')).toBeNull();
    expect(archiveFolderOn(blank, 'project', IN_2026)).toBeNull();
  });

  it('still defaults to the English names, which the localized defaults override', () => {
    expect(DEFAULT_SETTINGS.projectsArchiveFolder).toBe('Projects');
  });
});
