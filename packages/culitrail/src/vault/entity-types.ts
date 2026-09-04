/**
 * The six kinds of note CULItrail reads, and where each one comes from.
 *
 * Every kind is identified by **folder AND type together**, and every one of
 * those type values is a setting rather than a literal.
 *
 * That last part is where CULItrail deliberately differs from APERtrail, whose
 * nine travel types carry fixed literals (`type: landmark`) and whose two CRM
 * types carry settings. The asymmetry there is earned: APERtrail invented its
 * travel folders, so it gets to name their type values, while the CRM folders
 * are ones a vault already had. CULItrail has no folder it can make that claim
 * about. Meals, orders, deliveries, plans, people and companies all live in
 * folders a vault typically already owns, spelled its own way, so all six
 * resolve through settings and none is ever compared against a literal.
 */
import type { CULItrailSettings } from '../settings/types';

export const CULI_ENTITY_TYPES = [
  'meal',
  'order',
  'delivery',
  'mealPlan',
  'person',
  'company',
] as const;

export type CuliEntityType = (typeof CULI_ENTITY_TYPES)[number];

/** Which folder setting each kind reads its notes from. */
export const FOLDER_SETTING: Record<CuliEntityType, keyof CULItrailSettings> = {
  meal: 'mealsFolder',
  order: 'ordersFolder',
  delivery: 'deliveriesFolder',
  // The plans folder, not `mealPlanPath`. The template names one week's note
  // and the folder holds every week there has ever been, which is the question
  // a kind is asked.
  mealPlan: 'mealPlansFolder',
  person: 'personsFolder',
  company: 'companiesFolder',
};

/** Which setting holds the `type:` value that marks a note as this kind. */
export const TYPE_VALUE_SETTING: Record<CuliEntityType, keyof CULItrailSettings> = {
  meal: 'mealTypeValue',
  order: 'orderTypeValue',
  delivery: 'deliveryTypeValue',
  mealPlan: 'mealPlanTypeValue',
  person: 'personTypeValue',
  company: 'companyTypeValue',
};

/**
 * The folders a kind is read from.
 *
 * Only meals have more than one. `additionalMealFolders` exists for a
 * vault whose meals are spread across several places, and it is read-only
 * scope: new meals are always written into `mealsFolder`, which is why
 * that one is the module root and the extras are a separate setting rather
 * than the root being an array.
 */
export function foldersFor(settings: CULItrailSettings, kind: CuliEntityType): string[] {
  const root = (settings[FOLDER_SETTING[kind]] as string) ?? '';
  if (kind !== 'meal') return [root];
  return [root, ...settings.additionalMealFolders];
}

/** The configured `type:` value for a kind, trimmed. Blank means the vault has cleared it, which matches nothing. */
export function typeValueFor(settings: CULItrailSettings, kind: CuliEntityType): string {
  return ((settings[TYPE_VALUE_SETTING[kind]] as string) ?? '').trim();
}
