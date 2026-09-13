/**
 * The archive's vault half: putting a statement in, and reading the folder back.
 *
 * The pure decisions -- what a file is called, which format it is in -- are in
 * `statement-archive.ts`. This is the part that needs an `App`.
 */
import { TFile, normalizePath, type App } from 'obsidian';
import {
  acceptedRows,
  parseDayTitle,
  parseStatement,
  planImport,
} from '@technosoftware/trail-core';
import type { Account, BankStatementRow, Posting } from '@technosoftware/trail-core';
import { importFolderFor } from '../finance/document-file';
import { freeImportName, importStamp } from '../shared/import-name';
import type { NODAtrailSettings } from '../settings/types';
import {
  profileFor,
  readStatementFileName,
  statementFileName,
  type ArchivedName,
} from './statement-archive';

/**
 * Where a statement is filed.
 *
 * By the year its **last** row falls in, which is the same rule the card
 * profile uses to date a row: the month whose balance a movement changed is the
 * month it belongs to. A file spanning a new year therefore lands in the newer
 * one, beside the journal notes it most recently fed.
 *
 * Empty when `importSubfolder` is blank, which means keep nothing, because
 * there is nowhere to put it that is not somebody else's folder.
 */
function folderFor(settings: NODAtrailSettings, rows: readonly BankStatementRow[]): string {
  const last = rows[rows.length - 1];
  const day = last ? parseDayTitle(last.date) : null;
  return day ? importFolderFor(settings, 'journal', day) : '';
}

export interface Archived {
  file: TFile;
  name: ArchivedName;
}

/**
 * Keeps the file the postings came from.
 *
 * **Never stores the same bytes twice.** Re-importing a file that is already
 * archived is a normal thing to do -- it is how somebody finishes the rows they
 * left undecided -- and it must not leave a second copy behind each time. Since
 * the name now carries the run's own stamp, sameness can no longer be a
 * question about one name: every file already kept for this account and period
 * is compared, and an identical one ends the matter. Stronger than the name
 * check it replaces, which could not recognise a file kept under a stamp this
 * run has no way to guess.
 *
 * **And never overwrites.** A *different* file covering the same period is a
 * second file, because two exports of one month are two documents and the later
 * one is not necessarily the better one. The stamp keeps them apart by itself.
 *
 * Returns the path it landed at, or null when nothing was written: no folder
 * configured, no dated rows, or the identical file already there.
 */
export async function archiveStatement(
  app: App,
  settings: NODAtrailSettings,
  account: number,
  rows: readonly BankStatementRow[],
  text: string,
  now: Date
): Promise<string | null> {
  const folder = folderFor(settings, rows);
  if (!folder || rows.length === 0) return null;

  const path = normalizePath(folder);
  if (!app.vault.getFolderByPath(path)) await app.vault.createFolder(path);

  const first = rows[0]?.date ?? '';
  const last = rows[rows.length - 1]?.date ?? first;
  const existing = app.vault.getFolderByPath(path)?.children ?? [];
  const taken = new Set(existing.map((child) => child.name));

  for (const child of existing) {
    if (!(child instanceof TFile)) continue;
    const name = readStatementFileName(child.name);
    if (!name || name.account !== account || name.from !== first || name.to !== last) continue;
    if ((await app.vault.cachedRead(child)) === text) return child.path;
  }

  const name = freeImportName(statementFileName(importStamp(now), account, rows), taken);
  const written = await app.vault.create(`${path}/${name}`, text);
  return written.path;
}

/** Every statement this plugin has filed, newest period first. */
export function readArchive(app: App, settings: NODAtrailSettings): Archived[] {
  const subfolder = settings.importSubfolder.trim();
  if (!subfolder) return [];

  const found: Archived[] = [];
  for (const file of app.vault.getFiles()) {
    if (file.extension.toLowerCase() !== 'csv') continue;
    if (file.parent?.name !== subfolder) continue;

    const name = readStatementFileName(file.name);
    if (name) found.push({ file, name });
  }

  return found.sort(
    (a, b) => b.name.to.localeCompare(a.name.to) || b.name.stamp.localeCompare(a.name.stamp)
  );
}

export interface ArchiveStanding {
  archived: Archived;
  rows: number;
  /** Rows this file holds that the ledger does not: the ones still to answer. */
  unposted: number;
  /** What those rows come to, so a difference in a balance can be recognised. */
  unpostedTotal: number;
}

/**
 * How much of an archived statement the ledger has taken.
 *
 * Replayed rather than remembered. Nothing was written down about the import,
 * so this is what is true now: correct a posting or answer a row that was left
 * and the count moves by itself.
 *
 * A file whose format cannot be worked out is reported with no rows rather than
 * dropped, so a statement that stopped parsing is visible instead of silently
 * absent.
 */
export async function standingOf(
  app: App,
  settings: NODAtrailSettings,
  archived: Archived,
  accounts: readonly Account[],
  postings: readonly Posting[]
): Promise<ArchiveStanding> {
  const text = await app.vault.cachedRead(archived.file);
  const profile = profileFor(text);
  if (!profile) return { archived, rows: 0, unposted: 0, unpostedTotal: 0 };

  const rows = acceptedRows(parseStatement(text, profile), profile);
  const plan = planImport(rows, {
    intoAccount: archived.name.account,
    accounts,
    rules: settings.importRules,
    existing: postings,
  });

  // Ready and undecided alike: both are rows the ledger has not taken. A row
  // that only needs an account is as absent from a balance as one nobody has
  // looked at.
  const outstanding = plan.proposals.filter(
    (proposal) =>
      proposal.status === 'ready' ||
      proposal.status === 'needs-account' ||
      proposal.status === 'needs-split'
  );

  return {
    archived,
    rows: rows.length,
    unposted: outstanding.length,
    unpostedTotal: outstanding.reduce((sum, proposal) => sum + proposal.row.amount, 0),
  };
}
