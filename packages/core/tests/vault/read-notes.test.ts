/**
 * Reading notes by folder and type.
 *
 * The rules with teeth are the two refusals: a blank type value matches nothing
 * rather than everything, and folder AND type are both required. Both are the
 * safer half of a choice where the other half fails silently and at scale.
 */
import { describe, expect, it } from 'vitest';
import {
  indexByTitle,
  isNoteOfType,
  matchesType,
  readNotesOfType,
  resolveByTitle,
  type NoteKindQuery,
} from '../../src/vault/read-notes';
import { makeFakeVault } from './fake-host';

const RECIPES: NoteKindQuery = {
  folders: ['Cooking/Recipes'],
  typePropertyName: 'type',
  typeValue: 'recipe',
};

const VAULT = [
  { path: 'Cooking/Recipes/Pad Thai.md', frontmatter: { type: 'recipe' } },
  { path: 'Cooking/Recipes/Lasagne.md', frontmatter: { type: 'recipe' } },
  { path: 'Cooking/Recipes/Notes to self.md', frontmatter: { type: 'note' } },
  { path: 'Cooking/Recipes/Untyped.md', frontmatter: {} },
  { path: 'Travel/Trips/Vienna.md', frontmatter: { type: 'recipe' } },
];

describe('matchesType', () => {
  it('matches the exact value after trimming', () => {
    expect(matchesType({ type: ' recipe ' }, 'type', 'recipe')).toBe(true);
  });

  it('never matches a blank expected value', () => {
    // The safer half of the choice: an unset setting hides its folder rather
    // than claiming every note in it.
    expect(matchesType({ type: 'recipe' }, 'type', '')).toBe(false);
    expect(matchesType({}, 'type', '')).toBe(false);
  });

  it('is case-sensitive, so a vault can distinguish person from Person', () => {
    expect(matchesType({ type: 'Recipe' }, 'type', 'recipe')).toBe(false);
  });

  it('reads a list, which a property editor produces without anybody deciding to', () => {
    expect(matchesType({ type: ['recipe'] }, 'type', 'recipe')).toBe(true);
    expect(matchesType({ type: ['recipe', 'draft'] }, 'type', 'recipe')).toBe(true);
    expect(matchesType({ type: ['draft'] }, 'type', 'recipe')).toBe(false);
  });

  it('unwraps a wikilink-shaped value', () => {
    expect(matchesType({ type: '[[recipe]]' }, 'type', 'recipe')).toBe(true);
  });

  it('falls back to `type` when no property name is configured', () => {
    expect(matchesType({ type: 'recipe' }, '', 'recipe')).toBe(true);
  });

  it('honours a renamed type property', () => {
    expect(matchesType({ kind: 'recipe' }, 'kind', 'recipe')).toBe(true);
    expect(matchesType({ type: 'recipe' }, 'kind', 'recipe')).toBe(false);
  });
});

describe('readNotesOfType', () => {
  it('returns folder AND type matches, title-sorted', () => {
    const { host } = makeFakeVault(VAULT);
    expect(readNotesOfType(host, RECIPES).map((note) => note.title)).toEqual([
      'Lasagne',
      'Pad Thai',
    ]);
  });

  it('excludes the right note for each of the two reasons', () => {
    const { host } = makeFakeVault(VAULT);
    const titles = readNotesOfType(host, RECIPES).map((note) => note.title);

    expect(titles).not.toContain('Notes to self'); // right folder, wrong type
    expect(titles).not.toContain('Vienna'); // right type, wrong folder
    expect(titles).not.toContain('Untyped');
  });

  it('returns nothing when no folder is configured', () => {
    const { host } = makeFakeVault(VAULT);
    expect(readNotesOfType(host, { ...RECIPES, folders: [] })).toEqual([]);
    expect(readNotesOfType(host, { ...RECIPES, folders: ['', '  '] })).toEqual([]);
  });

  it('returns nothing when the type value is blank', () => {
    const { host } = makeFakeVault(VAULT);
    expect(readNotesOfType(host, { ...RECIPES, typeValue: '' })).toEqual([]);
  });

  it('carries the frontmatter through, so a caller reads it once', () => {
    const { host } = makeFakeVault(VAULT);
    expect(readNotesOfType(host, RECIPES)[0]?.frontmatter).toEqual({ type: 'recipe' });
  });
});

describe('isNoteOfType', () => {
  it('answers on the same terms as the bulk read', () => {
    const { host } = makeFakeVault(VAULT);
    const inFolder = host.vault.getFile('Cooking/Recipes/Pad Thai.md')!;
    const wrongType = host.vault.getFile('Cooking/Recipes/Notes to self.md')!;
    const wrongFolder = host.vault.getFile('Travel/Trips/Vienna.md')!;

    expect(isNoteOfType(host, inFolder, RECIPES)).toBe(true);
    expect(isNoteOfType(host, wrongType, RECIPES)).toBe(false);
    expect(isNoteOfType(host, wrongFolder, RECIPES)).toBe(false);
  });

  it('agrees with readNotesOfType on every note in the vault', () => {
    // The two cannot be allowed to disagree about what a recipe is.
    const { host } = makeFakeVault(VAULT);
    const bulk = new Set(readNotesOfType(host, RECIPES).map((note) => note.file.path));

    for (const file of host.vault.markdownFiles()) {
      expect(isNoteOfType(host, file, RECIPES)).toBe(bulk.has(file.path));
    }
  });
});

describe('indexByTitle and resolveByTitle', () => {
  it('resolves by title, ignoring case and space', () => {
    const { host } = makeFakeVault(VAULT);
    const index = indexByTitle(readNotesOfType(host, RECIPES));

    expect(resolveByTitle(index, ' pad thai ')?.title).toBe('Pad Thai');
  });

  it('is null for a link matching nothing, which is a renamed note not an error', () => {
    const { host } = makeFakeVault(VAULT);
    const index = indexByTitle(readNotesOfType(host, RECIPES));

    expect(resolveByTitle(index, 'Deleted')).toBeNull();
    expect(resolveByTitle(index, null)).toBeNull();
    expect(resolveByTitle(index, undefined)).toBeNull();
    expect(resolveByTitle(index, '')).toBeNull();
  });

  it('lets the first of a duplicate pair win, so a sorted input resolves deterministically', () => {
    const { host } = makeFakeVault([
      { path: 'A/Pad Thai.md', frontmatter: { type: 'recipe' } },
      { path: 'B/Pad Thai.md', frontmatter: { type: 'recipe' } },
    ]);
    const index = indexByTitle(readNotesOfType(host, { ...RECIPES, folders: ['A', 'B'] }));
    expect(index.size).toBe(1);
    expect(resolveByTitle(index, 'Pad Thai')?.file.path).toBe('A/Pad Thai.md');
  });
});
