/**
 * The pure CRM frontmatter parsers, exercised without an App at all -- the
 * whole point of splitting crm-note.ts out of read-crm.ts.
 *
 * What is worth pinning down here is the loose-typing tolerance a real
 * vault demands: a tags value that is a string, an array, or absent, and a
 * property left blank rather than removed.
 *
 * Whether a note's type value matches is trail-core's `matchesType()` and
 * is tested there. What that leaves this module is the settings-to-names
 * resolution below; read-crm.test.ts covers the wiring of the two together.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import {
  crmPropertyNames,
  crmTagProperty,
  crmTypeValue,
  parseCompanyRecord,
  parsePersonRecord,
} from '../src/crm/crm-note';

const P = crmPropertyNames(DEFAULT_SETTINGS);

describe('crmPropertyNames', () => {
  it('falls back to sensible names when a property setting is blanked out', () => {
    const properties = crmPropertyNames({
      ...DEFAULT_SETTINGS,
      typePropertyName: '  ',
      personTagProperty: '',
      companyTagProperty: '   ',
    });
    expect(properties.typePropertyName).toBe('type');
    expect(properties.personTagProperty).toBe('tags');
    expect(properties.companyTagProperty).toBe('tags');
  });

  it('keeps a blank type value blank rather than substituting a default', () => {
    const properties = crmPropertyNames({ ...DEFAULT_SETTINGS, personTypeValue: '  ' });
    expect(crmTypeValue(properties, 'person')).toBe('');
    expect(crmTypeValue(properties, 'company')).toBe('company');
  });

  it('gives Person and Company their own tag property', () => {
    const properties = crmPropertyNames({
      ...DEFAULT_SETTINGS,
      personTagProperty: 'schlagworte',
      companyTagProperty: 'branchen',
    });
    expect(crmTagProperty(properties, 'person')).toBe('schlagworte');
    expect(crmTagProperty(properties, 'company')).toBe('branchen');
  });
});

describe('parsePersonRecord', () => {
  it('reads every field it owns', () => {
    expect(
      parsePersonRecord(
        {
          type: 'person',
          description: 'Photography friend',
          tags: ['Friends', 'Photography'],
          address: 'Länggassstrasse, 3012 Bern, Switzerland',
          email: 'marc@example.com',
          mobile: '+41 79 000 00 06',
        },
        P
      )
    ).toEqual({
      description: 'Photography friend',
      tags: ['Friends', 'Photography'],
      address: 'Länggassstrasse, 3012 Bern, Switzerland',
      email: 'marc@example.com',
      mobile: '+41 79 000 00 06',
    });
  });

  /**
   * The sample vault's own People notes carry `description:` and `private:`
   * with nothing after them, which is what Obsidian writes for a property
   * that exists but is unset. Blank has to read as absent, or every card
   * grows an empty meta item.
   */
  it('treats a present-but-blank property as absent', () => {
    const parsed = parsePersonRecord({ description: '   ', email: '', mobile: null }, P);
    expect(parsed.description).toBeNull();
    expect(parsed.email).toBeNull();
    expect(parsed.mobile).toBeNull();
  });

  it('reads a comma-separated tag string as well as a tag array', () => {
    expect(parsePersonRecord({ tags: 'Friends, Photography' }, P).tags).toEqual([
      'Friends',
      'Photography',
    ]);
    expect(parsePersonRecord({}, P).tags).toEqual([]);
  });

  it('reads tags from a renamed tag property', () => {
    const properties = crmPropertyNames({ ...DEFAULT_SETTINGS, personTagProperty: 'schlagworte' });
    expect(
      parsePersonRecord({ schlagworte: ['Familie'], tags: ['Friends'] }, properties).tags
    ).toEqual(['Familie']);
  });
});

describe('parseCompanyRecord', () => {
  it('reads every field it owns, including the two a Person has no use for', () => {
    expect(
      parseCompanyRecord(
        {
          type: 'company',
          description: 'Regional tourist board',
          tags: ['Tourism'],
          address: 'Vordergasse, 8200 Schaffhausen, Switzerland',
          website: 'https://schaffhauserland.ch/',
          email: 'info@example.com',
          phone: '+41 52 000 00 01',
        },
        P
      )
    ).toEqual({
      description: 'Regional tourist board',
      tags: ['Tourism'],
      address: 'Vordergasse, 8200 Schaffhausen, Switzerland',
      website: 'https://schaffhauserland.ch/',
      email: 'info@example.com',
      phone: '+41 52 000 00 01',
    });
  });

  it('reads its tags from the company tag property, not the person one', () => {
    const properties = crmPropertyNames({
      ...DEFAULT_SETTINGS,
      personTagProperty: 'personTags',
      companyTagProperty: 'companyTags',
    });
    expect(
      parseCompanyRecord({ companyTags: ['Tourism'], personTags: ['Friends'] }, properties).tags
    ).toEqual(['Tourism']);
  });
});
