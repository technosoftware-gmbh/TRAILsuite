/**
 * Reading the money notes through the core's vault ports.
 *
 * Nothing is cached, and every record carries the file it came from so a view
 * can open it. The parsing is `trail-core`'s; what is here is the folder, the
 * settings mapping and the pairing with the host's file.
 *
 * Imports nothing from `obsidian` at runtime; read-finance.ts is the Obsidian side.
 */
import type { TFile } from 'obsidian';
import {
  parseBill,
  parsePurchase,
  parseRecurring,
  type BillRecord,
  type PurchaseRecord,
  type RecurringRecord,
  type VaultFile,
  type VaultHost,
} from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { readNotesFrom } from '../vault/notes-reader';
import { billProperties, purchaseProperties, recurringProperties } from './properties';

export function readPurchasesFrom<F extends VaultFile>(
  host: VaultHost<F>,
  settings: NODAtrailSettings
): PurchaseRecord<F>[] {
  const properties = purchaseProperties(settings);

  return readNotesFrom(host, settings, 'purchase').map((note) => ({
    file: note.file,
    title: note.title,
    ...parsePurchase({
      stem: note.title,
      frontmatter: note.frontmatter,
      properties,
    }),
  }));
}

export function readBillsFrom<F extends VaultFile>(
  host: VaultHost<F>,
  settings: NODAtrailSettings
): BillRecord<F>[] {
  const properties = billProperties(settings);

  return readNotesFrom(host, settings, 'bill').map((note) => ({
    file: note.file,
    title: note.title,
    ...parseBill(note.frontmatter, properties),
  }));
}

export function readRecurringFrom<F extends VaultFile>(
  host: VaultHost<F>,
  settings: NODAtrailSettings
): RecurringRecord<F>[] {
  const properties = recurringProperties(settings);

  return readNotesFrom(host, settings, 'recurring').map((note) => ({
    file: note.file,
    title: note.title,
    ...parseRecurring(note.frontmatter, properties),
  }));
}

export interface FinanceBoard<F extends VaultFile = TFile> {
  purchases: PurchaseRecord<F>[];
  bills: BillRecord<F>[];
  recurring: RecurringRecord<F>[];
}

/**
 * All three in one pass.
 *
 * The budget is not among them any more: it is keyed to accounts and measured
 * against postings, so it is read with the ledger rather than beside the notes
 * it used to be measured from.
 */
export function readFinanceBoardFrom<F extends VaultFile>(
  host: VaultHost<F>,
  settings: NODAtrailSettings
): FinanceBoard<F> {
  return {
    purchases: readPurchasesFrom(host, settings),
    bills: readBillsFrom(host, settings),
    recurring: readRecurringFrom(host, settings),
  };
}
