/**
 * Where a rendering of a note lands.
 *
 * One rule and no exceptions: a subfolder of the folder the note is in. It is
 * the relationship `_resources` and `_documents` already have to the notes
 * beside them, which is why this replaced `tripExportFolder()` -- that put a
 * trip's sheets inside the folder the trip owned and left a flat trip's loose
 * among the notes, which is two rules where the vault only has one.
 *
 * Apart from the notes, because everything in the exports folder can be
 * deleted and made again from the note, and nothing else beside the note can.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { exportFolder, exportPath } from '../src/shared/export-folder';
import { mergeSettings } from '../src/settings/validate';
import { relativeVaultPath } from '../src/shared/vault-file';

const settings = { ...DEFAULT_SETTINGS };

describe('where a sheet lands', () => {
  it('is a subfolder of the folder the note is in', () => {
    expect(exportFolder(settings, 'Trips/Shongololo/Shongololo.md')).toBe(
      'Trips/Shongololo/_exports'
    );
  });

  /** The rule does not care whether the note owns its folder, which is the whole simplification. */
  it('is the same subfolder for a note that owns no folder', () => {
    expect(exportFolder(settings, 'Trips/Shongololo.md')).toBe('Trips/_exports');
  });

  /** Notes in one folder share one exports folder, exactly as they share one `_resources`. */
  it('is shared by every note in the folder', () => {
    expect(exportFolder(settings, 'Places/Landmarks/Tower.md')).toBe(
      exportFolder(settings, 'Places/Landmarks/Bridge.md')
    );
  });

  it('is beside the note when the setting is cleared', () => {
    expect(exportFolder({ ...settings, exportsSubfolder: '' }, 'Trips/Shongololo/X.md')).toBe(
      'Trips/Shongololo'
    );
  });

  /** A note at the vault root has no folder to be under, and the subfolder is then the whole path rather than '/_exports'. */
  it('handles a note with no folder above it', () => {
    expect(exportFolder(settings, 'Shongololo.md')).toBe('_exports');
    expect(exportFolder({ ...settings, exportsSubfolder: '' }, 'Shongololo.md')).toBe('');
  });

  it('builds the whole path from the note and the sheet name', () => {
    expect(exportPath(settings, 'Places/Vehicles/MS Trollfjord.md', 'MS Trollfjord brochure')).toBe(
      'Places/Vehicles/_exports/MS Trollfjord brochure.html'
    );
  });
});

/**
 * The link a brochure writes to a deck plan is relative to where the SHEET
 * lands, not to where the note is (note 41). Moving sheets a level down is
 * exactly the change that breaks such a link silently, so the combination is
 * asserted rather than assumed from the two halves.
 */
describe('a deck plan linked from a sheet one level down', () => {
  it('walks back up out of the exports folder', () => {
    const sheetFolder = exportFolder(settings, 'Places/Vehicles/MS Trollfjord.md');
    const plan = 'Places/Vehicles/_documents/decks.pdf';

    expect(relativeVaultPath(sheetFolder, plan)).toBe('../_documents/decks.pdf');
  });

  /** With the subfolder cleared the sheet is beside the note again, and the link shortens back. */
  it('does not walk up when the sheet sits beside the note', () => {
    const sheetFolder = exportFolder(
      { ...settings, exportsSubfolder: '' },
      'Places/Vehicles/MS Trollfjord.md'
    );

    expect(relativeVaultPath(sheetFolder, 'Places/Vehicles/_documents/decks.pdf')).toBe(
      '_documents/decks.pdf'
    );
  });
});

/**
 * `tripExportsSubfolder` covered trips only and defaulted to `Exports`. A
 * vault that never touched it was not choosing that name, it was taking
 * whatever came; a vault that typed its own meant it.
 */
describe('carrying the retired trip setting across', () => {
  it('takes the new default over the old default', () => {
    expect(mergeSettings({ tripExportsSubfolder: 'Exports' }).exportsSubfolder).toBe('_exports');
  });

  it('keeps a folder name somebody chose', () => {
    expect(mergeSettings({ tripExportsSubfolder: 'Sheets' }).exportsSubfolder).toBe('Sheets');
  });

  /** Blank is a choice too: it means "beside the note", and it is not the old default. */
  it('keeps a deliberately cleared setting cleared', () => {
    expect(mergeSettings({ tripExportsSubfolder: '' }).exportsSubfolder).toBe('');
  });

  it('prefers the new setting once it exists', () => {
    expect(
      mergeSettings({ exportsSubfolder: '_sheets', tripExportsSubfolder: 'Sheets' })
        .exportsSubfolder
    ).toBe('_sheets');
  });

  it('gives a vault that has neither the new default', () => {
    expect(mergeSettings({}).exportsSubfolder).toBe('_exports');
  });
});
