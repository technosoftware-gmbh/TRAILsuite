/**
 * CULItrail's settings, mapped onto the shared CRM note format, plus the
 * company terms only this plugin reads.
 *
 * The format itself is `trail-core`'s: which property holds a kind's tags, how
 * a note's fields read, and that a blank type value matches nothing. Two
 * plugins read these notes, and one implementation of that reading is the point
 * of the core.
 *
 * What stays here is what the core must not know. One is the shape of this
 * plugin's settings object. The other is `company-terms.ts`: what a company
 * charges is a purchasing vocabulary rather than part of what a CRM note is,
 * and it has one reader, so by the promotion rule it stays until it has two.
 */
import {
  crmTagProperty,
  crmTypeValue,
  parseCrmNote,
  type CrmKind,
  type CrmPropertyNames as CoreCrmPropertyNames,
} from 'trail-core';
import type { CULItrailSettings } from '../settings/types';
import {
  emptyCompanyTerms,
  readCompanyTerms,
  type CompanyTerms,
  type CompanyTermsProperties,
} from './company-terms';

// Re-exported rather than re-implemented: a caller asking which property holds
// a company's tags should not have to know whether the answer lives here or in
// the core, and there must never be a second answer.
export { crmTagProperty, crmTypeValue };
export type { CrmKind };

/** The shared names, plus the company-terms names this plugin adds to them. */
export interface CrmPropertyNames extends CoreCrmPropertyNames {
  /** Only read for a Company. A Person has no terms, so the parser never asks. */
  companyTerms: CompanyTermsProperties;
}

export function crmPropertyNames(settings: CULItrailSettings): CrmPropertyNames {
  return {
    // Falling back to the literal here rather than letting a blank through:
    // unlike a type VALUE, where blank meaningfully means "match nothing", a
    // blank property NAME is never a deliberate choice, it is a cleared field.
    typePropertyName: settings.typePropertyName.trim() || 'type',
    personTypeValue: settings.personTypeValue.trim(),
    companyTypeValue: settings.companyTypeValue.trim(),
    personTagProperty: settings.personTagProperty.trim() || 'tags',
    companyTagProperty: settings.companyTagProperty.trim() || 'tags',
    personRolesProperty: settings.personRolesProperty.trim(),
    companyRolesProperty: settings.companyRolesProperty.trim(),
    // No contact-field names: CULItrail displays no address, email or phone,
    // so it reads none, and the core reads only what it is given a name for.
    companyTerms: {
      currency: settings.companyCurrencyProperty.trim(),
      paymentMethod: settings.companyPaymentMethodProperty.trim(),
      invoiceTiming: settings.companyInvoiceTimingProperty.trim(),
      shippingFee: settings.companyShippingFeeProperty.trim(),
      freeShippingFrom: settings.companyFreeShippingFromProperty.trim(),
      discountTable: settings.companyDiscountTableProperty.trim(),
      lines: settings.companyLinesProperty.trim(),
    },
  };
}

/**
 * The fields a CRM note contributes, minus the file and title the caller
 * already holds.
 *
 * `terms` is present for both kinds and empty for a Person, rather than the
 * type being a union of two shapes: `read-crm.ts` reads both kinds through one
 * generic function, and a union would make that function the one place in the
 * module that has to know which kind it is holding.
 */
export interface ParsedCrmRecord {
  tags: string[];
  /** What a company is, from the shared property. Empty for a Person and for a company that has not said. */
  roles: string[];
  terms: CompanyTerms;
}

export function parseCrmRecord(
  frontmatter: Record<string, unknown>,
  properties: CrmPropertyNames,
  kind: CrmKind
): ParsedCrmRecord {
  const shared = parseCrmNote(frontmatter, properties, kind);
  return {
    tags: shared.tags,
    roles: kind === 'company' ? shared.roles : [],
    terms:
      kind === 'company'
        ? readCompanyTerms(frontmatter, properties.companyTerms)
        : emptyCompanyTerms(),
  };
}
