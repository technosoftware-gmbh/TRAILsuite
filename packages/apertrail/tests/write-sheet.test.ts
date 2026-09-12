/**
 * What writing an exported sheet does to the vault.
 *
 * The four exporters had a copy of this each, and one had already lost a step:
 * the photo spot field sheet never made its parent folders, which was harmless
 * for exactly as long as it wrote beside a note whose folder already existed.
 * Moving sheets into `_exports/` would have made it fail on the first export
 * from any folder, and nothing would have caught it -- this suite is what was
 * missing (notes 44 and 45).
 *
 * A fake vault rather than the shared `fake-vault.ts`: that one is shaped for
 * the readers, and this is the one file in the plugin whose whole job is to
 * write and then show.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const notices: string[] = [];

vi.mock('obsidian', () => ({
  TFile: class {},
  Notice: class {
    constructor(message: string) {
      notices.push(message);
    }
  },
  normalizePath: (path: string) => path.replace(/\/+/g, '/').replace(/^\/|\/$/g, ''),
}));

const { writeSheet } = await import('../src/shared/write-sheet');
const { TFile } = await import('obsidian');

const LABELS = { written: 'sheet.written', failed: 'sheet.failed' };

interface Fake {
  app: Parameters<typeof writeSheet>[0];
  created: { path: string; content: string }[];
  modified: { path: string; content: string }[];
  folders: string[];
  opened: string[];
}

function fakeVault(existing: string[] = [], over: { openThrows?: boolean } = {}): Fake {
  const paths = new Set(existing);
  const created: Fake['created'] = [];
  const modified: Fake['modified'] = [];
  const folders: string[] = [];
  const opened: string[] = [];

  const fileFor = (path: string) =>
    Object.assign(new TFile(), { path, name: path.split('/').pop() });

  const app = {
    vault: {
      getAbstractFileByPath: (path: string) => (paths.has(path) ? fileFor(path) : null),
      createFolder: async (path: string) => {
        folders.push(path);
        paths.add(path);
      },
      getFileByPath: (path: string) => (paths.has(path) ? fileFor(path) : null),
      create: async (path: string, content: string) => {
        created.push({ path, content });
        paths.add(path);
        return fileFor(path);
      },
      modify: async (file: { path: string }, content: string) => {
        modified.push({ path: file.path, content });
      },
    },
    workspace: {
      getLeaf: () => ({
        // Records whatever it is handed, including nothing: an open the
        // writer should never have reached has to be visible as a call rather
        // than swallowed as a TypeError.
        openFile: async (file: { path: string } | null) => {
          if (over.openThrows) throw new Error('no leaf');
          opened.push(file?.path ?? '<nothing>');
        },
      }),
    },
  };

  return { app: app as unknown as Fake['app'], created, modified, folders, opened };
}

beforeEach(() => {
  notices.length = 0;
});

describe('writing a sheet', () => {
  it('creates the file when there is none', async () => {
    const vault = fakeVault();

    await writeSheet(vault.app, 'Places/Vehicles/_exports/Ship.html', '<h1>Ship</h1>', LABELS);

    expect(vault.created).toEqual([
      { path: 'Places/Vehicles/_exports/Ship.html', content: '<h1>Ship</h1>' },
    ]);
    expect(vault.modified).toEqual([]);
  });

  /**
   * Replacing rather than versioning: a sheet is a rendering of a note and can
   * be made again from it, so a folder of "Ship 2.html" would be worse than a
   * stale copy overwritten.
   */
  it('replaces the file when one is already there', async () => {
    const vault = fakeVault(['Places/Vehicles/_exports/Ship.html']);

    await writeSheet(vault.app, 'Places/Vehicles/_exports/Ship.html', '<h1>Again</h1>', LABELS);

    expect(vault.created).toEqual([]);
    expect(vault.modified).toEqual([
      { path: 'Places/Vehicles/_exports/Ship.html', content: '<h1>Again</h1>' },
    ]);
  });

  /**
   * The step the field sheet had lost. A note's own folder always exists; the
   * exports folder under it does not, until the first export.
   */
  it('makes every folder above the file', async () => {
    const vault = fakeVault();

    await writeSheet(vault.app, 'Places/Vehicles/_exports/Ship.html', '<h1>Ship</h1>', LABELS);

    expect(vault.folders).toEqual(['Places', 'Places/Vehicles', 'Places/Vehicles/_exports']);
  });

  it('makes no folder that is already there', async () => {
    const vault = fakeVault(['Places', 'Places/Vehicles']);

    await writeSheet(vault.app, 'Places/Vehicles/_exports/Ship.html', '<h1>Ship</h1>', LABELS);

    expect(vault.folders).toEqual(['Places/Vehicles/_exports']);
  });

  /** The path is normalized on the way in, so a folder setting with a stray slash does not become a folder named ''. */
  it('normalizes the path it was given', async () => {
    const vault = fakeVault();

    await writeSheet(vault.app, 'Places//Vehicles/_exports/Ship.html', '<h1>Ship</h1>', LABELS);

    expect(vault.created[0].path).toBe('Places/Vehicles/_exports/Ship.html');
    expect(vault.folders).toEqual(['Places', 'Places/Vehicles', 'Places/Vehicles/_exports']);
  });

  it('says where it went', async () => {
    const vault = fakeVault();

    await writeSheet(vault.app, 'Places/Vehicles/_exports/Ship.html', '<h1>Ship</h1>', LABELS);

    expect(notices).toHaveLength(1);
  });
});

describe('opening what was written', () => {
  it('opens the new file', async () => {
    const vault = fakeVault();

    await writeSheet(vault.app, 'Places/Vehicles/_exports/Ship.html', '<h1>Ship</h1>', LABELS);

    expect(vault.opened).toEqual(['Places/Vehicles/_exports/Ship.html']);
  });

  /** On a re-export as much as on the first write: checking a change is exactly when you want the result in front of you. */
  it('opens a replaced file too', async () => {
    const vault = fakeVault(['Places/Vehicles/_exports/Ship.html']);

    await writeSheet(vault.app, 'Places/Vehicles/_exports/Ship.html', '<h1>Again</h1>', LABELS);

    expect(vault.opened).toEqual(['Places/Vehicles/_exports/Ship.html']);
  });

  /**
   * A sheet that was written and could not be shown has still been written.
   * Every caller does `void exportSomething(...)`, so a rejection here would
   * turn a cosmetic problem into an unhandled one.
   */
  it('still reports success when it cannot be shown', async () => {
    const vault = fakeVault([], { openThrows: true });

    const file = await writeSheet(vault.app, 'A/_exports/S.html', '<h1>S</h1>', LABELS);

    expect(file).not.toBeNull();
    expect(vault.created).toHaveLength(1);
    expect(notices).toHaveLength(1);
  });
});

describe('when the vault refuses', () => {
  function refusingVault() {
    const vault = fakeVault();
    const app = vault.app as unknown as { vault: { create: () => Promise<never> } };
    app.vault.create = () => Promise.reject(new Error('read only'));
    return vault;
  }

  it('reports the failure and writes nothing', async () => {
    const vault = refusingVault();

    const file = await writeSheet(vault.app, 'A/_exports/S.html', '<h1>S</h1>', LABELS);

    expect(file).toBeNull();
    expect(notices).toEqual(['read only']);
  });

  /** Nothing to show, so nothing is opened: a tab onto a file that was never written is worse than no tab. */
  it('opens nothing', async () => {
    const vault = refusingVault();

    await writeSheet(vault.app, 'A/_exports/S.html', '<h1>S</h1>', LABELS);

    expect(vault.opened).toEqual([]);
  });
});
