/**
 * Reading the ledger out of Obsidian's vault.
 *
 * One delegation per function to ledger-reader.ts. The postings are text in the
 * body of a journal note, which is why reading them is asynchronous while the
 * rest of the plugin's readers are not. Nothing is cached beyond what Obsidian
 * itself caches: a view re-reads on render.
 */
import { App, TFile } from 'obsidian';
import type { AccountBudgetRecord, VaultHost } from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { hostFor } from '../shared/vault-host';
import {
  readAccountsFrom,
  readBudgetsFrom,
  readJournalsFrom,
  readLedgerFrom,
  type AccountRecord,
  type JournalRecord,
  type Ledger,
} from './ledger-reader';

export {
  misfiledPostings,
  type AccountRecord,
  type JournalRecord,
  type Ledger,
} from './ledger-reader';

/**
 * The host with `cachedRead` in place of `read`.
 *
 * A view asking for the ledger on every render must not hit the disk once per
 * journal note per render. Only the reading paths here take it: a writer that
 * reads before it modifies wants the file as it is on disk, not as it was cached.
 */
function cachedHostFor(app: App): VaultHost<TFile> {
  const host = hostFor(app);
  return { ...host, vault: { ...host.vault, read: (file) => app.vault.cachedRead(file) } };
}

/** The chart, in account-number order. */
export function readAccounts(app: App, settings: NODAtrailSettings): AccountRecord[] {
  return readAccountsFrom(hostFor(app), settings);
}

/** Every journal note read. */
export function readJournals(app: App, settings: NODAtrailSettings): Promise<JournalRecord[]> {
  return readJournalsFrom(cachedHostFor(app), settings);
}

/** The chart and the journals together, which is what every report needs. */
export function readLedger(app: App, settings: NODAtrailSettings): Promise<Ledger> {
  return readLedgerFrom(cachedHostFor(app), settings);
}

/** The budget notes, newest year first. */
export function readBudgets(app: App, settings: NODAtrailSettings): AccountBudgetRecord<TFile>[] {
  return readBudgetsFrom(hostFor(app), settings);
}
