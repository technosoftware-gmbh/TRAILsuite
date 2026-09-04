/**
 * Reads the configured People and Companies folders into the CrmBoard shape.
 *
 * A thin layer over vault/read-notes.ts, and deliberately so. The folder-and-
 * type rule is not reimplemented here: a Person is found on exactly the same
 * terms a meal or an order is, which is what stops the two readers from
 * ever disagreeing about what counts. What this module adds on top is the
 * per-kind tag property, which vault/read-notes.ts has no business knowing
 * about.
 *
 * Nothing is cached. Every view re-reads on render, so the board can never
 * drift from the notes.
 *
 * This file is shaped like APERtrail's `src/crm/read-crm.ts` on purpose, down
 * to the name, so the two can be read side by side. They are not shared code
 * and never will be: they are two implementations that have agreed on one
 * contract, and the contract lives in the vault rather than in either
 * codebase.
 */
import { App } from 'obsidian';
import { CULItrailSettings } from '../settings/types';
import { readNotesOfType } from '../vault/read-notes';
import { CrmKind, crmPropertyNames, parseCrmRecord } from './crm-note';
import { CrmBoard, CrmCompany, CrmPerson } from './types';

export function readCrmBoard(app: App, settings: CULItrailSettings): CrmBoard {
  const properties = crmPropertyNames(settings);

  const read = <T extends CrmPerson | CrmCompany>(kind: CrmKind): T[] =>
    readNotesOfType(app, settings, kind).map(
      (note) =>
        ({
          file: note.file,
          title: note.title,
          ...parseCrmRecord(note.frontmatter, properties, kind),
        }) as T
    );

  // readNotesOfType already sorts by title, so both lists arrive in a stable
  // order and no view has to sort again to render deterministically.
  return {
    persons: read<CrmPerson>('person'),
    companies: read<CrmCompany>('company'),
  };
}

/** Just the people, for callers that have no use for the companies. */
export function readPersons(app: App, settings: CULItrailSettings): CrmPerson[] {
  return readCrmBoard(app, settings).persons;
}

/** Just the companies. */
export function readCompanies(app: App, settings: CULItrailSettings): CrmCompany[] {
  return readCrmBoard(app, settings).companies;
}

/**
 * Every tag any CRM note carries, sorted and deduplicated.
 *
 * Offered as suggestions when configuring the eligibility filter, so that a
 * third spelling of the same tag does not quietly appear in a vault that
 * already has two.
 */
export function crmTagValues(board: CrmBoard): string[] {
  const tags = new Set<string>();
  for (const person of board.persons) person.tags.forEach((tag) => tags.add(tag));
  for (const company of board.companies) company.tags.forEach((tag) => tags.add(tag));
  return [...tags].sort((a, b) => a.localeCompare(b));
}
