/**
 * Reading Person and Company notes, and deciding which people are offered.
 *
 * The shared-CRM contract with APERtrail is what most of this is really
 * about: same folders, same type values, same tag properties, all by default.
 * A test here failing usually means a vault with both plugins installed has
 * started reading two different People folders.
 */
import { describe, expect, it } from 'vitest';
import { I18nManager } from '../src/lang/I18nManager';
import { mergeSettings } from '../src/settings/validate';
import { CULItrailSettings } from '../src/settings/types';
import { DEFAULT_SETTINGS, getLocalizedDefaults } from '../src/settings/defaults';
import { crmPropertyNames, crmTagProperty, crmTypeValue } from '../src/crm/crm-note';
import { crmTagValues, readCrmBoard } from '../src/crm/read-crm';
import { eligiblePersonTitles, eligiblePersons, resolveActivePerson } from '../src/crm/persons';
import { makeFakeVault } from './fake-vault';

function settings(overrides: Record<string, unknown> = {}): CULItrailSettings {
  return mergeSettings(overrides);
}

const vault = makeFakeVault([
  { path: 'CRM/People/Stefan.md', frontmatter: { type: 'person', tags: ['Family'] } },
  { path: 'CRM/People/Erika.md', frontmatter: { type: 'person', tags: ['Family/Close'] } },
  // A person note that is a person without being a household member: the
  // exact shape the eligibility filter exists for.
  { path: 'CRM/People/Marcella Hazan.md', frontmatter: { type: 'person', tags: ['Author'] } },
  // In the folder, no type. Not a person as far as anything here is concerned.
  { path: 'CRM/People/Draft.md', frontmatter: {} },
  { path: 'CRM/Companies/TomTasty AG.md', frontmatter: { type: 'company', tags: ['Delivery'] } },
  { path: 'CRM/Companies/Hofladen.md', frontmatter: { type: 'company' } },
]);

describe('the defaults CULItrail shares with APERtrail', () => {
  it('points at the same two folders and uses the same type values', () => {
    // Every value here is copied verbatim from APERtrail. If one of these
    // changes without APERtrail changing too, a vault with both plugins
    // silently reads two different sets of contact notes, and the symptom is
    // an empty person list rather than an error.
    expect(DEFAULT_SETTINGS.crmFolder).toBe('CRM');
    expect(DEFAULT_SETTINGS.personsFolder).toBe('CRM/People');
    expect(DEFAULT_SETTINGS.companiesFolder).toBe('CRM/Companies');
    expect(DEFAULT_SETTINGS.personTypeValue).toBe('person');
    expect(DEFAULT_SETTINGS.companyTypeValue).toBe('company');
    expect(DEFAULT_SETTINGS.personTagProperty).toBe('tags');
    expect(DEFAULT_SETTINGS.companyTagProperty).toBe('tags');
    expect(DEFAULT_SETTINGS.eligiblePersonTags).toBe('');
  });

  it('uses the same German folder names, which is the half easiest to drift', () => {
    // The English defaults are the ones anybody looks at, so they tend to stay
    // in step by accident. The German ones are resolved through `t()` and would
    // drift unnoticed: a vault set up in German by APERtrail keeps its notes in
    // `CRM/Personen`, and a CULItrail that seeded `CRM/Kontakte` would read an
    // empty folder while both plugins looked correctly configured.
    //
    // The strings are APERtrail's own, copied verbatim from its de.ts. This test
    // is the tripwire for either side changing them alone.
    const manager = I18nManager.getInstance();
    const previous = manager.getCurrentLocale();

    return manager
      .setLocale('de')
      .then(() => {
        const f = getLocalizedDefaults();
        expect(f.crmFolder).toBe('CRM');
        expect(f.personsFolder).toBe('CRM/Personen');
        expect(f.companiesFolder).toBe('CRM/Firmen');
      })
      .finally(() => manager.setLocale(previous));
  });

  it("puts the type values out of the localized resolver's reach entirely", () => {
    // A `type:` value is data, not text. Translating it would orphan every note
    // already on disk, and it is the one field both plugins compare exactly.
    //
    // Asserted as absence rather than as a value in each locale: the resolver
    // returning no opinion on them is what makes a locale change structurally
    // unable to touch them, where an equality check would only prove that today
    // it happens not to.
    const resolved = Object.keys(getLocalizedDefaults());

    expect(resolved).not.toContain('personTypeValue');
    expect(resolved).not.toContain('companyTypeValue');
    expect(resolved).not.toContain('typePropertyName');
  });
});

