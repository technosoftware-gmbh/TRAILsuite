/**
 * NODAtrail's families for the interchange file: what its readers parse out of
 * the vault, one list of records per kind of note.
 *
 * Reads through the host-free readers only, so it runs outside Obsidian, and
 * `tests/host-free.test.ts` at the root walks it like one of them. The raw
 * notes are not repeated here: every note is in `vault.json` already, and a
 * record points at its note by path.
 *
 * **Only what NODAtrail owns.** Order notes are read by the ledger to match a
 * card charge, but they are CULItrail's notes and leave in CULItrail's file.
 * Periodic notes, tasks and CRM notes are not parsed in this version; they
 * arrive raw and are listed in the report as carried raw only.
 */
import {
  familyEntries,
  type FamilyEntry,
  type VaultFile,
  type VaultHost,
} from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { readParaBoardFrom } from '../para/para-reader';
import { readFinanceBoardFrom } from '../finance/finance-reader';
import { readAccountsFrom, readBudgetsFrom, readJournalsFrom } from '../ledger/ledger-reader';

/** The family names, fixed: they are keys an importer on the other side switches on. */
export const NODATRAIL_FAMILIES = [
  'area',
  'goal',
  'project',
  'resource',
  'purchase',
  'bill',
  'recurring',
  'account',
  'journal',
  'budget',
] as const;

export type NodatrailFamily = (typeof NODATRAIL_FAMILIES)[number];

export async function nodatrailFamilies<F extends VaultFile>(
  host: VaultHost<F>,
  settings: NODAtrailSettings
): Promise<Record<NodatrailFamily, FamilyEntry[]>> {
  const para = readParaBoardFrom(host, settings);
  const finance = readFinanceBoardFrom(host, settings);

  return {
    area: familyEntries(para.areas),
    goal: familyEntries(para.goals),
    project: familyEntries(para.projects),
    resource: familyEntries(para.resources),
    purchase: familyEntries(finance.purchases),
    bill: familyEntries(finance.bills),
    recurring: familyEntries(finance.recurring),
    account: familyEntries(readAccountsFrom(host, settings)),
    journal: familyEntries(await readJournalsFrom(host, settings)),
    budget: familyEntries(readBudgetsFrom(host, settings)),
  };
}
