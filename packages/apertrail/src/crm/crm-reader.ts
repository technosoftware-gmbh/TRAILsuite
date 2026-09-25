/**
 * Reads the configured People and Companies folders into the CrmBoard shape
 * (types.ts), through the core's vault ports.
 *
 * A note counts as a Person or a Company on the same terms every travel
 * entity is judged by: it sits under the configured folder AND its type
 * property carries the configured value. The difference is that the value
 * itself is a setting here rather than a literal, so a vault whose people
 * notes say `type: Kontakt` points the setting at that and renames nothing.
 *
 * Imports nothing from `obsidian`, which `tests/host-free.test.ts` enforces:
 * `read-crm.ts` runs it inside Obsidian, the interchange export outside it.
 *
 * Nothing is cached, same as the travel board: every view re-reads on render,
 * so the board can never drift from the notes.
 */
import {
  readNotesOfType,
  type VaultFile,
  type VaultHost,
  type VaultNote,
} from '@technosoftware/trail-core';
import type { APERtrailSettings } from '../settings/types';
import { CrmEntityType, CRM_FOLDER_SETTING } from './entity-types';
import {
  crmPropertyNames,
  type CrmPropertyNames,
  crmTypeValue,
  parseCompanyRecord,
  parsePersonRecord,
} from './crm-note';
import type { CrmBoard, CrmCompany, CrmPerson } from './types';

/**
 * Every note under the folder configured for `kind` that carries the
 * configured type value, with its frontmatter already read.
 *
 * trail-core's `readNotesOfType()`, the same call the board reader makes for
 * the travel types. Two of its rules are the ones this module used to spell
 * out itself: a blank folder finds nothing rather than the vault root, and a
 * blank type value matches nothing rather than every note in the folder. An
 * unset setting therefore hides its folder, which is by far the safer of the
 * two failure modes.
 */
function crmNotesOfKind<F extends VaultFile>(
  host: VaultHost<F>,
  settings: APERtrailSettings,
  properties: CrmPropertyNames,
  kind: CrmEntityType
): VaultNote<F>[] {
  return readNotesOfType(host, {
    folders: [settings[CRM_FOLDER_SETTING[kind]] as string],
    typePropertyName: properties.typePropertyName,
    typeValue: crmTypeValue(properties, kind),
  });
}

export function readCrmBoardFrom<F extends VaultFile>(
  host: VaultHost<F>,
  settings: APERtrailSettings
): CrmBoard<F> {
  const properties = crmPropertyNames(settings);

  const persons: CrmPerson<F>[] = crmNotesOfKind(host, settings, properties, 'person').map(
    ({ file, title, frontmatter }) => ({
      file,
      title,
      ...parsePersonRecord(frontmatter, properties),
    })
  );

  const companies: CrmCompany<F>[] = crmNotesOfKind(host, settings, properties, 'company').map(
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
export function crmTagValues<F extends VaultFile>(board: CrmBoard<F>): string[] {
  const tags = new Set<string>();
  for (const person of board.persons) person.tags.forEach((tag) => tags.add(tag));
  for (const company of board.companies) company.tags.forEach((tag) => tags.add(tag));
  return [...tags].sort((a, b) => a.localeCompare(b));
}
