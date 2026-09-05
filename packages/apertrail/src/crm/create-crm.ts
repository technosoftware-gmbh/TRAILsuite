/**
 * Creates new Person and Company notes, writing minimal frontmatter only:
 * the type value, and whichever of the collected fields were actually
 * filled in. Blank fields are omitted rather than written out empty, the
 * same bargain vault/create-entities.ts already struck for the travel
 * types.
 *
 * Two guards the travel creators do not need, because their folder and type
 * value are literals and these are settings: a blank folder or a blank type
 * value refuses instead of writing. A note created at the vault root, or
 * carrying no type value, would be invisible to the very reader that just
 * created it.
 *
 * Both carry a `created` stamp, handed to frontmatterObject() as its own
 * argument so it sits directly after the type value. Neither carries
 * `modified` at creation: the first real edit is what adds that.
 *
 * A Person note starts with a related-trips block, so it answers "which
 * trips was this person on" from the moment it exists -- the same reason a
 * City or place note gets one. A Company note gets no body at all: nothing
 * links a trip to a company, and a block that could only ever say "no trips
 * yet" is worse than no block.
 */
import { App, TFile } from 'obsidian';
import { t } from '../lang/I18nManager';
import { APERtrailSettings } from '../settings/types';
import { createdEntry, frontmatterObject } from '@technosoftware/trail-core';
import { renderFrontmatterBlock } from '@technosoftware/trail-core/obsidian';
import { createNote } from '../shared/note-creation';
import { TRAVEL_RELATED_TRIPS_BLOCK_LANG } from '../trips/related-trips-block-lang';
import { CrmEntityType, CRM_FOLDER_SETTING } from './entity-types';
import { crmPropertyNames, CrmPropertyNames, crmTagProperty, crmTypeValue } from './crm-note';

export interface NewPersonFields {
  title: string;
  tags: string[];
  email: string;
  mobile: string;
  address: string;
}

export interface NewCompanyFields {
  title: string;
  tags: string[];
  website: string;
  email: string;
  phone: string;
  address: string;
}

/** Adds a property only when it has a value, so a note never carries a key with nothing after it. */
function put(rest: Record<string, unknown>, property: string, value: string): void {
  const trimmed = value.trim();
  if (trimmed) rest[property] = trimmed;
}

async function createCrmNote(
  app: App,
  settings: APERtrailSettings,
  properties: CrmPropertyNames,
  kind: CrmEntityType,
  title: string,
  rest: Record<string, unknown>,
  now: Date,
  body = ''
): Promise<TFile> {
  const folder = (settings[CRM_FOLDER_SETTING[kind]] as string).trim();
  if (!folder) throw new Error(t('crm.create.folderMissing'));

  const typeValue = crmTypeValue(properties, kind);
  if (!typeValue) throw new Error(t('crm.create.typeValueMissing'));

  const content =
    renderFrontmatterBlock(
      frontmatterObject(properties.typePropertyName, typeValue, createdEntry(settings, now), rest)
    ) + body;
  return createNote(app, folder, title, content);
}

export function createPersonNote(
  app: App,
  settings: APERtrailSettings,
  fields: NewPersonFields,
  now: Date = new Date()
): Promise<TFile> {
  const properties = crmPropertyNames(settings);
  const rest: Record<string, unknown> = {};
  if (fields.tags.length > 0) rest[crmTagProperty(properties, 'person')] = fields.tags;
  put(rest, properties.addressProperty, fields.address);
  put(rest, properties.emailProperty, fields.email);
  put(rest, properties.mobileProperty, fields.mobile);
  const body = `\n\`\`\`${TRAVEL_RELATED_TRIPS_BLOCK_LANG}\n\`\`\`\n`;
  return createCrmNote(app, settings, properties, 'person', fields.title, rest, now, body);
}

export function createCompanyNote(
  app: App,
  settings: APERtrailSettings,
  fields: NewCompanyFields,
  now: Date = new Date()
): Promise<TFile> {
  const properties = crmPropertyNames(settings);
  const rest: Record<string, unknown> = {};
  if (fields.tags.length > 0) rest[crmTagProperty(properties, 'company')] = fields.tags;
  put(rest, properties.addressProperty, fields.address);
  put(rest, properties.websiteProperty, fields.website);
  put(rest, properties.emailProperty, fields.email);
  put(rest, properties.phoneProperty, fields.phone);
  return createCrmNote(app, settings, properties, 'company', fields.title, rest, now);
}
