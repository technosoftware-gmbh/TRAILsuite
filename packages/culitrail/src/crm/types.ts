/**
 * The resolved CRM data model.
 *
 * Read-time views over the vault's own notes. Nothing here is persisted as
 * plugin state, and nothing here is ever written: CULItrail reads Person and
 * Company notes and creates neither.
 *
 * `CrmPerson` is deliberately thin. CULItrail needs a person's title to build
 * a meal-plan note path and an order selection, and a person's tags to decide
 * whether they are offered at all. It does not display an address, an email
 * or a phone number anywhere, so it does not read them, and it therefore does
 * not carry a setting naming each one. The moment something displays a
 * contact field, that field gets a configurable property name and a place
 * here, in the same commit. Reading fields nothing shows would mean settings
 * a user has to understand for no visible effect.
 *
 * `CrmCompany` carries more, and by that same rule: an order is pre-filled
 * from what a company charges and a meal is priced in its currency, so those
 * fields are displayed and therefore read. They are still read only. See
 * `company-terms.ts`, which holds the shape and none of the meaning.
 *
 * Neither type refers to another note, so unlike a travel board there is no
 * resolution pass and no cross-reference cycle to unpick: read-crm.ts builds
 * both lists in one go.
 */
import { TFile } from 'obsidian';
import type { CompanyTerms } from './company-terms';

export interface CrmPerson {
  file: TFile;
  /** The note's filename without its extension. This, not the path, is what an order's `person:` wikilink resolves against. */
  title: string;
  tags: string[];
}

export interface CrmCompany {
  file: TFile;
  title: string;
  tags: string[];
  /** What this company is: `meals`, `hotel`, and so on. Empty when it has not said, which means "any". */
  roles: string[];
  /** What this company charges. Every field null or empty on a note that states none. */
  terms: CompanyTerms;
}

export interface CrmBoard {
  persons: CrmPerson[];
  companies: CrmCompany[];
}
