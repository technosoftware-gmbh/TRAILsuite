/**
 * The two CRM entity types and where each one is read from.
 *
 * Kept apart from vault/entity-types.ts's TRAVEL_ENTITY_TYPES for a reason
 * that matters at every call site: a travel type value is a fixed literal
 * (`type: landmark`), while a CRM type value is a setting
 * (`personTypeValue`, `companyTypeValue`). CRM reading and writing both
 * resolve the value through settings, never a literal, which is what lets
 * these folders stay folders the vault already owned and already spells its
 * own way.
 */
import type { APERtrailSettings } from '../settings/types';

export const CRM_ENTITY_TYPES = ['person', 'company'] as const;

export type CrmEntityType = (typeof CRM_ENTITY_TYPES)[number];

/** Which folder setting each CRM type reads and writes notes in. */
export const CRM_FOLDER_SETTING: Record<CrmEntityType, keyof APERtrailSettings> = {
  person: 'personsFolder',
  company: 'companiesFolder',
};

/** Which setting holds the `type:` value that marks a note as this CRM type. */
export const CRM_TYPE_VALUE_SETTING: Record<CrmEntityType, keyof APERtrailSettings> = {
  person: 'personTypeValue',
  company: 'companyTypeValue',
};

/** Which setting names the frontmatter property holding this type's tags. Person and Company get one each rather than sharing, so neither setting's name has to lie about what it covers. */
export const CRM_TAG_PROPERTY_SETTING: Record<CrmEntityType, keyof APERtrailSettings> = {
  person: 'personTagProperty',
  company: 'companyTagProperty',
};
