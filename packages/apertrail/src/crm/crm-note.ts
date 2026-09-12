/**
 * APERtrail's settings, mapped onto the shared CRM note format.
 *
 * The format itself is `trail-core`'s: which property holds a kind's tags, what
 * a note's fields read as, and that a blank type value matches nothing. Two
 * plugins read these notes, so the reading is one implementation rather than
 * two that agree until one is fixed. What stays here is the one thing the core
 * must not know, which is what this plugin's settings object looks like.
 *
 * The contact fields are named here because APERtrail displays them. A plugin
 * that shows no address leaves that name out and the core does not read one.
 */
import {
  crmTagProperty,
  crmTypeValue,
  parseCrmNote,
  type CrmNoteFields,
  type CrmPropertyNames,
} from '@technosoftware/trail-core';
import { CrmEntityType } from './entity-types';
import type { APERtrailSettings } from '../settings/types';

export { crmTagProperty, crmTypeValue, type CrmPropertyNames };

export function crmPropertyNames(settings: APERtrailSettings): CrmPropertyNames {
  return {
    // A blank property NAME is a cleared field rather than a decision, so it
    // falls back to the literal. A blank type VALUE is a decision, and means
    // "match nothing", so it does not.
    typePropertyName: settings.typePropertyName.trim() || 'type',
    personTypeValue: settings.personTypeValue.trim(),
    companyTypeValue: settings.companyTypeValue.trim(),
    personTagProperty: settings.personTagProperty.trim() || 'tags',
    companyTagProperty: settings.companyTagProperty.trim() || 'tags',
    descriptionProperty: settings.descriptionProperty,
    addressProperty: settings.addressProperty,
    websiteProperty: settings.websiteProperty,
    emailProperty: settings.emailProperty,
    phoneProperty: settings.phoneProperty,
    mobileProperty: settings.mobileProperty,
  };
}

/** A Person's fields, minus the file it came from. Its shape is this plugin's, drawn from the shared read. */
export type ParsedPerson = {
  description: string | null;
  tags: string[];
  address: string | null;
  email: string | null;
  mobile: string | null;
};

export type ParsedCompany = {
  description: string | null;
  tags: string[];
  address: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
};

function fields(
  frontmatter: Record<string, unknown>,
  properties: CrmPropertyNames,
  kind: CrmEntityType
): CrmNoteFields {
  return parseCrmNote(frontmatter, properties, kind);
}

export function parsePersonRecord(
  frontmatter: Record<string, unknown>,
  properties: CrmPropertyNames
): ParsedPerson {
  const { description, tags, address, email, mobile } = fields(frontmatter, properties, 'person');
  return { description, tags, address, email, mobile };
}

export function parseCompanyRecord(
  frontmatter: Record<string, unknown>,
  properties: CrmPropertyNames
): ParsedCompany {
  const { description, tags, address, website, email, phone } = fields(
    frontmatter,
    properties,
    'company'
  );
  return { description, tags, address, website, email, phone };
}
