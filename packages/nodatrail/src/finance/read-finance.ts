/**
 * Reading the money notes out of Obsidian's vault.
 *
 * One delegation per function to finance-reader.ts through `hostFor()`.
 * Nothing is cached, and every record carries the file it came from so a view
 * can open it.
 */
import { App, TFile } from 'obsidian';
import type { BillRecord, PurchaseRecord, RecurringRecord } from '@technosoftware/trail-core';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';
import {
  readBillsFrom,
  readFinanceBoardFrom,
  readPurchasesFrom,
  readRecurringFrom,
  type FinanceBoard,
} from './finance-reader';

export type { FinanceBoard } from './finance-reader';

export function readPurchases(app: App, settings: NODAtrailSettings): PurchaseRecord<TFile>[] {
  return readPurchasesFrom(hostFor(app), settings);
}

export function readBills(app: App, settings: NODAtrailSettings): BillRecord<TFile>[] {
  return readBillsFrom(hostFor(app), settings);
}

export function readRecurring(app: App, settings: NODAtrailSettings): RecurringRecord<TFile>[] {
  return readRecurringFrom(hostFor(app), settings);
}

/** All three in one pass. See finance-reader.ts for why the budget is not among them. */
export function readFinanceBoard(app: App, settings: NODAtrailSettings): FinanceBoard {
  return readFinanceBoardFrom(hostFor(app), settings);
}
