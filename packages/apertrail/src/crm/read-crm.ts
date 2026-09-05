/**
 * Reads the configured People and Companies folders into the CrmBoard shape
 * (types.ts).
 *
 * A note counts as a Person or a Company on the same terms every travel
 * entity is judged by: it sits under the configured folder AND its type
 * property carries the configured value. The difference is that the value
 * itself is a setting here rather than a literal, so a vault whose people
 * notes say `type: Kontakt` points the setting at that and renames nothing.
 *
 * Nothing is cached, same as vault/read-entities.ts: every view re-reads on
 * render, so the board can never drift from the notes.
 */
import { App, TFile } from 'obsidian';
import { APERtrailSettings } from '../settings/types';
import { readNotesOfType, type VaultNote } from '@technosoftware/trail-core';
import { hostFor } from '../shared/vault-host';
import { CrmEntityType, CRM_FOLDER_SETTING } from './entity-types';
import {
  crmPropertyNames,
  CrmPropertyNames,
  crmTypeValue,
  parseCompanyRecord,
  parsePersonRecord,
} from './crm-note';
import { CrmBoard, CrmCompany, CrmPerson } from './types';

export { crmPropertyNames };

/**
 * Every note under the folder configured for `kind` that carries the
 * configured type value, with its frontmatter already read.
 *
 * trail-core's `readNotesOfType()`, the same call vault/read-entities.ts
 * makes for the travel types. Two of its rules are the ones this module
 * used to spell out itself: a blank folder finds nothing rather than the
 * vault root, and a blank type value matches nothing rather than every note
 * in the folder. An unset setting therefore hides its folder, which is by
 * far the safer of the two failure modes.
 */
function crmNotesOfKind(
  app: App,
  settings: APERtrailSettings,
  properties: CrmPropertyNames,
  kind: CrmEntityType
): VaultNote<TFile>[] {
  return readNotesOfType(hostFor(app), {
    folders: [settings[CRM_FOLDER_SETTING[kind]] as string],
    typePropertyName: properties.typePropertyName,
    typeValue: crmTypeValue(properties, kind),
  });
}

export function readCrmBoard(app: App, settings: APERtrailSettings): CrmBoard {
  const properties = crmPropertyNames(settings);

  const persons: CrmPerson[] = crmNotesOfKind(app, settings, properties, 'person').map(
    ({ file, title, frontmatter }) => ({
      file,
      title,
      ...parsePersonRecord(frontmatter, properties),
    })
  );

  const companies: CrmCompany[] = crmNotesOfKind(app, settings, properties, 'company').map(
    ({ file, title, frontmatter }) => ({
      file,
      title,
      ...parseCompanyRecord(frontmatter, properties),
    })
  );

  return {
    persons: persons.sort((a, b) => a.title.localeCompare(b.title)),
    companies: companies.sort((a, b) => a.title.localeCompare(b.title)),
  };
}

/** Every tag any CRM note carries, sorted -- the creation modal offers these as suggestions so a third spelling of the same tag does not quietly appear. */
export function crmTagValues(board: CrmBoard): string[] {
  const tags = new Set<string>();
  for (const person of board.persons) person.tags.forEach((tag) => tags.add(tag));
  for (const company of board.companies) company.tags.forEach((tag) => tags.add(tag));
  return [...tags].sort((a, b) => a.localeCompare(b));
}