describe('crmPropertyNames', () => {
  it('falls back on a blank property NAME, since that is never a deliberate choice', () => {
    const p = crmPropertyNames(settings({ typePropertyName: '', personTagProperty: '' }));
    expect(p.typePropertyName).toBe('type');
    expect(p.personTagProperty).toBe('tags');
  });

  it('does NOT fall back on a blank type VALUE, where blank means "match nothing"', () => {
    // The asymmetry is the point: a cleared property name is a cleared field,
    // a cleared type value is a deliberate way to hide a folder.
    const p = crmPropertyNames(settings({ personTypeValue: '' }));
    expect(crmTypeValue(p, 'person')).toBe('');
  });

  it('gives person and company their own tag property', () => {
    const p = crmPropertyNames(
      settings({ personTagProperty: 'tags', companyTagProperty: 'kategorie' })
    );
    expect(crmTagProperty(p, 'person')).toBe('tags');
    expect(crmTagProperty(p, 'company')).toBe('kategorie');
  });
});

describe('readCrmBoard', () => {
  const board = readCrmBoard(vault, settings());

  it('reads people and companies, each from its own folder', () => {
    expect(board.persons.map((p) => p.title)).toEqual(['Erika', 'Marcella Hazan', 'Stefan']);
    expect(board.companies.map((c) => c.title)).toEqual(['Hofladen', 'TomTasty AG']);
  });

  it('requires folder AND type, on the same terms as every other kind', () => {
    // Draft.md sits in the People folder with no type. The rule is not
    // reimplemented here, which is what stops this reader from ever
    // disagreeing with the meal or order one about what counts.
    expect(board.persons.map((p) => p.title)).not.toContain('Draft');
  });

  it('reads tags, and tolerates a note with none', () => {
    expect(board.persons.find((p) => p.title === 'Stefan')?.tags).toEqual(['Family']);
    expect(board.companies.find((c) => c.title === 'Hofladen')?.tags).toEqual([]);
  });

  it('returns both lists sorted by title, so views render deterministically', () => {
    expect(board.persons.map((p) => p.title)).toEqual(
      [...board.persons.map((p) => p.title)].sort()
    );
  });

  it('reads each kind from its own tag property', () => {
    const split = makeFakeVault([
      { path: 'CRM/People/Stefan.md', frontmatter: { type: 'person', tags: ['Family'] } },
      {
        path: 'CRM/Companies/TomTasty AG.md',
        frontmatter: { type: 'company', kategorie: ['Lieferdienst'], tags: ['ignored'] },
      },
    ]);
    const b = readCrmBoard(split, settings({ companyTagProperty: 'kategorie' }));
    expect(b.companies[0].tags).toEqual(['Lieferdienst']);
  });

  it('follows a vault that spells its type values its own way', () => {
    // The reference vault says `type: person` for people and
    // `type: Organisation` for companies. Pointing the settings at what the
    // notes actually say is the entire reason these are settings.
    const german = makeFakeVault([
      {
        path: '4 Ressourcen/3 Persönliches Umfeld/Personen/Stefan Muster.md',
        frontmatter: { type: 'person', tags: ['Familie'] },
      },
      {
        path: '4 Ressourcen/3 Persönliches Umfeld/Organisationen/TomTasty AG.md',
        frontmatter: { type: 'Organisation' },
      },
    ]);
    const b = readCrmBoard(
      german,
      settings({
        personsFolder: '4 Ressourcen/3 Persönliches Umfeld/Personen',
        companiesFolder: '4 Ressourcen/3 Persönliches Umfeld/Organisationen',
        companyTypeValue: 'Organisation',
      })
    );
    expect(b.persons.map((p) => p.title)).toEqual(['Stefan Muster']);
    expect(b.companies.map((c) => c.title)).toEqual(['TomTasty AG']);
  });

  it('returns empty lists when a folder or type value is blank', () => {
    expect(readCrmBoard(vault, settings({ personsFolder: '' })).persons).toEqual([]);
    expect(readCrmBoard(vault, settings({ personTypeValue: '' })).persons).toEqual([]);
    // The other kind is unaffected: one cleared setting hides one folder.
    expect(readCrmBoard(vault, settings({ personsFolder: '' })).companies.length).toBe(2);
  });
});

