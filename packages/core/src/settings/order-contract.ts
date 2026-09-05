/**
 * The order contract: the six settings NODAtrail has to spell exactly as
 * CULItrail does before it can read an order note CULItrail wrote.
 *
 * **Asymmetric, unlike the CRM contract beside it.** All three plugins read and
 * write Person and Company notes, so `CRM_CONTRACT` is an agreement between
 * equals. Orders have one author: CULItrail writes them and owns the format,
 * and NODAtrail reads four facts off them so a card statement can be matched
 * against a price that is already in the vault. So these values are CULItrail's
 * answers, and NODAtrail's copy of them is a guess that has to stay identical
 * to be worth anything.
 *
 * Why it is a constant rather than two lists of literals: it was two lists of
 * literals. `packages/culitrail/src/settings/defaults.ts` and
 * `packages/nodatrail/src/settings/defaults.ts` each spelled all six, and
 * nothing compared them. Renaming one on either side left both suites green,
 * because each plugin tests its own reader against a fixture it writes itself.
 * The failure reaches a person as a ledger that reads every order as unpriced,
 * months later, which is the expensive shape in this repository.
 *
 * The reason it is fixed now rather than when somebody notices: CULItrail is
 * moving to its own repository. In one tree this is a duplication a reader can
 * find. Across two trees under two licences it is a contract with no shared
 * type, no shared test, and no reason for either side to look at the other
 * before renaming something.
 *
 * As with the CRM contract, this is about DEFAULTS and not about configuration.
 * A vault renames any of these freely; what has to agree is what a fresh
 * install of each plugin ships.
 */

/** Every field the two plugins have to spell identically. */
export interface OrderContract {
  /** Where CULItrail files order notes. NODAtrail reads this folder and no other. */
  ordersFolder: string;
  /**
   * The `type:` value marking an order note, read under the CRM contract's
   * `typePropertyName`. Compared against what is on disk, so casing counts.
   */
  orderTypeValue: string;
  /** The frontmatter key naming the company an order came from. */
  orderCompanyProperty: string;
  /**
   * The frontmatter key holding the order's date.
   *
   * The date also appears in the filename stem, and NODAtrail prefers this
   * property when both are present, because a person can correct a property
   * and cannot easily correct a name. A key that does not match therefore does
   * not empty the list, it silently falls back to the filename, which is the
   * subtler half of why this is checked.
   */
  orderDateProperty: string;
  /** The frontmatter key holding what the order cost. */
  orderPriceProperty: string;
  /** The frontmatter key holding the currency that price is in. */
  orderPriceCurrencyProperty: string;
}

/**
 * The agreed defaults, frozen.
 *
 * Frozen for the reason `CRM_CONTRACT` is: a plugin spreading this into its own
 * defaults and then editing the copy is doing something a reader can see, and a
 * plugin editing this one fails loudly in development.
 *
 * `ordersFolder` is the English default. CULItrail still resolves a localized
 * folder name at first run through its own defaults resolver, and that stays
 * correct: NODAtrail adopts whatever the sibling actually persisted, and only
 * while its own value is still the shipped one. The agreement is about the
 * shape, not about the language a vault happens to be in.
 */
export const ORDER_CONTRACT: Readonly<OrderContract> = Object.freeze({
  ordersFolder: 'Eating/Orders',
  orderTypeValue: 'order',
  orderCompanyProperty: 'company',
  orderDateProperty: 'orderDate',
  orderPriceProperty: 'price',
  orderPriceCurrencyProperty: 'priceCurrency',
});

/** Every contract key, for a caller that wants to iterate rather than name them. */
export const ORDER_CONTRACT_KEYS = [
  'ordersFolder',
  'orderTypeValue',
  'orderCompanyProperty',
  'orderDateProperty',
  'orderPriceProperty',
  'orderPriceCurrencyProperty',
] as const satisfies readonly (keyof OrderContract)[];

/** One field a plugin's defaults spell differently from the contract. */
export interface OrderContractMismatch {
  key: keyof OrderContract;
  expected: string;
  actual: unknown;
}

/**
 * Every contract field the given defaults disagree with, in contract order.
 *
 * Built for a test in each plugin rather than for runtime, exactly as the CRM
 * equivalent is: each side asserts `orderContractMismatches(DEFAULT_SETTINGS)`
 * is empty, so a rename fails the suite of whichever repository made it instead
 * of quietly unpricing a ledger in the other.
 *
 * A key the caller does not carry at all is a mismatch with `actual:
 * undefined`, not a skip. A defaults object that dropped a key ships nothing
 * for it, and a key nobody wrote is the hardest kind to notice.
 */
export function orderContractMismatches(defaults: Partial<OrderContract>): OrderContractMismatch[] {
  const mismatches: OrderContractMismatch[] = [];

  for (const key of ORDER_CONTRACT_KEYS) {
    const expected = ORDER_CONTRACT[key];
    const actual = defaults[key];
    if (actual !== expected) mismatches.push({ key, expected, actual });
  }

  return mismatches;
}

/** A one-line report of what disagrees, for a test's failure message. */
export function describeOrderContractMismatches(
  mismatches: readonly OrderContractMismatch[]
): string {
  return mismatches
    .map((m) => `${m.key}: expected ${JSON.stringify(m.expected)}, got ${JSON.stringify(m.actual)}`)
    .join('; ');
}
