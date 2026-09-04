/**
 * What a company note says its paperwork usually looks like.
 *
 * A household buys from the same few dozen places, and the answer to "which
 * account, which category" is the same nearly every time: the insurer is always
 * insurance, the leasing company is always the leasing account. Answering it
 * once per invoice is the largest single piece of typing left in entering a
 * month, and it is typing that produces disagreements rather than information.
 *
 * **A default, not a rule.** Digitec is the case that shapes this: mostly
 * sundries, occasionally a camera. So a company's answer fills the form and the
 * form still decides -- somebody who changes the account afterwards has said
 * something more specific than the company knows, and nothing here argues.
 *
 * **Two properties on a note three plugins share.** The CRM contract governs
 * where company notes live and what identifies one, not what else a note may
 * carry, so an extra property is additive: the other plugins read the fields
 * they know and never see these. Nothing here writes a contract field.
 *
 * App-free, and clock-free.
 */
import { readNumberLike, readString } from '../frontmatter/read.js';

/** The two answers a company can supply, either of them absent. */
export interface CompanyDefaults {
  /** The expense account its invoices are usually booked to. */
  account: number | null;
  category: string | null;
}

export interface CompanyDefaultProperties {
  accountProperty: string;
  categoryProperty: string;
}

export function parseCompanyDefaults(
  frontmatter: Record<string, unknown>,
  properties: CompanyDefaultProperties
): CompanyDefaults {
  return {
    account: readNumberLike(frontmatter[properties.accountProperty]),
    category: readString(frontmatter[properties.categoryProperty]),
  };
}

/** True when a company has nothing to offer, so a caller can skip it. */
export function hasCompanyDefaults(defaults: CompanyDefaults): boolean {
  return defaults.account !== null || defaults.category !== null;
}

/**
 * A form filled in from the company it names.
 *
 * The same rule as `inheritFromRecurring`, and for the same reason: fill what
 * the source states, leave alone what it does not. A company with no category
 * is a company nobody has classified, which is a different fact from "this
 * invoice has no category" and not the company's to assert.
 *
 * It does overwrite an answer already on the form, which is the right reading
 * of the only way this runs: somebody has just chosen a company, and the
 * defaults of the company they chose are what they asked for.
 */
export function inheritFromCompany<T extends CompanyDefaults>(
  current: T,
  company: CompanyDefaults
): T {
  return {
    ...current,
    account: company.account ?? current.account,
    category: company.category ?? current.category,
  };
}

/**
 * What a company would have to learn for the form in front of somebody to be
 * its default, or null when it already agrees.
 *
 * Null rather than an unchanged copy, so a caller can offer to remember only
 * when there is something to remember. An account or category cleared on the
 * form is not a correction to the company: blanking a field on one invoice says
 * nothing about the next one.
 */
export function companyDefaultsToLearn(
  stored: CompanyDefaults,
  onForm: CompanyDefaults
): CompanyDefaults | null {
  const account = onForm.account ?? stored.account;
  const category = onForm.category ?? stored.category;
  if (account === stored.account && category === stored.category) return null;
  return { account, category };
}