describe('crmTagValues', () => {
  it('collects every tag across both kinds, deduplicated and sorted', () => {
    // Offered as suggestions when configuring the filter, so a third spelling
    // of the same tag does not quietly appear in a vault that has two.
    expect(crmTagValues(readCrmBoard(vault, settings()))).toEqual([
      'Author',
      'Delivery',
      'Family',
      'Family/Close',
    ]);
  });
});

describe('the person eligibility filter', () => {
  const persons = readCrmBoard(vault, settings()).persons;

  it('offers everyone when the filter is empty', () => {
    // Never nobody. Turning this feature on must not empty the person
    // selector until somebody happens to configure it.
    expect(eligiblePersons(persons, '').map((p) => p.title)).toEqual([
      'Erika',
      'Marcella Hazan',
      'Stefan',
    ]);
  });

  it('narrows to the tagged people, including nested tags', () => {
    // Erika is tagged Family/Close and has to be included by a Family filter,
    // or the household member with the more specific tag disappears.
    expect(eligiblePersons(persons, 'Family').map((p) => p.title)).toEqual(['Erika', 'Stefan']);
  });

  it('excludes a person-typed note that is not a household member', () => {
    // The whole reason the filter exists: a cookbook author is a person and
    // should not be offered as somebody to plan meals for.
    expect(eligiblePersons(persons, 'Family').map((p) => p.title)).not.toContain('Marcella Hazan');
  });

  it('accepts several filter tags', () => {
    expect(eligiblePersons(persons, 'Family, Author').map((p) => p.title)).toEqual([
      'Erika',
      'Marcella Hazan',
      'Stefan',
    ]);
  });

  it('yields nobody when the filter matches nothing, rather than falling back to everyone', () => {
    // A configured filter that matches nothing is a configuration mistake and
    // has to look like one. Only an EMPTY filter is permissive.
    expect(eligiblePersons(persons, 'Nonexistent')).toEqual([]);
  });

  it('reads through from the vault as titles', () => {
    expect(eligiblePersonTitles(vault, settings({ eligiblePersonTags: 'Family' }))).toEqual([
      'Erika',
      'Stefan',
    ]);
  });
});

describe('resolveActivePerson', () => {
  const persons = readCrmBoard(vault, settings()).persons;

  it('keeps the remembered person when they are still eligible', () => {
    expect(resolveActivePerson(persons, 'Stefan')).toBe('Stefan');
  });

  it('falls back to the first person when the remembered one is gone', () => {
    // The case that matters: a person removed, renamed, or filtered out by a
    // tag change must not leave the meal-plan view pointing at a note that no
    // longer exists and showing an empty week that reads as data loss.
    expect(resolveActivePerson(persons, 'Somebody Else')).toBe('Erika');
  });

  it('falls back to the first person when nothing is remembered', () => {
    expect(resolveActivePerson(persons, '')).toBe('Erika');
  });

  it('returns an empty string when there are no people at all', () => {
    expect(resolveActivePerson([], 'Stefan')).toBe('');
  });
});
