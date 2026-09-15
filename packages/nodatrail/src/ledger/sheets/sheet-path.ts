/**
 * Where a ledger sheet is written: `{financeFolder}/{exportsSubfolder}/{name}.html`.
 *
 * One folder for all of them rather than one beside each note, because a
 * ledger sheet is a reading of the whole ledger rather than of one note, and
 * the finance folder is the ledger's home. Blank `exportsSubfolder` writes
 * into the finance folder itself, as blank does for APERtrail.
 *
 * Replaced on every export, never versioned: the name carries what the sheet
 * is about (the year, the period), so a different period is a different file
 * and the same one is the same file.
 *
 * App-free.
 */
import { joinFolder, sanitizeTitle } from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../../settings/types';

export function ledgerSheetPath(settings: NODAtrailSettings, name: string): string {
  const folder = joinFolder(settings.financeFolder.trim(), settings.exportsSubfolder.trim());
  const file = `${sanitizeTitle(name)}.html`;
  return folder ? `${folder}/${file}` : file;
}
