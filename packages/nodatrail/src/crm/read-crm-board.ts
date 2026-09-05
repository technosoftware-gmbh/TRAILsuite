/**
 * The people and companies, with the fields a list of them wants to show.
 *
 * `read-persons.ts` answers "which titles may a picker offer" and stops there,
 * which is all a dropdown needs. A view of the CRM needs the note behind each
 * title and the contact details on it, so this reads the same folders and keeps
 * more.
 *
 * A third implementation of an idea the other two plugins also have, and
 * deliberately so: the packages carry different licences and may not import
 * each other. What is shared is `trail-core`'s `parseCrmNote` and the property
 * names in `CRM_CONTRACT`, which is the whole point of that contract.
 */
import type { App, TFile } from 'obsidian';
import {
  parseCrmNote,
  readNotesOfType,
  type CrmKind,
  type CrmPropertyNames,
} from '@technosoftware/trail-core';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';

export interface CrmRecord {
  file: TFile;
  title: string;
  tags: string[];
  /** What they are: `meals`, `vendor`, `customer`. Empty when nobody has said. */
  roles: string[];
  description: string | null;
  address: string | null;
  website: string | null;
  email: string | null;
  frontmatter: Record<string, unknown>;
}

export interface CrmBoard {
  persons: CrmRecord[];
  companies: CrmRecord[];
}

/**
 * The property names, in the shape the core wants.
 *
 * The four contact keys are the literals this plugin's own forms write. They
 * are not settings here and are settings in APERtrail, which is a divergence
 * worth knowing about rather than one to paper over: reading them under a name
 * this plugin does not write would show blanks over notes that plainly have
 * the values.
 */
function crmProperties(settings: NODAtrailSettings): CrmPropertyNames {
  return {
    typePropertyName: settings.typePropertyName,
    personTypeValue: settings.personTypeValue,
    companyTypeValue: settings.companyTypeValue,
    personTagProperty: settings.personTagProperty,
    companyTagProperty: settings.companyTagProperty,
    personRolesProperty: settings.personRolesProperty,
    companyRolesProperty: settings.companyRolesProperty,
    descriptionProperty: 'description',
    addressProperty: 'address',
    websiteProperty: 'website',
    emailProperty: 'email',
  };
}

function read(app: App, settings: NODAtrailSettings, kind: CrmKind): CrmRecord[] {
  const properties = crmProperties(settings);
  const folder = kind === 'person' ? settings.personsFolder : settings.companiesFolder;

  return readNotesOfType(hostFor(app), {
    folders: [folder],
    typePropertyName: settings.typePropertyName,
    typeValue: kind === 'person' ? settings.personTypeValue : settings.companyTypeValue,
  }).map((note) => {
    const fields = parseCrmNote(note.frontmatter, properties, kind);
    return {
      file: note.file,
      title: note.title,
      tags: fields.tags,
      roles: fields.roles,
      description: fields.description,
      address: fields.address,
      website: fields.website,
      email: fields.email,
      frontmatter: note.frontmatter,
    };
  });
}

/**
 * Everyone an invoice may name, companies and persons in one list.
 *
 * A household is billed by companies and occasionally by a person, and the
 * bill note has never cared which: `company` holds a wikilink and nothing
 * checks which folder it resolves into. So the picker offers both rather than
 * asking somebody to keep a person note in the companies folder to be
 * invoiceable.
 *
 * **Companies come first, and a shared title resolves to the company.** Two
 * notes titled the same are one entry in a dropdown whatever order they are
 * read in, so the order is fixed here rather than left to whichever folder was
 * walked first: a name that is both is far likelier to be the company.
 */
export function readCrmCounterparties(app: App, settings: NODAtrailSettings): CrmRecord[] {
  return [...read(app, settings, 'company'), ...read(app, settings, 'person')];
}

/** Both kinds, each title-sorted by the core's reader. */
export function readCrmBoard(app: App, settings: NODAtrailSettings): CrmBoard {
  return {
    persons: read(app, settings, 'person'),
    companies: read(app, settings, 'company'),
  };
}
