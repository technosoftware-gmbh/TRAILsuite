/**
 * The App-facing half of the CRM reader: which notes count, and what a
 * blank setting does.
 *
 * The folder-AND-type rule is the same one every travel entity is judged
 * by, but the type VALUE is a setting here rather than a literal, so the
 * cases worth covering are the ones where that setting is renamed or
 * cleared.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
}));

import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { crmTagValues, readCrmBoard } from '../src/crm/read-crm';
import { makeFakeVault, FakeNote } from './fake-vault';

const P = DEFAULT_SETTINGS.personsFolder;
const C = DEFAULT_SETTINGS.companiesFolder;

const NOTES: FakeNote[] = [
  { path: `${P}/Gaby.md`, frontmatter: { type: 'person', tags: ['Friends'], mobile: '+41 79 1' } },
  { path: `${P}/Marc.md`, frontmatter: { type: 'person', tags: 'Friends, Photography' } },
  { path: `${P}/Notes.md`, frontmatter: { type: 'note' } },
  {
    path: `${C}/Basel Tourismus.md`,
    frontmatter: {
      type: 'company',
      tags: ['Tourism'],
      website: 'https://www.basel.com/',
      phone: '+41 61 1',
    },
  },
  { path: `${C}/Rhätische Bahn.md`, frontmatter: { type: 'company', tags: ['Transport'] } },
  // Right type, wrong folder: a company note filed somewhere else is not
  // this plugin's to find, exactly as with the travel types.
  { path: `4 Resources/Firmen/Acme AG.md`, frontmatter: { type: 'company' } },
];

function board(overrides: Partial<typeof DEFAULT_SETTINGS> = {}) {
  const { app } = makeFakeVault(NOTES);
  return readCrmBoard(app, { ...DEFAULT_SETTINGS, ...overrides });
}

describe('readCrmBoard', () => {
  it('returns only correctly typed notes from each configured folder, title-sorted', () => {
    const b = board();
    expect(b.persons.map((p) => p.title)).toEqual(['Gaby', 'Marc']);
    expect(b.companies.map((c) => c.title)).toEqual(['Basel Tourismus', 'Rhätische Bahn']);
  });

  it('parses each entity type into its own shape', () => {
    const b = board();
    expect(b.persons[0].mobile).toBe('+41 79 1');
    expect(b.persons[1].tags).toEqual(['Friends', 'Photography']);
    expect(b.companies[0].website).toBe('https://www.basel.com/');
    expect(b.companies[0].phone).toBe('+41 61 1');
  });

  it('leaves a field null when the note does not carry it', () => {
    const marc = board().persons[1];
    expect(marc.mobile).toBeNull();
    expect(marc.email).toBeNull();
    expect(marc.description).toBeNull();
  });

  it('skips a folder left blank rather than scanning the whole vault', () => {
    expect(board({ personsFolder: '   ' }).persons).toEqual([]);
    expect(board({ companiesFolder: '' }).companies).toEqual([]);
  });

  it('finds nothing when the type value is cleared, rather than everything in the folder', () => {
    expect(board({ personTypeValue: '' }).persons).toEqual([]);
  });

  it('honours a renamed type value and a renamed type property', () => {
    const { app } = makeFakeVault([
      { path: `${P}/Rita.md`, frontmatter: { typ: 'Kontakt' } },
      { path: `${P}/Ignored.md`, frontmatter: { typ: 'person' } },
    ]);
    const b = readCrmBoard(app, {
      ...DEFAULT_SETTINGS,
      typePropertyName: 'typ',
      personTypeValue: 'Kontakt',
    });
    expect(b.persons.map((p) => p.title)).toEqual(['Rita']);
  });

  /** Same tolerance the travel readers now have, for the same reason: see read-entities.test.ts. */
  it('still counts a note whose type value is list-shaped', () => {
    const { app } = makeFakeVault([
      { path: `${P}/Rita.md`, frontmatter: { type: ['person', 'draft'] } },
      { path: `${P}/Notes.md`, frontmatter: { type: ['note'] } },
    ]);
    expect(readCrmBoard(app, DEFAULT_SETTINGS).persons.map((p) => p.title)).toEqual(['Rita']);
  });

  it("reads each type's tags from its own tag property", () => {
    const { app } = makeFakeVault([
      { path: `${P}/Rita.md`, frontmatter: { type: 'person', personTags: ['Familie'] } },
      { path: `${C}/RhB.md`, frontmatter: { type: 'company', companyTags: ['Transport'] } },
    ]);
    const b = readCrmBoard(app, {
      ...DEFAULT_SETTINGS,
      personTagProperty: 'personTags',
      companyTagProperty: 'companyTags',
    });
    expect(b.persons[0].tags).toEqual(['Familie']);
    expect(b.companies[0].tags).toEqual(['Transport']);
  });
});

describe('crmTagValues', () => {
  it('collects every tag across both types once, sorted', () => {
    expect(crmTagValues(board())).toEqual(['Friends', 'Photography', 'Tourism', 'Transport']);
  });
});
