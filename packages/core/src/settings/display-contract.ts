/**
 * The display contract: the one setting the three plugins agree on so that a
 * vault reads its numbers and dates in one convention rather than three.
 *
 * **Language and formatting are two different questions, and the plugins had
 * only ever asked the first.** `I18nManager` follows Obsidian's interface
 * language, which is right: somebody who has told Obsidian they read German
 * should not have to say it twice. But a formatting convention is a fact about
 * a *place*, not a language. A Swiss household running a Mac set to German is
 * shown `1.309,98 CHF` by every German locale on earth and writes
 * `CHF 1'309.98` itself. The two conventions disagree about what a dot means,
 * which is the one disagreement about a number that actually matters.
 *
 * `money/format.ts` has said this since it was written, and took a `locale`
 * parameter for exactly this reason. Nothing ever passed one. The parameter,
 * the reasoning and the fallback were all correct and all unreachable, which is
 * this codebase's most frequent defect and the reason for the contract here:
 * a value with nowhere to come from does not get passed.
 *
 * **Blank means the machine's own**, which is what every call site did before
 * this existed. So a vault that never opens the setting sees exactly what it
 * saw, and the change is available rather than imposed.
 *
 * Like `CRM_CONTRACT`, this is not configuration. Each plugin owns a real
 * setting a vault can change; this is only the default all three ship, so one
 * vault does not have to be told three times.
 */

export interface DisplayContract {
  /**
   * A BCP 47 tag such as `de-CH`, or blank for the runtime's own.
   *
   * Deliberately not validated against a list. `Intl` accepts far more than any
   * list this could carry, it is the authority on what it accepts, and a tag it
   * rejects falls back rather than throwing -- so a typo costs a reader the
   * convention they wanted and never costs them the figure.
   */
  displayLocale: string;
}

export const DISPLAY_CONTRACT: Readonly<DisplayContract> = Object.freeze({
  displayLocale: '',
});

export const DISPLAY_CONTRACT_KEYS: readonly (keyof DisplayContract)[] = ['displayLocale'];

/**
 * A setting as `Intl` wants it: a tag, or `undefined` for the runtime's own.
 *
 * The whole reason this exists is that `''` and `undefined` mean the same thing
 * to a reader and opposite things to `Intl`: passing the empty string throws a
 * RangeError, where passing undefined is the default every call site already
 * relied on. One function so that no call site has to remember which.
 */
export function displayLocale(setting: string | null | undefined): string | undefined {
  const tag = setting?.trim();
  return tag ? tag : undefined;
}
