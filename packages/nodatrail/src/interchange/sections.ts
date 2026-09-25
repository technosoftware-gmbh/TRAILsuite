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
 * People and companies leave in APERtrail's, which reads more of them.
 *
 * **Tasks are lines, not a family.** A checkbox line sits inside a day note, a
 * project, an area or a note no family parses, and it leaves as a `task` line
 * naming its note and line without claiming the note. So a project with tasks
 * is still the project family's, and a task in a loose note still arrives
 * parsed. Every wikilink on a task or a period entry leaves resolved: the
 * title as written, and the note behind it or null.
 */
import {
  familyEntries,
  lineEntries,
  linkResolver,
  type FamilyEntry,
  type LineEntry,
  type VaultFile,
  type VaultHost,
} from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { readParaBoardFrom } from '../para/para-reader';
import { readFinanceBoardFrom } from '../finance/finance-reader';
import { readAccountsFrom, readBudgetsFrom, readJournalsFrom } from '../ledger/ledger-reader';
import { linkedAll, readPeriodNotesFrom } from '../plan/period-reader';
import { readTasksFrom } from '../tasks/task-reader';

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
  'period',
] as const;

export type NodatrailFamily = (typeof NODATRAIL_FAMILIES)[number];

/** The line families, fixed for the same reason. */
export const NODATRAIL_LINES = ['task'] as const;

export type NodatrailLine = (typeof NODATRAIL_LINES)[number];

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
    period: familyEntries(await readPeriodNotesFrom(host, settings)),
  };
}

/**
 * Every task line under `taskFolders`, as the Tasks format reads it, with its
 * links resolved. `raw` is the line exactly as written, so a field this parser
 * does not know (a dependency, somebody's own emoji) is still handed over.
 */
export async function nodatrailLines<F extends VaultFile>(
  host: VaultHost<F>,
  settings: NODAtrailSettings
): Promise<Record<NodatrailLine, LineEntry[]>> {
  const resolve = linkResolver(host.vault.markdownFiles());
  const tasks = (await readTasksFrom(host, settings)).map((task) => ({
    ...task,
    links: linkedAll(resolve, task.links),
  }));
  return { task: lineEntries(tasks) };
}
