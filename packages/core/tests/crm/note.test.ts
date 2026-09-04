/**
 * One CRM note's fields.
 *
 * The two rules worth pinning are the ones a plugin would otherwise have to
 * remember: a property nobody named is not read, and tags read the same however
 * a note happens to spell them. The second is what the two plugins had drifted
 * apart on before this module existed.
 */
import { describe, expect, it } from 'vitest';
import {
  crmTagProperty,
  crmTypeValue,
  parseCrmNote,
  type CrmPropertyNames,
} from '../../src/crm/note.js';

const NAMES: CrmPropertyNames = {
  typePropertyName: 'type',
  personTypeValue: 'person',
  companyTypeValue: 'company',
  personTagProperty: 'tags',
  companyTagProperty: 'kategorie',
  descriptionProperty: 'description',
  emailProperty: 'email',
  mobileProperty: 'mobile',
};

describe('crmTypeValue and crmTagProperty', () => {
  it('answers per kind, because a vault may spell the two differently', () => {
    expect(crmTypeValue(NAMES, 'person')).toBe('person');
    expect(crmTypeValue(NAMES, 'company')).toBe('company');
    expect(crmTagProperty(NAMES, 'person')).toBe('tags');
    expect(crmTagProperty(NAMES, 'company')).toBe('kategorie');
  });
});

describe('parseCrmNote', () => {
  it('reads the fields it was given names for', () => {
    const fields = parseCrmNote(
      {
        tags: ['Familie'],
        description: 'Mother',
        email: 'erika@example.ch',
        mobile: '+41 79 000 00 00',
      },
      NAMES,
      'person'
    );
    expect(fields.tags).toEqual(['Familie']);
    expect(fields.description).toBe('Mother');
    expect(fields.email).toBe('erika@example.ch');
    expect(fields.mobile).toBe('+41 79 000 00 00');
  });

  it('leaves a field null when no property name was given for it', () => {
    // CULItrail names none of the contact fields, because it displays none.
    // Reading them anyway would mean settings nobody can see the effect of.
    const fields = parseCrmNote({ tags: ['Familie'], address: 'Musterweg 4' }, NAMES, 'person');
    expect(fields.address).toBeNull();
    expect(fields.website).toBeNull();
    expect(fields.phone).toBeNull();
  });

  it('leaves a field null when the note does not carry it', () => {
    expect(parseCrmNote({}, NAMES, 'person').email).toBeNull();
  });

  it('reads a company through its own tag property', () => {
    const fields = parseCrmNote({ tags: ['ignored'], kategorie: ['Lieferant'] }, NAMES, 'company');
    expect(fields.tags).toEqual(['Lieferant']);
  });

  it('reads tags however the note spells them', () => {
    // A YAML list, a bare value and a comma-separated string are all real, and
    // a leading hash is the same tag written the way Obsidian shows it.
    expect(parseCrmNote({ tags: ['#Familie'] }, NAMES, 'person').tags).toEqual(['Familie']);
    expect(parseCrmNote({ tags: 'Familie' }, NAMES, 'person').tags).toEqual(['Familie']);
    expect(parseCrmNote({ tags: 'Familie, Freunde' }, NAMES, 'person').tags).toEqual([
      'Familie',
      'Freunde',
    ]);
  });

  it('reads a blank property value as unset rather than as an empty string', () => {
    expect(parseCrmNote({ email: '   ' }, NAMES, 'person').email).toBeNull();
  });
});
