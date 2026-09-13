/**
 * Moving what earlier versions kept into the folder it belongs in now.
 *
 * What has to hold, or a vault loses a year of import history without being
 * told:
 *
 * - both kinds of archived file are found, and nothing else in the folder is;
 * - the destination is the sibling of where the file actually is, not a path
 *   recomputed from settings that may have changed since;
 * - the stamp comes off the vault's own record of the file, because the run
 *   that wrote the name is over and nothing else remembers it;
 * - two files landing on one name inside a single plan do not collide.
 */
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { TFile } from './obsidian-stub';

vi.mock('obsidian', async () => {
  const stub = await vi.importActual<typeof import('./obsidian-stub')>('./obsidian-stub');
  return { TFile: stub.TFile, normalizePath: (path: string) => path };
});

const { planImportMigration, runImportMigration } = await import('../src/shared/migrate-imports');

const DOCUMENTS = '0 Plan/1 Daily/2026/_documents';
const IMPORTS = '0 Plan/1 Daily/2026/_imports';
/** 13 September 2026, 14:25:30 local, as a vault ctime. */
const CTIME = new Date(2026, 8, 13, 14, 25, 30).getTime();

/**
 * A vault holding the given files, each with the creation time it was given.
 *
 * `refuse` is how a file that will not move is staged: the real one is a lock
 * or a permission, and neither is reachable from a test.
 */
function vaultOf(files: Record<string, number>, refuse: (path: string) => boolean = () => false) {
  const made = new Set<string>();
  const moved: Record<string, string> = {};
  const paths = new Set(Object.keys(files));

  const fileFor = (path: string) => {
    const name = path.slice(path.lastIndexOf('/') + 1);
    return Object.assign(new TFile(), {
      path,
      name,
      basename: name.replace(/\.[^.]*$/, ''),
      extension: name.slice(name.lastIndexOf('.') + 1),
      parent: { name: path.split('/').slice(-2, -1)[0] ?? '' },
      stat: { ctime: files[path] ?? 0, mtime: files[path] ?? 0, size: 0 },
    });
  };

  const app = {
    vault: {
      getFiles: () => [...paths].map(fileFor),
      getFolderByPath: (path: string) =>
        made.has(path) || [...paths].some((one) => one.startsWith(`${path}/`))
          ? {
              path,
              children: [...paths]
                .filter((one) => one.slice(0, one.lastIndexOf('/')) === path)
                .map(fileFor),
            }
          : null,
      createFolder: (path: string) => {
        made.add(path);
        return Promise.resolve();
      },
    },
    fileManager: {
      renameFile: (file: TFile, to: string) => {
        if (refuse(file.path)) return Promise.reject(new Error('locked'));
        moved[file.path] = to;
        paths.delete(file.path);
        paths.add(to);
        return Promise.resolve();
      },
    },
  } as never;

  return { app, moved };
}

