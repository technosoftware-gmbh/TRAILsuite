/**
 * The account and category a counterparty's paperwork usually uses.
 *
 * Read from the note and written back to it, which makes the mapping part of
 * the vault rather than part of this plugin's settings: it survives a
 * reinstall, it is visible in the note somebody already has open, and it can be
 * corrected with Obsidian's own property editor by anybody who never opens a
 * NODAtrail dialog.
 *
 * **Persons as well as companies.** A household is billed by a person often
 * enough -- a tradesman, a tutor, a neighbour -- and such a note learns its
 * account on the same terms a company note does. The alternative was two rules
 * for one question, and a person note whose `account:` somebody had filled in
 * by hand and that nothing ever read.
 *
 * **Additive on a shared note.** These notes belong to all three plugins and to
 * none, and the shared contract is about where they live and what identifies
 * one. Two more properties are invisible to the other two plugins, and nothing
 * here touches a field the contract names.
 */
import { App, TFile } from 'obsidian';
import {
  parseCompanyDefaults,
  readNotesOfType,
  type CompanyDefaultProperties,
  type CompanyDefaults,
} from '@technosoftware/trail-core';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';

export function companyDefaultProperties(settings: NODAtrailSettings): CompanyDefaultProperties {
  return {
    accountProperty: settings.companyAccountProperty,
    categoryProperty: settings.companyCategoryProperty,
  };
}

/**
 * The company or person note titled this, or null.
 *
 * Companies are searched first, on the same rule the picker offers them by: a
 * title that is both is far likelier to be the company, and the two have to
 * agree or a form would read from one note and write to the other.
 */
function counterpartyNote(
  app: App,
  settings: NODAtrailSettings,
  title: string
): {
  file: TFile;
  frontmatter: Record<string, unknown>;
} | null {
  const wanted = title.trim();
  if (!wanted) return null;

  const folders: [string, string][] = [
    [settings.companiesFolder, settings.companyTypeValue],
    [settings.personsFolder, settings.personTypeValue],
  ];

  for (const [folder, typeValue] of folders) {
    const note = readNotesOfType(hostFor(app), {
      folders: [folder],
      typePropertyName: settings.typePropertyName,
      typeValue,
    }).find((entry) => entry.title === wanted);
    if (note) return { file: note.file, frontmatter: note.frontmatter };
  }

  return null;
}

/**
 * What this company or person usually does, or nothing.
 *
 * Nothing for a counterparty nobody has classified and for a name with no note
 * behind it, which are the same non-event from a form's point of view.
 */
export function readCompanyDefaults(
  app: App,
  settings: NODAtrailSettings,
  title: string
): CompanyDefaults {
  const note = counterpartyNote(app, settings, title);
  return note
    ? parseCompanyDefaults(note.frontmatter, companyDefaultProperties(settings))
    : { account: null, category: null };
}

/**
 * The companies flagged as collecting on somebody else's behalf.
 *
 * Returned as titles, because that is all the matcher wants: it looks for one
 * of these names in a statement row's text. Empty is the ordinary case and the
 * safe one -- no company flagged means every row must still name its vendor.
 *
 * The flag is read loosely on purpose. A property editor writes `true`, a
 * person typing into the note writes `yes` or `ja`, and a note that says
 * `paymentProvider: Klarna` meant to say yes as well. Only an explicit no is
 * treated as a no.
 *
 * **Companies only, unlike the defaults above.** Klarna and a card acquirer are
 * companies by definition, and this list is what the statement importer matches
 * a row's text against -- which ends in a posting. Widening it to persons would
 * widen what the importer will match on for a case that does not exist.
 */
export function paymentProviderCompanies(app: App, settings: NODAtrailSettings): string[] {
  const property = settings.companyPaymentProviderProperty;
  if (!property) return [];

  return readNotesOfType(hostFor(app), {
    folders: [settings.companiesFolder],
    typePropertyName: settings.typePropertyName,
    typeValue: settings.companyTypeValue,
  })
    .filter((note) => readsAsYes(note.frontmatter[property]))
    .map((note) => note.title);
}

const DENIED = new Set(['false', 'no', 'nein', '0', '']);

/**
 * Whether a frontmatter value reads as yes.
 *
 * Exported because the edit form has to read the flag back on exactly the terms
 * the matcher reads it on. Two copies of this rule would eventually disagree,
 * and the symptom would be a toggle that shows off for a company the import
 * treats as a payment provider.
 */
export function readsAsYes(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return !DENIED.has(value.trim().toLowerCase());
  return false;
}

/**
 * Teaches a company or a person what their paperwork usually looks like.
 *
 * Writes only the two properties, and only the ones with a value: clearing them
 * is the property editor's job, not a side effect of entering one invoice.
 * False when there is no note to write to, which a caller says out loud rather
 * than swallowing -- somebody who pressed a button expects something to happen.
 */
export async function rememberCompanyDefaults(
  app: App,
  settings: NODAtrailSettings,
  title: string,
  defaults: CompanyDefaults
): Promise<boolean> {
  const note = counterpartyNote(app, settings, title);
  if (!note) return false;

  await hostFor(app).frontmatter.process(note.file, (frontmatter) => {
    if (defaults.account !== null) frontmatter[settings.companyAccountProperty] = defaults.account;
    if (defaults.category) frontmatter[settings.companyCategoryProperty] = defaults.category;
  });
  return true;
}
