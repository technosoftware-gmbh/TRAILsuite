/**
 * Writing an exported sheet into the vault, and opening it: the Obsidian half.
 *
 * The decisions (create or replace, every folder above, say where, open, what
 * a failure of each means) live in trail-core's `vault/write-sheet.ts`, shared
 * with NODAtrail's ledger sheets. What stays here is what only a plugin has: a
 * `Notice`, a workspace to open a tab in, and the words.
 *
 * **A new tab, not the active leaf.** The note it was exported from is what
 * somebody was looking at, and taking that away is how a person loses their
 * place.
 */
import { App, Notice, TFile } from 'obsidian';
import { writeSheet as writeSheetInVault } from '@technosoftware/trail-core';
import { t } from '../lang/I18nManager';
import { hostFor } from './vault-host';

export interface SheetLabels {
  /** Names the path, so a person can see where it went -- which is also what says the folder changed. */
  written: string;
  failed: string;
}

/** Writes the sheet and opens it in a new tab. Null when the vault refused, after saying so. */
export function writeSheet(
  app: App,
  path: string,
  html: string,
  labels: SheetLabels
): Promise<TFile | null> {
  return writeSheetInVault(hostFor(app), path, html, {
    notify: (message) => new Notice(message),
    open: (file) => app.workspace.getLeaf('tab').openFile(file),
    written: (target) => t(labels.written, { path: target }),
    failed: t(labels.failed),
  });
}
