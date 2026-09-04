/**
 * Reheating an ordered meal.
 *
 * Every meal note is something bought ready and warmed up, so the instructions
 * it carries are per appliance and belong to the meal as a product rather than
 * to any one order of it. CULItrail worked all of that out against a real
 * vault, and the line drawn afterwards was between what the section **means**
 * and what one host does with it: the meaning is here, the Obsidian half stayed
 * in the plugin. What a `## Steamer` heading names, which of its lines are
 * values and which are prose, and how a dish's entry resolves against its
 * supplier's are all properties of the section as written in a note, so they
 * outlive any view of it and cannot be redefined by one. The split pays twice
 * over: the plugin imports this half rather than owning it, and this half is
 * testable without a vault, which is why the merge table below can be read
 * against a document rather than against a screenshot.
 *
 * The parts, in the order a reader uses them:
 *
 * 1. `parseApplianceEntries` turns a note's already-split section into one entry
 *    per appliance. What a note **says**.
 * 2. `resolveReheating` merges a meal's entries against its supplier's, per
 *    appliance. What a reader should **show**. The merge table lives in
 *    CULItrail's `docs/design/ready-meals.md` and this is written to be read
 *    against it.
 * 3. `upsertReheatSection` writes entries back, so a consumer can be the place
 *    the numbers get typed rather than only the place they are displayed.
 *
 * What did **not** move: reading a company note off a vault, and splitting a
 * body into sections. Both are things a consumer answers its own way, against
 * whatever host it has.
 */
export {
  APPLIANCE_LABELS_DE,
  APPLIANCE_LABELS_EN,
  DEFAULT_APPLIANCES,
  DEFAULT_APPLIANCE_IDS,
  applianceLabel,
  inApplianceOrder,
  matchAppliance,
} from './appliances.js';
export type { ApplianceMatch, DefaultApplianceId } from './appliances.js';
export {
  DEFAULT_REHEAT_FIELDS,
  parseApplianceEntries,
  parseApplianceEntry,
  parseBlockSteps,
} from './parse-entries.js';
export type { ApplianceBlock, ParseEntriesOptions, ReheatFieldNames } from './parse-entries.js';
export {
  findSection,
  renderApplianceBlock,
  renderFieldLine,
  renderReheatSection,
  upsertReheatSection,
} from './render.js';
export type { RenderReheatOptions } from './render.js';
export { resolveAppliance, resolveReheating } from './resolve.js';
export type { ApplianceEntry, ReheatAppliance, ReheatInstruction, ReheatSource } from './types.js';
