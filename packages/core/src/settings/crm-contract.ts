/**
 * The CRM contract: the nine settings the three plugins have to agree on before
 * any of them can read another's Person and Company notes. It was seven until
 * the two roles properties joined, and several documents went on saying seven
 * afterwards; those were corrected in the September 2026 audit.
 *
 * Each plugin owns its own settings and each lets a vault rename any of these,
 * so this is not configuration. It is the set of DEFAULTS a fresh install of
 * each plugin has to ship, so that both plugins installed into one empty vault
 * find each other without anything being configured twice.
 *
 * Why it is a constant rather than a paragraph: the agreement used to live as
 * prose in the plugins' `CLAUDE.md` files, and it had already broken. `person`
 * and `company` in one of them, `Person` and `Organisation` in another, the
 * latter matching a vault casing that no longer exists on disk. Nothing raised
 * an error, because the failure mode of a type value that does not match is an
 * empty list.
 */

/** Every field the plugins have to spell identically. */
export interface CrmContract {
  /** The frontmatter key a note's kind is written under. */
  typePropertyName: string;
  personsFolder: string;
  companiesFolder: string;
  /** The `type:` value that marks a Person note. Compared against what is on disk, so casing counts. */
  personTypeValue: string;
  companyTypeValue: string;
  /** The frontmatter key holding a Person's tags, used to narrow who a plugin offers. */
  personTagProperty: string;
  companyTagProperty: string;
  /**
   * The frontmatter keys holding what a Person and a Company *are*: `meals`,
   * `hotel`, `vendor`, `customer`, whatever a vault decides.
   *
   * In the contract rather than in one plugin because the whole value of it is
   * that three plugins agree: CULItrail narrows its supplier dropdown to the
   * meal companies, APERtrail narrows its accommodation lists, NODAtrail knows
   * which companies send it invoices, and a company that is several of those
   * says so once. Two plugins spelling this key differently would give one
   * vault two answers about the same company.
   *
   * One key each for Person and Company, the same split the tag properties
   * take.
   */
  personRolesProperty: string;
  companyRolesProperty: string;
}

/**
 * The agreed defaults, frozen.
 *
 * Frozen rather than merely `as const` so a plugin that spreads this into its
 * own defaults object and then edits the copy is doing something visible, and a
 * plugin that tries to edit this one fails loudly in development.
 *
 * The folder names are the English defaults. Each plugin still resolves a
 * localized folder name at first run through its own defaults resolver, and
 * that is intended: the agreement is about the SHAPE, and two plugins in one
 * German vault resolve the same German name from the same key.
 */
export const CRM_CONTRACT: Readonly<CrmContract> = Object.freeze({
  typePropertyName: 'type',
  personsFolder: 'CRM/People',
  companiesFolder: 'CRM/Companies',
  personTypeValue: 'person',
  companyTypeValue: 'company',
  personTagProperty: 'tags',
  companyTagProperty: 'tags',
  personRolesProperty: 'roles',
  companyRolesProperty: 'roles',
});

/** Every contract key, for a caller that wants to iterate rather than name them. */
export const CRM_CONTRACT_KEYS = [
  'typePropertyName',
  'personsFolder',
  'companiesFolder',
  'personTypeValue',
  'companyTypeValue',
  'personTagProperty',
  'companyTagProperty',
  'personRolesProperty',
  'companyRolesProperty',
] as const satisfies readonly (keyof CrmContract)[];

/** One field a plugin's defaults spell differently from the contract. */
export interface CrmContractMismatch {
  key: keyof CrmContract;
  expected: string;
  actual: unknown;
}

/**
 * Every contract field the given defaults disagree with, in contract order.
 *
 * Built for a test in each plugin rather than for runtime: a plugin asserts
 * `crmContractMismatches(DEFAULT_SETTINGS)` is empty, and editing one of these
 * defaults then fails that plugin's own suite instead of silently emptying a
 * list in the other.
 *
 * A key the caller does not carry at all is reported as a mismatch with
 * `actual: undefined`, not skipped. The question this answers is what a fresh
 * install SHIPS, and a defaults object that dropped a key ships nothing for
 * it: a vault gets no value where it needs the agreed one. Passing over an
 * absent key would turn the one mistake that is hardest to see -- a key nobody
 * wrote -- into silence.
 *
 * Every contract key is checked, always. A plugin that holds only part of the
 * contract is not a case this makes room for: partial agreement is how the
 * halves drift apart again.
 */
export function crmContractMismatches(defaults: Partial<CrmContract>): CrmContractMismatch[] {
  const mismatches: CrmContractMismatch[] = [];

  for (const key of CRM_CONTRACT_KEYS) {
    const expected = CRM_CONTRACT[key];
    const actual = defaults[key];
    if (actual !== expected) mismatches.push({ key, expected, actual });
  }

  return mismatches;
}

/** A one-line report of what disagrees, for a test's failure message. */
export function describeCrmContractMismatches(mismatches: readonly CrmContractMismatch[]): string {
  return mismatches
    .map((m) => `${m.key}: expected ${JSON.stringify(m.expected)}, got ${JSON.stringify(m.actual)}`)
    .join('; ');
}