describe('planImportMigration', () => {
  it('finds both kinds of archived file and sends each to the sibling folder', () => {
    const { app } = vaultOf({
      [`${DOCUMENTS}/20260907-20260913_business.ics`]: CTIME,
      [`${DOCUMENTS}/20260401-20260626_1013.csv`]: CTIME,
    });
    expect(planImportMigration(app, DEFAULT_SETTINGS).moves.map((move) => move.to)).toEqual([
      `${IMPORTS}/20260913-142530_1013_20260401-20260626.csv`,
      `${IMPORTS}/20260913-142530_business_20260907-20260913.ics`,
    ]);
  });

  it('leaves alone everything in the folder that this plugin did not name', () => {
    // An invoice is what that folder is for, and a calendar somebody dropped in
    // themselves was never read as evidence and must not start being one.
    const { app } = vaultOf({
      [`${DOCUMENTS}/Rechnung Swisscom.pdf`]: CTIME,
      [`${DOCUMENTS}/Kalender 2026.ics`]: CTIME,
      [`${DOCUMENTS}/Kontoauszug.csv`]: CTIME,
      [`${DOCUMENTS}/20260907-20260913_business.ics`]: CTIME,
    });
    expect(planImportMigration(app, DEFAULT_SETTINGS).moves).toHaveLength(1);
  });

  it('picks up the numbered files the old reader could never see', () => {
    // The old scheme wrote `... 2.ics` for a second export of one range, and
    // its own pattern never matched a name with a space in it. Those files have
    // been sitting unread since the day they were written; under the new name
    // they start counting.
    const { app } = vaultOf({ [`${DOCUMENTS}/20260907-20260913_business 2.ics`]: CTIME });
    expect(planImportMigration(app, DEFAULT_SETTINGS).moves[0]?.to).toBe(
      `${IMPORTS}/20260913-142530_business_20260907-20260913.ics`
    );
  });

  it('moves a file into the sibling of where it is, not of where settings say', () => {
    // A vault whose daily-note folder was renamed since the import still has
    // its old files where they were put. Recomputing the path would build one
    // to a folder that holds none of them.
    const { app } = vaultOf({
      [`Old Plan/Days/2025/_documents/20250901-20250907_privat.ics`]: CTIME,
    });
    expect(planImportMigration(app, DEFAULT_SETTINGS).moves[0]?.to).toBe(
      'Old Plan/Days/2025/_imports/20260913-142530_privat_20250901-20250907.ics'
    );
  });

  it('falls back to the last day of the range when the vault has no date for the file', () => {
    // A synced vault reports zero for both times often enough to matter, and a
    // stamp of 1970 in a folder somebody browses is worse than a day that is at
    // least the right month.
    const { app } = vaultOf({ [`${DOCUMENTS}/20260907-20260913_business.ics`]: 0 });
    expect(planImportMigration(app, DEFAULT_SETTINGS).moves[0]?.to).toBe(
      `${IMPORTS}/20260913-000000_business_20260907-20260913.ics`
    );
  });

  it('keeps two files that land on one name apart', () => {
    const { app } = vaultOf({
      [`${DOCUMENTS}/20260907-20260913_business.ics`]: CTIME,
      [`${DOCUMENTS}/20260907-20260913_business 2.ics`]: CTIME,
    });
    const moves = planImportMigration(app, DEFAULT_SETTINGS).moves;
    expect(new Set(moves.map((move) => move.to)).size).toBe(2);
  });

  it('has nothing to do when the two folders are one folder, or either is blank', () => {
    const files = { [`${DOCUMENTS}/20260907-20260913_business.ics`]: CTIME };
    const { app } = vaultOf(files);
    for (const settings of [
      { ...DEFAULT_SETTINGS, importSubfolder: '_documents' },
      { ...DEFAULT_SETTINGS, importSubfolder: '' },
      { ...DEFAULT_SETTINGS, documentSubfolder: '' },
    ]) {
      expect(planImportMigration(app, settings).moves).toEqual([]);
    }
  });
});

describe('runImportMigration', () => {
  it('moves each file with Obsidians own rename, so links follow', async () => {
    const { app, moved } = vaultOf({ [`${DOCUMENTS}/20260907-20260913_business.ics`]: CTIME });
    const plan = planImportMigration(app, DEFAULT_SETTINGS);
    const result = await runImportMigration(app, plan.moves);

    expect(result).toEqual({ moved: 1, failed: [] });
    expect(moved[`${DOCUMENTS}/20260907-20260913_business.ics`]).toBe(
      `${IMPORTS}/20260913-142530_business_20260907-20260913.ics`
    );
  });

  it('is safe to run twice: the second time there is nothing left to find', async () => {
    const { app } = vaultOf({ [`${DOCUMENTS}/20260907-20260913_business.ics`]: CTIME });
    await runImportMigration(app, planImportMigration(app, DEFAULT_SETTINGS).moves);
    expect(planImportMigration(app, DEFAULT_SETTINGS).moves).toEqual([]);
  });

  it('names what would not move and moves the rest', async () => {
    // One locked file must not leave a vault half migrated with no way to say
    // which half.
    const stubborn = `${DOCUMENTS}/20260401-20260626_1013.csv`;
    const { app, moved } = vaultOf(
      {
        [`${DOCUMENTS}/20260907-20260913_business.ics`]: CTIME,
        [stubborn]: CTIME,
      },
      (path) => path === stubborn
    );

    const plan = planImportMigration(app, DEFAULT_SETTINGS);
    expect(await runImportMigration(app, plan.moves)).toEqual({ moved: 1, failed: [stubborn] });
    expect(moved[`${DOCUMENTS}/20260907-20260913_business.ics`]).toBeDefined();
  });
});
