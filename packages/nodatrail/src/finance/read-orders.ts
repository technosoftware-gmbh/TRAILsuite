/**
 * The order notes a sibling plugin keeps, read out of Obsidian's vault.
 *
 * One delegation to orders-reader.ts, which says why these notes are read at
 * all and why only four facts of each.
 */
import { App } from 'obsidian';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';
import { readOrdersFrom, type OrderRecord } from './orders-reader';

export type { OrderRecord } from './orders-reader';

/** Every order note in the vault, newest first. */
export function readOrders(app: App, settings: NODAtrailSettings): OrderRecord[] {
  return readOrdersFrom(hostFor(app), settings);
}
