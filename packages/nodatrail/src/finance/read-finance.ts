/**
 * Reading the money notes out of the vault.
 *
 * Nothing is cached, and every record carries the file it came from so a view
 * can open it. The parsing is `trail-core`'s; what is here is the folder, the
 * settings mapping and the pairing with a `TFile`.
 */
import { App, TFile } from 'obsidian';
import {
  parseBill,
  parsePurchase,
  parseRecurring,
  type BillRecord,
  type PurchaseRecord,
  type RecurringRecord,
} from 'trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { readNotes } from '../vault/read-notes';
import { billProperties, purchaseProperties, recurringProperties } from './properties';

export function readPurchases(app: App, settings: NODAtrailSettings): PurchaseRecord<TFile>[] {
  const properties = purchaseProperties(settings);

  return readNotes(app, settings, 'purchase').map((note) => ({
    file: note.file,
    title: note.title,
    ...parsePurchase({
      stem: note.title,
      frontmatter: note.frontmatter,
      properties,
    }),
  }));
}

export function readBills(app: App, settings: NODAtrailSettings): BillRecord<TFile>[] {
  const properties = billProperties(settings);

  return readNotes(app, settings, 'bill').map((note) => ({
    file: note.file,
    title: note.title,
    ...parseBill(note.frontmatter, properties),
  }));
}

export function readRecurring(app: App, settings: NODAtrailSettings): RecurringRecord<TFile>[] {
  const properties = recurringProperties(settings);

  return readNotes(app, settings, 'recurring').map((note) => ({
    file: note.file,
    title: note.title,
    ...parseRecurring(note.frontmatter, properties),
  }));
}

export interface FinanceBoard {
  purchases: PurchaseRecord<TFile>[];
  bills: BillRecord<TFile>[];
  recurring: RecurringRecord<TFile>[];
}

/**
 * All three in one pass.
 *
 * The budget is not among them any more: it is keyed to accounts and measured
 * against postings, so it is read with the ledger rather than beside the notes
 * it used to be measured from.
 */
export function readFinanceBoard(app: App, settings: NODAtrailSettings): FinanceBoard {
  return {
    purchases: readPurchases(app, settings),
    bills: readBills(app, settings),
    recurring: readRecurring(app, settings),
  };
}
