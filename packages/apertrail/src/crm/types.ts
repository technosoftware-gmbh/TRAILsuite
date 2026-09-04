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
import { TFile } from 'obsidian';

export interface CrmPerson {
  file: TFile;
  title: string;
  description: string | null;
  tags: string[];
  address: string | null;
  email: string | null;
  mobile: string | null;
}

export interface CrmCompany {
  file: TFile;
  title: string;
  description: string | null;
  tags: string[];
  address: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
}

export interface CrmBoard {
  persons: CrmPerson[];
  companies: CrmCompany[];
}
