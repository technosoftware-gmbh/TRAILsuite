/**
 * Which folder each kind of note lives in, and what marks it as that kind.
 *
 * One registry rather than a folder setting named at each reader, because the
 * same question is asked by the readers, the creators, the archive commands and
 * the health check, and four places that each name their own folder setting are
 * four places to disagree about where a project is.
 *
 * **A note counts as a given kind only if it is under the folder AND its type
 * property carries the value.** That is `readNotesOfType()`'s rule, and it is
 * what makes the archive work without a flag: an archived project is a project
 * note in a different folder, so the active read simply does not see it.
 */
import type { NoteKindQuery } from 'trail-core';
import { splitList } from '../settings/defaults';
import type { NODAtrailSettings, StringSettingKey } from '../settings/types';

/** The four PARA kinds. These are the ones that can be archived. */
export const PARA_TYPES = ['area', 'goal', 'project', 'resource'] as const;
export type ParaType = (typeof PARA_TYPES)[number];

/** The four money kinds. */
export const FINANCE_TYPES = ['purchase', 'bill', 'recurring', 'budget'] as const;
export type FinanceType = (typeof FINANCE_TYPES)[number];

/** The two ledger kinds. Neither is archived: an account is closed, and a journal is history. */
export const LEDGER_TYPES = ['account', 'journal'] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

export type NodaFolderType = ParaType | FinanceType | LedgerType;

interface FolderKind {
  folderKey: StringSettingKey;
  typeValueKey: StringSettingKey;
  /** The setting naming the archive sub-folder. Absent for kinds that are not archived. */
  archiveCategoryKey?: StringSettingKey;
}

/**
 * The archive sub-folder names are settings, like every other folder name.
 *
 * **They were English literals, and the reason recorded for that is worth
 * keeping rather than deleting:** nobody browses `6 Archive/Projects` looking
 * for a project, a vault that wants the archive elsewhere moves
 * `archiveFolder` and takes all four with it, and four more rows on the page
 * answer a question nobody asks.
 *
 * That held while an archive was a handful of notes. It stopped holding for a
 * vault filing a hundred projects a year, which is browsed -- and where
 * `6 Archiv/Projects` sat among `1 Bereiche`, `2 Ziele` and `3 Projekte` as the
 * one English folder the plugin had ever created, because it was the one folder
 * name that did not come from the translation tables.
 */
const KINDS: Readonly<Record<NodaFolderType, FolderKind>> = Object.freeze({
  area: {
    folderKey: 'areasFolder',
    typeValueKey: 'areaTypeValue',
    archiveCategoryKey: 'areasArchiveFolder',
  },
  goal: {
    folderKey: 'goalsFolder',
    typeValueKey: 'goalTypeValue',
    archiveCategoryKey: 'goalsArchiveFolder',
  },
  project: {
    folderKey: 'projectsFolder',
    typeValueKey: 'projectTypeValue',
    archiveCategoryKey: 'projectsArchiveFolder',
  },
  resource: {
    folderKey: 'resourcesFolder',
    typeValueKey: 'resourceTypeValue',
    archiveCategoryKey: 'resourcesArchiveFolder',
  },
  purchase: { folderKey: 'purchasesFolder', typeValueKey: 'purchaseTypeValue' },
  bill: { folderKey: 'billsFolder', typeValueKey: 'billTypeValue' },
  recurring: { folderKey: 'recurringFolder', typeValueKey: 'recurringTypeValue' },
  budget: { folderKey: 'budgetsFolder', typeValueKey: 'budgetTypeValue' },
  account: { folderKey: 'accountsFolder', typeValueKey: 'accountTypeValue' },
  journal: { folderKey: 'journalFolder', typeValueKey: 'journalTypeValue' },
});

/** The folder a kind's live notes are in. */
export function folderFor(settings: NODAtrailSettings, type: NodaFolderType): string {
  return String(settings[KINDS[type].folderKey]).trim();
}

/** The `type:` value that marks a note as this kind. */
export function typeValueFor(settings: NODAtrailSettings, type: NodaFolderType): string {
  return String(settings[KINDS[type].typeValueKey]).trim();
}

/** Where a kind's archived notes go, or null for a kind that is not archived. */
export function archiveFolderFor(settings: NODAtrailSettings, type: NodaFolderType): string | null {
  const key = KINDS[type].archiveCategoryKey;
  const category = key ? String(settings[key]).trim() : '';
  const root = settings.archiveFolder.trim();
  if (!category || !root) return null;
  return `${root}/${category}`;
}

/**
 * Where a note archived today goes: the category folder, then a year.
 *
 * **A year and not a month.** Around 110 projects a year end up here, which is
 * a folder somebody can scroll; twelve folders of ten would be two clicks and a
 * memory test, and nobody remembers which month a thing finished in. The active
 * folders stay flat for the same reason in reverse: fifteen run at a time, and
 * a running project filed under the month it started is filed where nobody
 * would look for it.
 *
 * **The year is when it was archived**, not when the note was made. This is the
 * shelf a thing is put on, and the day it was put there is the one fact the
 * move itself knows.
 *
 * A blank `archiveYearFolders` puts everything straight in the category folder,
 * which is what the vault did before this and what a vault with ten projects a
 * year should keep doing.
 */
export function archiveFolderOn(
  settings: NODAtrailSettings,
  type: NodaFolderType,
  today: Date
): string | null {
  const base = archiveFolderFor(settings, type);
  if (!base || !settings.archiveYearFolders) return base;
  return `${base}/${today.getFullYear()}`;
}

/**
 * The query for a kind's live notes.
 *
 * A blank folder or a blank type value produces a query that matches nothing,
 * which is `readNotesOfType()`'s own guard and the failure mode this plugin
 * wants: a folder that shows nothing prompts somebody to check the setting,
 * whereas a folder read as the vault root would claim every note there is.
 */
export function queryFor(settings: NODAtrailSettings, type: NodaFolderType): NoteKindQuery {
  return {
    folders: [folderFor(settings, type)],
    typePropertyName: settings.typePropertyName,
    typeValue: typeValueFor(settings, type),
  };
}

/** The query for a kind's archived notes. Matches nothing for a kind that is not archived. */
export function archivedQueryFor(settings: NODAtrailSettings, type: NodaFolderType): NoteKindQuery {
  const folder = archiveFolderFor(settings, type);
  return {
    folders: folder ? [folder] : [],
    typePropertyName: settings.typePropertyName,
    typeValue: typeValueFor(settings, type),
  };
}

/** Both at once, for a view showing the archive alongside the live notes. */
export function anyQueryFor(settings: NODAtrailSettings, type: NodaFolderType): NoteKindQuery {
  const archive = archiveFolderFor(settings, type);
  return {
    folders: archive ? [folderFor(settings, type), archive] : [folderFor(settings, type)],
    typePropertyName: settings.typePropertyName,
    typeValue: typeValueFor(settings, type),
  };
}

/** Every folder NODAtrail claims a note in, for the health check's inverse question. */
export function allClaimedFolders(settings: NODAtrailSettings): string[] {
  const folders = (Object.keys(KINDS) as NodaFolderType[]).flatMap((type) => [
    folderFor(settings, type),
    archiveFolderFor(settings, type) ?? '',
  ]);
  return folders.filter((folder) => folder !== '');
}

/** The folders tasks are read out of. */
export function taskFolders(settings: NODAtrailSettings): string[] {
  return splitList(settings.taskFolders);
}
