/**
 * Person and Company note writing.
 *
 * Two things here that the travel creators never had to worry about: the
 * folder and the type value are settings rather than literals, so both can
 * be blank, and both refusals are asserted rather than assumed.
 *
 * The refusals are matched through t() rather than against a literal
 * string: tests/setup.ts initializes I18nManager, so these throw real
 * translated copy, and resolving the same key the code does keeps the
 * assertion exact without pinning the wording.
 */
import { describe, expect, it, vi } from 'vitest';

// The `obsidian` package ships types only, no runtime -- see fake-vault.ts's
// own doc comment. Same two-function stand-in create-entities.test.ts uses,
// so the asserted frontmatter reads the same way in both suites.
vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
  stringifyYaml: (obj: Record<string, unknown>) =>
    Object.entries(obj)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('\n'),
}));

import { t } from '../src/lang/I18nManager';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { createCompanyNote, createPersonNote } from '../src/crm/create-crm';
import { makeFakeVault } from './fake-vault';

const settings = DEFAULT_SETTINGS;

const PERSON = {
  title: 'Marc',
  tags: ['Friends', 'Photography'],
  email: 'marc@example.com',
  mobile: '+41 79 000 00 06',
  address: 'Länggassstrasse, 3012 Bern, Switzerland',
};

const COMPANY = {
  title: 'Basel Tourismus',
  tags: ['Tourism'],
  website: 'https://www.basel.com/',
  email: 'info@example.com',
  phone: '+41 61 000 00 01',
  address: 'Aeschenvorstadt, 4051 Basel, Switzerland',
};

const BLANK_PERSON = { title: 'Zoe', tags: [], email: '', mobile: '', address: '' };

describe('createPersonNote', () => {
  it('writes the configured type value and every filled field into the People folder', async () => {
    const { app, created } = makeFakeVault();
    const file = await createPersonNote(app, settings, PERSON);
    expect(file.path).toBe(`${settings.personsFolder}/Marc.md`);
    const content = created[0].content;
    expect(content).toContain('type: "person"');
    expect(content).toContain(`${settings.personTagProperty}: ["Friends","Photography"]`);
    expect(content).toContain(`${settings.emailProperty}: "marc@example.com"`);
    expect(content).toContain(`${settings.mobileProperty}: "+41 79 000 00 06"`);
    expect(content).toContain(settings.addressProperty);
  });

  /**
   * A key with nothing after it is what Obsidian's property editor writes,
   * but it is not what a creator should leave behind: an empty `email:` on
   * every new person is noise in the file and a null in every reader.
   */
  it('omits every field left blank rather than writing an empty key', async () => {
    const { app, created } = makeFakeVault();
    await createPersonNote(app, settings, BLANK_PERSON);
    const content = created[0].content;
    expect(content).toContain('type: "person"');
    expect(content).not.toContain(settings.emailProperty);
    expect(content).not.toContain(settings.mobileProperty);
    expect(content).not.toContain(settings.addressProperty);
    expect(content).not.toContain(settings.personTagProperty);
  });

  it('trims what it writes', async () => {
    const { app, created } = makeFakeVault();
    await createPersonNote(app, settings, { ...BLANK_PERSON, email: '  zoe@example.com  ' });
    expect(created[0].content).toContain(`${settings.emailProperty}: "zoe@example.com"`);
  });

  it('honours a renamed type property, type value and field properties', async () => {
    const { app, created } = makeFakeVault();
    await createPersonNote(
      app,
      {
        ...settings,
        typePropertyName: 'typ',
        personTypeValue: 'Kontakt',
        personTagProperty: 'schlagworte',
        mobileProperty: 'handy',
      },
      PERSON
    );
    const content = created[0].content;
    expect(content).toContain('typ: "Kontakt"');
    expect(content).toContain('schlagworte: ["Friends","Photography"]');
    expect(content).toContain('handy: "+41 79 000 00 06"');
  });

  it('refuses when the People folder is blank rather than writing to the vault root', async () => {
    const { app, created } = makeFakeVault();
    await expect(
      createPersonNote(app, { ...settings, personsFolder: '   ' }, PERSON)
    ).rejects.toThrow(t('crm.create.folderMissing'));
    expect(created).toHaveLength(0);
  });

  /**
   * A note written without a type value would be invisible to the reader
   * that just created it, which is a worse outcome than refusing.
   */
  it('refuses when the person type value is blank', async () => {
    const { app, created } = makeFakeVault();
    await expect(
      createPersonNote(app, { ...settings, personTypeValue: '' }, PERSON)
    ).rejects.toThrow(t('crm.create.typeValueMissing'));
    expect(created).toHaveLength(0);
  });

  /**
   * The same reason a City or place note gets one: the note answers "when
   * was I with them" from the moment it exists, rather than only once
   * somebody remembers to paste a fence in.
   */
  it('starts the note with a related-trips block', async () => {
    const { app, created } = makeFakeVault();
    await createPersonNote(app, settings, BLANK_PERSON);
    expect(created[0].content).toContain('```travel-related-trips\n```');
  });

  it('refuses to overwrite a note that already exists at the target path', async () => {
    const { app } = makeFakeVault([
      { path: `${settings.personsFolder}/Marc.md`, frontmatter: { type: 'person' } },
    ]);
    await expect(createPersonNote(app, settings, PERSON)).rejects.toThrow(/already exists/);
  });
});

