/**
 * What writing an exported sheet does to the vault, over the in-memory host.
 *
 * APERtrail keeps a suite for its two-line Obsidian adapter; this is where the
 * decisions are: create or replace, every folder above, the path normalized,
 * say where, open, and what a failure in each step means.
 */
import { describe, expect, it } from 'vitest';
import { writeSheet, type SheetWriteHooks } from '../../src/vault/write-sheet';
import { makeFakeVault, type FakeFile } from './fake-host';

function hooks(over: { openThrows?: boolean } = {}) {
  const said: string[] = [];
  const opened: string[] = [];
  const value: SheetWriteHooks<FakeFile> = {
    notify: (message) => said.push(message),
    open: (file) => {
      if (over.openThrows) return Promise.reject(new Error('no leaf'));
      opened.push(file.path);
      return Promise.resolve();
    },
    written: (path) => `written ${path}`,
    failed: 'failed',
  };
  return { value, said, opened };
}

const PATH = 'Finance/_exports/Bilanz 2026-09-30.html';

describe('writing a sheet', () => {
  it('creates the file and every folder above it', async () => {
    const vault = makeFakeVault();
    const h = hooks();

    await writeSheet(vault.host, PATH, '<h1>B</h1>', h.value);

    expect(vault.notes.get(PATH)).toBe('<h1>B</h1>');
    expect(vault.writes.filter((w) => w.kind === 'folder').map((w) => w.path)).toEqual([
      'Finance',
      'Finance/_exports',
    ]);
  });

  it('replaces a sheet that is already there', async () => {
    const vault = makeFakeVault([{ path: PATH, content: 'old' }]);

    await writeSheet(vault.host, PATH, 'new', hooks().value);

    expect(vault.notes.get(PATH)).toBe('new');
    expect(vault.writes.map((w) => w.kind)).toEqual(['modify']);
  });

  it('normalizes the path', async () => {
    const vault = makeFakeVault();

    await writeSheet(vault.host, 'Finance//_exports/B.html', 'x', hooks().value);

    expect(vault.notes.has('Finance/_exports/B.html')).toBe(true);
  });

  it('says where it went, then opens it', async () => {
    const vault = makeFakeVault();
    const h = hooks();

    await writeSheet(vault.host, PATH, 'x', h.value);

    expect(h.said).toEqual([`written ${PATH}`]);
    expect(h.opened).toEqual([PATH]);
  });

  it('still reports the file when it cannot be shown', async () => {
    const vault = makeFakeVault();
    const h = hooks({ openThrows: true });

    const file = await writeSheet(vault.host, PATH, 'x', h.value);

    expect(file?.path).toBe(PATH);
    expect(h.said).toHaveLength(1);
  });

  it('says the vault refused and returns nothing', async () => {
    const vault = makeFakeVault();
    vault.host.vault.create = () => Promise.reject(new Error('read only'));
    const h = hooks();

    const file = await writeSheet(vault.host, PATH, 'x', h.value);

    expect(file).toBeNull();
    expect(h.said).toEqual(['read only']);
    expect(h.opened).toEqual([]);
  });
});
