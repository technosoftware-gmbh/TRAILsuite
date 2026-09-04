/**
 * Reading Person notes for the trip editor's "who came along" field.
 *
 * The behaviour worth pinning down is the empty-tag-filter default: an
 * unconfigured filter must mean "everyone", not "nobody". Getting that
 * backwards produces an empty dropdown with no explanation, which reads as
 * a broken plugin rather than an unset setting.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
}));

import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { getEligiblePersonTitles, getPersonTitles } from '../src/crm/persons';
import { makeFakeVault, FakeNote } from './fake-vault';

const P = DEFAULT_SETTINGS.personsFolder;

const NOTES: FakeNote[] = [
  { path: `${P}/Stefan.md`, frontmatter: { type: 'person', tags: ['household'] } },
  { path: `${P}/Anna.md`, frontmatter: { type: 'person', tags: 'household, work' } },
  { path: `${P}/Zoe.md`, frontmatter: { type: 'person' } },
  { path: `${P}/Acme AG.md`, frontmatter: { type: 'company' } },
  { path: `4 Resources/Books/Some Author.md`, frontmatter: { type: 'person' } },
];

function titles(notes: FakeNote[], overrides: Partial<typeof DEFAULT_SETTINGS> = {}) {
  const { app } = makeFakeVault(notes);
  return getEligiblePersonTitles(app, { ...DEFAULT_SETTINGS, ...overrides });
}

describe('person lookup', () => {
  it('returns only typed Person notes inside the configured folder, sorted', () => {
    const { app } = makeFakeVault(NOTES);
    expect(getPersonTitles(app, DEFAULT_SETTINGS)).toEqual(['Anna', 'Stefan', 'Zoe']);
  });

  it('offers everyone when no eligible tags are configured', () => {
    expect(titles(NOTES)).toEqual(['Anna', 'Stefan', 'Zoe']);
  });

  it('narrows to tagged people when eligible tags are configured', () => {
    expect(titles(NOTES, { eligiblePersonTags: 'household' })).toEqual(['Anna', 'Stefan']);
  });

  it('reads a comma-separated tag string as well as a tag array', () => {
    expect(titles(NOTES, { eligiblePersonTags: 'work' })).toEqual(['Anna']);
  });

  it('returns nothing when the folder or type value is blank rather than matching everything', () => {
    expect(titles(NOTES, { personsFolder: '  ' })).toEqual([]);
    expect(titles(NOTES, { personTypeValue: '' })).toEqual([]);
    expect(titles(NOTES, { personsFolder: '  ', eligiblePersonTags: 'household' })).toEqual([]);
  });

  it('honours a renamed type property', () => {
    expect(
      titles([{ path: `${P}/Rita.md`, frontmatter: { typ: 'person' } }], {
        typePropertyName: 'typ',
      })
    ).toEqual(['Rita']);
  });

  /**
   * The tags a real vault carries, rather than the ones an exact string
   * comparison would like it to. Every person here was silently absent from the
   * trip editor's dropdown before shared/tag-filter.ts did the comparing.
   */
  describe('tags as people actually write them', () => {
    const HAND_WRITTEN: FakeNote[] = [
      { path: `${P}/Erika.md`, frontmatter: { type: 'person', tags: ['Familie'] } },
      { path: `${P}/Jan.md`, frontmatter: { type: 'person', tags: ['familie'] } },
      { path: `${P}/Nora.md`, frontmatter: { type: 'person', tags: ['#Familie'] } },
      { path: `${P}/Piet.md`, frontmatter: { type: 'person', tags: ['Familie/Eltern'] } },
      { path: `${P}/Rolf.md`, frontmatter: { type: 'person', tags: ['FamilienFirma'] } },
      { path: `${P}/Gaby.md`, frontmatter: { type: 'person', tags: ['Freunde'] } },
    ];

    it('admits a differently cased, hash-prefixed or nested tag, and nothing else', () => {
      expect(titles(HAND_WRITTEN, { eligiblePersonTags: 'Familie' })).toEqual([
        'Erika',
        'Jan',
        'Nora',
        'Piet',
      ]);
    });

    it('reads a filter typed with a hash as the same filter', () => {
      expect(titles(HAND_WRITTEN, { eligiblePersonTags: '#Familie' })).toEqual([
        'Erika',
        'Jan',
        'Nora',
        'Piet',
      ]);
    });

    it('keeps a filter naming a nested tag narrow', () => {
      expect(titles(HAND_WRITTEN, { eligiblePersonTags: 'Familie/Eltern' })).toEqual(['Piet']);
    });
  });
});
