/**
 * The CRM board inside Obsidian: one delegation to the host-free reader in
 * `crm-reader.ts`, which the interchange export runs outside it.
 */
import { App } from 'obsidian';
import { hostFor } from '../shared/vault-host';
import type { APERtrailSettings } from '../settings/types';
import { crmPropertyNames } from './crm-note';
import { crmTagValues, readCrmBoardFrom } from './crm-reader';
import type { CrmBoard } from './types';

export { crmPropertyNames, crmTagValues };

export function readCrmBoard(app: App, settings: APERtrailSettings): CrmBoard {
  return readCrmBoardFrom(hostFor(app), settings);
}
