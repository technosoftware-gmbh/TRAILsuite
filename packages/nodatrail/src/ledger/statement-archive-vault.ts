/**
 * The archive's vault half: putting a statement in, and reading the folder back.
 *
 * The pure decisions -- what a file is called, which format it is in -- are in
 * `statement-archive.ts`. This is the part that needs an `App`.
 */
import { TFile, normalizePath, type App } from 'obsidian';
import { acceptedRows, parseDayTitle, parseStatement, planImport } from 'trail-core';
import type { Account, BankStatementRow, Posting } from 'trail-core';
import { documentFolderFor } from '../finance/document-file';
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
 * Empty when `documentSubfolder` is blank, which means "leave documents where
 * they are" -- and here means keep nothing, because there is nowhere to put it
 * that is not somebody else's folder.
 */
function folderFor(settings: NODAtrailSettings, rows: readonly BankStatementRow[]): string {
  const last = rows[rows.length - 1];
  const day = last ? parseDayTitle(last.date) : null;
  return day ? documentFolderFor(settings, 'journal', day) : '';
}

export interface Archived {
  file: TFile;
  name: ArchivedName;
}

/**
 * Keeps the file the postings came from.
 *
 * **Never overwrites, and never stores the same bytes twice.** Re-importing a
 * file that is already archived is a normal thing to do -- it is how somebody
 * finishes the rows they left undecided -- and it must not leave a second copy
 * behind each time. A *different* file that happens to cover the same period
 * gets a numbered name instead, because two exports of one month are two
 * documents and the later one is not necessarily the better one.
 *
 * Returns the path it landed at, or null when nothing was written: no folder
 * configured, no dated rows, or the identical file already there.
 */
export async function archiveStatement(
  app: App,
  settings: NODAtrailSettings,
  account: number,
  rows: readonly BankStatementRow[],
  text: string
): Promise<string | null> {
  const folder = folderFor(settings, rows);
  if (!folder || rows.length === 0) return null;

  const path = normalizePath(folder);
  if (!app.vault.getFolderByPath(path)) await app.vault.createFolder(path);

  const wanted = statementFileName(account, rows);
  const existing = app.vault.getFolderByPath(path)?.children ?? [];
  const taken = new Set(existing.map((child) => child.name));

  // The same bytes under the wanted name means this file is already kept.
  const sameName = existing.find((child) => child.name === wanted);
  if (sameName instanceof TFile) {
    const held = await app.vault.cachedRead(sameName);
    if (held === text) return sameName.path;
  }

  let name = wanted;
  for (let index = 2; taken.has(name) && index < 100; index += 1) {
    name = wanted.replace(/\.csv$/i, ` ${index}.csv`);
  }

  const written = await app.vault.create(`${path}/${name}`, text);
  return written.path;
}

/** Every statement this plugin has filed, newest period first. */
export function readArchive(app: App, settings: NODAtrailSettings): Archived[] {
  const subfolder = settings.documentSubfolder.trim();
  if (!subfolder) return [];

  const found: Archived[] = [];
  for (const file of app.vault.getFiles()) {
    if (file.extension.toLowerCase() !== 'csv') continue;
    if (file.parent?.name !== subfolder) continue;

    const name = readStatementFileName(file.name);
    if (name) found.push({ file, name });
  }

  return found.sort((a, b) => b.name.to.localeCompare(a.name.to));
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
