/**
 * Note creation and writing, over the in-memory host.
 *
 * The assertions worth reading are the ones about how MANY writes a call makes:
 * one logical save has to produce one `modified` value, and a blank stamp
 * setting has to produce no frontmatter pass at all, because a host's
 * frontmatter editor gives a note with no block an empty one.
 */
import { describe, expect, it } from 'vitest';
import {
  createNote,
  ensureFolder,
  ensureParentFolders,
  getOrCreateNote,
  NoteExistsError,
  readNoteOrEmpty,
  touchCreated,
  touchModified,
  writeNote,
} from '../../src/vault/notes';
import { makeFakeVault } from './fake-host';

const STAMPS = { createdProperty: 'created', modifiedProperty: 'modified' };
const BLANK = { createdProperty: '', modifiedProperty: '' };
const NOW = new Date(2026, 7, 4, 16, 33);

describe('readNoteOrEmpty', () => {
  it('reads a note, and treats a missing one as empty', async () => {
    const { host } = makeFakeVault([{ path: 'A.md', content: 'hello' }]);
    expect(await readNoteOrEmpty(host, 'A.md')).toBe('hello');
    expect(await readNoteOrEmpty(host, 'Nope.md')).toBe('');
  });
});

describe('ensureFolder and ensureParentFolders', () => {
  it('creates a missing folder and skips an existing one', async () => {
    const { host, folders, writes } = makeFakeVault([{ path: 'Cooking/A.md' }]);
    await ensureFolder(host, 'Cooking');
    expect(writes.filter((w) => w.kind === 'folder')).toEqual([]);

    await ensureFolder(host, 'Travel');
    expect(folders.has('Travel')).toBe(true);
  });

  it('creates every intermediate level, which is the whole reason it exists', async () => {
    const { host, folders } = makeFakeVault();
    await ensureParentFolders(host, 'Cooking/Meal Plans/2026/2026-W33.md');

    expect([...folders]).toEqual(['Cooking', 'Cooking/Meal Plans', 'Cooking/Meal Plans/2026']);
  });

  it('does nothing for a blank path', async () => {
    const { host, writes } = makeFakeVault();
    await ensureFolder(host, '');
    expect(writes).toEqual([]);
  });
});

describe('createNote', () => {
  it('writes at folder/title.md and creates the folder', async () => {
    const { host, notes, folders } = makeFakeVault();
    const file = await createNote(host, 'Cooking/Recipes', 'Pad Thai', '---\ntype: recipe\n---\n');

    expect(file.path).toBe('Cooking/Recipes/Pad Thai.md');
    expect(file.basename).toBe('Pad Thai');
    expect(notes.get('Cooking/Recipes/Pad Thai.md')).toContain('type: recipe');
    expect(folders.has('Cooking/Recipes')).toBe(true);
  });

  it('replaces a separator in the title rather than making a folder out of it', async () => {
    const { host } = makeFakeVault();
    const file = await createNote(host, 'R', 'Sweet/Sour', '');
    expect(file.path).toBe('R/Sweet-Sour.md');
  });

  it('refuses rather than clobbering an existing note', async () => {
    const { host, notes } = makeFakeVault([{ path: 'R/Pad Thai.md', content: 'mine' }]);
    await expect(createNote(host, 'R', 'Pad Thai', 'theirs')).rejects.toBeInstanceOf(
      NoteExistsError
    );
    expect(notes.get('R/Pad Thai.md')).toBe('mine');
  });
});

describe('writeNote', () => {
  it('creates and stamps created, not modified', async () => {
    const { host, frontmatter } = makeFakeVault();
    await writeNote(host, STAMPS, 'Cooking/Lists/2026-W33.md', '# List');

    const written = frontmatter.get('Cooking/Lists/2026-W33.md');
    expect(Object.keys(written ?? {})).toEqual(['created']);
    expect(written?.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('overwrites and stamps modified, leaving created alone', async () => {
    const { host, notes, frontmatter } = makeFakeVault([
      { path: 'A.md', content: 'old', frontmatter: { created: '2020-01-01T09:00' } },
    ]);
    await writeNote(host, STAMPS, 'A.md', 'new');

    expect(notes.get('A.md')).toBe('new');
    expect(frontmatter.get('A.md')?.created).toBe('2020-01-01T09:00');
    expect(frontmatter.get('A.md')?.modified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('never backfills created onto a note that lacks one', async () => {
    const { host, frontmatter } = makeFakeVault([{ path: 'A.md', content: 'old' }]);
    await writeNote(host, STAMPS, 'A.md', 'new');

    expect(frontmatter.get('A.md')).not.toHaveProperty('created');
  });

  it('opens no frontmatter pass at all when the stamps are switched off', async () => {
    // Not an optimisation: a host's frontmatter editor gives a note with no
    // block an empty one, so a pass with nothing to write adds `---\n---`.
    const { host, writes } = makeFakeVault();
    await writeNote(host, BLANK, 'A.md', 'x');
    await writeNote(host, BLANK, 'A.md', 'y');

    expect(writes.filter((w) => w.kind === 'frontmatter')).toEqual([]);
  });
});

describe('getOrCreateNote', () => {
  it('creates and stamps when the note is missing', async () => {
    const { host, frontmatter } = makeFakeVault();
    const file = await getOrCreateNote(host, STAMPS, 'A/B.md', 'seed');

    expect(file.path).toBe('A/B.md');
    expect(frontmatter.get('A/B.md')).toHaveProperty('created');
  });

  it('hands an existing note back untouched, which is what makes it different from writeNote', async () => {
    const { host, notes, writes } = makeFakeVault([{ path: 'A.md', content: 'mine' }]);
    const file = await getOrCreateNote(host, STAMPS, 'A.md', 'seed');

    expect(file.path).toBe('A.md');
    expect(notes.get('A.md')).toBe('mine');
    expect(writes).toEqual([]);
  });
});

describe('touchCreated and touchModified', () => {
  it('stamp exactly one frontmatter pass each', async () => {
    const { host, writes } = makeFakeVault([{ path: 'A.md' }]);
    const file = host.vault.getFile('A.md')!;

    await touchCreated(host, STAMPS, file, NOW);
    await touchModified(host, STAMPS, file, NOW);

    expect(writes.filter((w) => w.kind === 'frontmatter')).toHaveLength(2);
  });

  it('write the minute-precision local stamp', async () => {
    const { host, frontmatter } = makeFakeVault([{ path: 'A.md' }]);
    const file = host.vault.getFile('A.md')!;

    await touchCreated(host, STAMPS, file, NOW);
    expect(frontmatter.get('A.md')?.created).toBe('2026-08-04T16:33');
  });

  it('honour a renamed property', async () => {
    const { host, frontmatter } = makeFakeVault([{ path: 'A.md' }]);
    const file = host.vault.getFile('A.md')!;

    await touchModified(
      host,
      { createdProperty: 'angelegt', modifiedProperty: 'geaendert' },
      file,
      NOW
    );
    expect(frontmatter.get('A.md')).toEqual({ geaendert: '2026-08-04T16:33' });
  });

  it('open no pass when their property is blank', async () => {
    const { host, writes } = makeFakeVault([{ path: 'A.md' }]);
    const file = host.vault.getFile('A.md')!;

    await touchCreated(host, BLANK, file, NOW);
    await touchModified(host, BLANK, file, NOW);
    expect(writes).toEqual([]);
  });
});