describe('createCompanyNote', () => {
  it('writes the two fields a Person has no use for, into the Companies folder', async () => {
    const { app, created } = makeFakeVault();
    const file = await createCompanyNote(app, settings, COMPANY);
    expect(file.path).toBe(`${settings.companiesFolder}/Basel Tourismus.md`);
    const content = created[0].content;
    expect(content).toContain('type: "company"');
    expect(content).toContain(`${settings.websiteProperty}: "https://www.basel.com/"`);
    expect(content).toContain(`${settings.phoneProperty}: "+41 61 000 00 01"`);
  });

  it('writes its tags under the company tag property, not the person one', async () => {
    const { app, created } = makeFakeVault();
    await createCompanyNote(
      app,
      { ...settings, personTagProperty: 'personTags', companyTagProperty: 'companyTags' },
      COMPANY
    );
    const content = created[0].content;
    expect(content).toContain('companyTags: ["Tourism"]');
    expect(content).not.toContain('personTags');
  });

  /** Nothing links a trip to a company, so a block here could only ever say "no trips yet". */
  it('writes no body at all', async () => {
    const { app, created } = makeFakeVault();
    await createCompanyNote(app, settings, COMPANY);
    expect(created[0].content).not.toContain('travel-related-trips');
    expect(created[0].content.trimEnd().endsWith('---')).toBe(true);
  });

  it('refuses when the company type value is blank', async () => {
    const { app } = makeFakeVault();
    await expect(
      createCompanyNote(app, { ...settings, companyTypeValue: '  ' }, COMPANY)
    ).rejects.toThrow(t('crm.create.typeValueMissing'));
  });
});

describe('the created stamp', () => {
  const NOW = new Date(2026, 7, 12, 9, 15);

  it.each([
    ['person', createPersonNote, PERSON],
    ['company', createCompanyNote, COMPANY],
  ] as [string, (a: never, b: never, c: never, d: Date) => Promise<unknown>, unknown][])(
    '%s: stamps created directly after the type value, and not modified',
    async (_kind, create, fields) => {
      const { app, created } = makeFakeVault();
      await create(app as never, settings as never, fields as never, NOW);
      const content = created[0].content;
      expect(content).toContain('created: "2026-08-12T09:15"');
      expect(content).not.toContain('modified');
      const keys = content
        .split('---\n')[1]
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split(':')[0]);
      expect(keys.slice(0, 2)).toEqual([settings.typePropertyName, 'created']);
    }
  );

  it('writes nothing when the property name has been cleared', async () => {
    const { app, created } = makeFakeVault();
    await createPersonNote(app, { ...settings, createdProperty: '' }, PERSON, NOW);
    expect(created[0].content).not.toContain('created');
  });
});
