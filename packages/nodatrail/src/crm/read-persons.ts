/**
 * The people a picker may offer.
 *
 * NODAtrail keeps no contact list of its own, exactly as the other two do not:
 * a Person is a note in the configured folder carrying the configured type
 * value, optionally narrowed by a tag filter. This is a third implementation of
 * that idea rather than a shared one, because the packages carry different
 * licences and may not import each other; what is shared is the rule underneath
 * it, which is `trail-core`'s.
 *
 * **An empty filter admits everyone, never nobody.** A vault that has never
 * touched `eligiblePersonTags` sees every person rather than an empty dropdown
 * that reads as a broken plugin. `filterByTags` answers that case itself, which
 * is why there is no early return for it here.
 *
 * Nothing is cached. The list is read when a form opens, so a person added a
 * minute ago is offered rather than missing until a reload.
 */
import type { App } from 'obsidian';
import {
  filterByTags,
  parseCrmNote,
  parseTagFilter,
  readNotesOfType,
  type CrmPropertyNames,
} from 'trail-core';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';

/** The CRM property names this plugin configures, in the shape `trail-core` wants. */
function crmProperties(settings: NODAtrailSettings): CrmPropertyNames {
  return {
    typePropertyName: settings.typePropertyName,
    personTypeValue: settings.personTypeValue,
    companyTypeValue: settings.companyTypeValue,
    personTagProperty: settings.personTagProperty,
    companyTagProperty: settings.companyTagProperty,
  };
}

/**
 * Every Person title the vault offers, narrowed by `eligiblePersonTags`,
 * de-duplicated and sorted.
 *
 * The filter is per plugin on purpose rather than shared through the CRM
 * contract: `CRM/People` holds everyone the vault has a note for, and the
 * people who own a household's accounts are not the people who belong on a
 * trip, nor the authors of the books somebody is reading.
 */
export function eligiblePersonTitles(app: App, settings: NODAtrailSettings): string[] {
  const properties = crmProperties(settings);
  const people = readNotesOfType(hostFor(app), {
    folders: [settings.personsFolder],
    typePropertyName: settings.typePropertyName,
    typeValue: settings.personTypeValue,
  }).map((note) => ({
    title: note.title,
    tags: parseCrmNote(note.frontmatter, properties, 'person').tags,
  }));

  const eligible = filterByTags(people, parseTagFilter(settings.eligiblePersonTags));
  return [...new Set(eligible.map((person) => person.title))].sort((a, b) => a.localeCompare(b));
}
