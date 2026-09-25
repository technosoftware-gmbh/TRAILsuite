/**
 * The resolved CRM data model. Read-time views over the vault's own notes,
 * same as vault/types.ts: nothing here is persisted as plugin state.
 *
 * Neither type refers to another note, so unlike the travel board there is
 * no resolution pass and no cross-reference cycle to unpick -- read-crm.ts
 * builds both lists in one go.
 *
 * The sample vault's People notes also carry `private:` and `work:` phone
 * fields, deliberately unread: `mobile` is the one filled in practice, and
 * two more settings to read two fields nothing displays is not a trade
 * worth making. They stay hand-edited, like every cosmetic field
 * vault/create-entities.ts already declines to write.
 */
import type { TFile } from 'obsidian';
import type { VaultFile } from '@technosoftware/trail-core';

/**
 * The file type defaults to Obsidian's so no caller inside the plugin names it;
 * the export reads the same records over a filesystem host.
 */
export interface CrmPerson<F extends VaultFile = TFile> {
  file: F;
  title: string;
  description: string | null;
  tags: string[];
  /** What this person is to the household (`traveller`, `eater`), from `personRolesProperty`. */
  roles: string[];
  address: string | null;
  email: string | null;
  mobile: string | null;
}

export interface CrmCompany<F extends VaultFile = TFile> {
  file: F;
  title: string;
  description: string | null;
  tags: string[];
  /** What this company is to the household (`carrier`, `hotel`, `vendor`), from `companyRolesProperty`. */
  roles: string[];
  address: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
}

export interface CrmBoard<F extends VaultFile = TFile> {
  persons: CrmPerson<F>[];
  companies: CrmCompany<F>[];
}
