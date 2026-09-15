/**
 * Writing a printed sheet into the vault, and opening it: the Obsidian half.
 *
 * The decisions (create or replace, every folder above, say where, open, what
 * a failure of each means) live in trail-core's `vault/write-sheet.ts`, which
 * APERtrail's sheets go through as well. What stays here is what only a plugin
 * has: a `Notice`, a workspace to open a tab in, and the words.
 *
 * **A new tab, not the active leaf.** The ledger view is what somebody was
 * reading, and taking it away is how a person loses their place.
 */
import { App, Notice, TFile } from 'obsidian';
import { writeSheet as writeSheetInVault } from '@technosoftware/trail-core';
import { t } from '../lang/I18nManager';
import { hostFor } from './vault-host';

/** Writes the sheet and opens it in a new tab. Null when the vault refused, after saying so. */
export function writeSheet(app: App, path: string, html: string): Promise<TFile | null> {
  return writeSheetInVault(hostFor(app), path, html, {
    notify: (message) => new Notice(message),
    open: (file) => app.workspace.getLeaf('tab').openFile(file),
    written: (target) => t('sheets.written', { path: target }),
    failed: t('sheets.failed'),
  });
}
