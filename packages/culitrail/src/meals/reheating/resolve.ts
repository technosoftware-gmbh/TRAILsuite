/**
 * Resolving a dish's reheating entry against its supplier's, per appliance.
 *
 * The merge rule moved to `trail-core`, where it is written to be read against
 * the table in docs/design/ready-meals.md. What stayed here is the one thing
 * that is CULItrail's: the appliance order is a setting, and the core holds no
 * settings, so it takes the order as an argument and this file is where it
 * comes from.
 *
 * App-free.
 */
import {
  resolveReheating as resolve,
  type ApplianceEntry,
  type ReheatInstruction,
} from 'trail-core';
import type { CULItrailSettings } from '../../settings/types';

export { resolveAppliance } from 'trail-core';

export function resolveReheating(
  dishEntries: ApplianceEntry[],
  supplierEntries: ApplianceEntry[],
  settings: CULItrailSettings
): ReheatInstruction[] {
  return resolve(dishEntries, supplierEntries, settings.reheatAppliances);
}
