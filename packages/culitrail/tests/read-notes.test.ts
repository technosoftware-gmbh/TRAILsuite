/**
 * Which folder a kind is read from and which `type:` value marks it, which is
 * the half of the folder-AND-type rule CULItrail still owns.
 *
 * The rule itself is `trail-core`'s and is tested there. What is checked here
 * is the query this plugin builds out of its settings: that each of the four
 * kinds reaches its own folder, that meals and only meals span more than
 * one, and that either half of the rule left blank hides that folder rather
 * than claiming the whole vault.
 */
import { describe, expect, it } from 'vitest';
import { mergeSettings } from '../src/settings/validate';
import { CULItrailSettings } from '../src/settings/types';
import { isNoteOfType, readNotesOfType } from '../src/vault/read-notes';
import { foldersFor, typeValueFor } from '../src/vault/entity-types';
import { fakeFile, makeFakeVault } from './fake-vault';

function settings(overrides: Record<string, unknown> = {}): CULItrailSettings {
  return mergeSettings(overrides);
}

const vault = makeFakeVault([
  { path: 'Eating/Meals/Penne alla Norma.md', frontmatter: { type: 'meal' } },
  { path: 'Eating/Meals/Risotto.md', frontmatter: { type: 'meal' } },
  { path: 'Eating/Meals/Sub/Deep Meal.md', frontmatter: { type: 'meal' } },
  // In the folder, but not typed. A note somebody started and never finished.
  { path: 'Eating/Meals/Draft.md', frontmatter: {} },
  // Typed, but nowhere near the meal folder.
  { path: 'Notes/Meeting.md', frontmatter: { type: 'meal' } },
  // A folder whose name merely starts the same way.
  { path: 'Eating/MealsArchive/Old.md', frontmatter: { type: 'meal' } },
  { path: 'Eating/Orders/2026-02-13-23624.md', frontmatter: { type: 'order' } },
  { path: 'CRM/People/Stefan.md', frontmatter: { type: 'person' } },
  { path: 'CRM/People/Erika.md', frontmatter: { type: 'person' } },
  { path: 'CRM/Companies/TomTasty AG.md', frontmatter: { type: 'company' } },
]);

describe('readNotesOfType', () => {
  it('requires folder AND type together', () => {
    const notes = readNotesOfType(vault, settings(), 'meal');
    const titles = notes.map((n) => n.title);
    expect(titles).toEqual(['Deep Meal', 'Penne alla Norma', 'Risotto']);
    // In the folder but untyped.
    expect(titles).not.toContain('Draft');
    // Typed but outside the folder. There is no vault-wide search by type.
    expect(titles).not.toContain('Meeting');
    // A sibling folder with a similar name.
    expect(titles).not.toContain('Old');
  });

  it('reads each other kind from its own folder', () => {
    expect(readNotesOfType(vault, settings(), 'order').map((n) => n.title)).toEqual([
      '2026-02-13-23624',
    ]);
    expect(readNotesOfType(vault, settings(), 'person').map((n) => n.title)).toEqual([
      'Erika',
      'Stefan',
    ]);
    expect(readNotesOfType(vault, settings(), 'company').map((n) => n.title)).toEqual([
      'TomTasty AG',
    ]);
  });

  it('returns nothing when the folder setting is blank', () => {
    expect(readNotesOfType(vault, settings({ personsFolder: '' }), 'person')).toEqual([]);
  });

  it('returns nothing when the type value is blank', () => {
    expect(readNotesOfType(vault, settings({ personTypeValue: '' }), 'person')).toEqual([]);
  });

  it('follows the vault when it uses its own type value', () => {
    // The reference vault says `type: person` for people and
    // `type: Organisation` for companies. Pointing the settings at those is
    // the entire reason they are settings.
    const german = makeFakeVault([
      { path: 'Kontakte/Firmen/TomTasty AG.md', frontmatter: { type: 'Organisation' } },
    ]);
    const notes = readNotesOfType(
      german,
      settings({ companiesFolder: 'Kontakte/Firmen', companyTypeValue: 'Organisation' }),
      'company'
    );
    expect(notes.map((n) => n.title)).toEqual(['TomTasty AG']);
  });

  it('follows a renamed type property', () => {
    const renamed = makeFakeVault([
      { path: 'Eating/Meals/Penne.md', frontmatter: { art: 'mahlzeit' } },
    ]);
    const notes = readNotesOfType(
      renamed,
      settings({ typePropertyName: 'art', mealTypeValue: 'mahlzeit' }),
      'meal'
    );
    expect(notes.map((n) => n.title)).toEqual(['Penne']);
  });

  describe('the meal scan scope', () => {
    it('spans mealsFolder plus additionalMealFolders', () => {
      const spread = makeFakeVault([
        { path: 'Eating/Meals/Penne.md', frontmatter: { type: 'meal' } },
        { path: 'Archive/Old Meals/Gulasch.md', frontmatter: { type: 'meal' } },
        { path: 'Elsewhere/Ignored.md', frontmatter: { type: 'meal' } },
      ]);
      const notes = readNotesOfType(
        spread,
        settings({ additionalMealFolders: ['Archive/Old Meals'] }),
        'meal'
      );
      expect(notes.map((n) => n.title)).toEqual(['Gulasch', 'Penne']);
    });

    it('is the only kind with more than one folder', () => {
      const s = settings({ additionalMealFolders: ['Archive/Old Meals'] });
      expect(foldersFor(s, 'meal')).toHaveLength(2);
      expect(foldersFor(s, 'person')).toHaveLength(1);
      expect(foldersFor(s, 'order')).toHaveLength(1);
      expect(foldersFor(s, 'company')).toHaveLength(1);
    });

    it('still reads the root folder when the extras list is empty', () => {
      expect(readNotesOfType(vault, settings(), 'meal').length).toBe(3);
    });
  });
});

describe('isNoteOfType', () => {
  it('answers the single-file question on exactly the same terms as the bulk read', () => {
    const s = settings();
    expect(isNoteOfType(vault, s, fakeFile('Eating/Meals/Penne alla Norma.md'), 'meal')).toBe(true);
    expect(isNoteOfType(vault, s, fakeFile('Eating/Meals/Draft.md'), 'meal')).toBe(false);
    expect(isNoteOfType(vault, s, fakeFile('Notes/Meeting.md'), 'meal')).toBe(false);
  });

  it('agrees with readNotesOfType for every file in the vault', () => {
    // The two must never disagree about what a meal is: one decides whether
    // the meal view opens, the other decides what the gallery shows. They
    // build the query separately, which is what this checks.
    const s = settings();
    const bulk = new Set(readNotesOfType(vault, s, 'meal').map((n) => n.file.path));
    for (const path of [
      'Eating/Meals/Penne alla Norma.md',
      'Eating/Meals/Draft.md',
      'Notes/Meeting.md',
      'Eating/MealsArchive/Old.md',
      'CRM/People/Stefan.md',
    ]) {
      expect(isNoteOfType(vault, s, fakeFile(path), 'meal')).toBe(bulk.has(path));
    }
  });

  it('is false when the type value is blank', () => {
    expect(
      isNoteOfType(
        vault,
        settings({ mealTypeValue: '' }),
        fakeFile('Eating/Meals/Penne alla Norma.md'),
        'meal'
      )
    ).toBe(false);
  });
});

describe('typeValueFor', () => {
  it('trims, so a setting with a stray space still matches', () => {
    expect(typeValueFor(settings({ mealTypeValue: '  meal  ' }), 'meal')).toBe('meal');
  });
});
