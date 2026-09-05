/**
 * Matching a note's sub-heading to a configured appliance.
 *
 * Moved to `trail-core` with the rest of the reheating reader. Nothing about it
 * was settings-aware beyond the appliance list it is handed, so nothing stayed
 * behind; this file is the plugin's name for it, kept so the call sites read the
 * way they always have.
 *
 * App-free.
 */
export { applianceLabel, inApplianceOrder, matchAppliance } from '@technosoftware/trail-core';
export type { ApplianceMatch } from '@technosoftware/trail-core';
