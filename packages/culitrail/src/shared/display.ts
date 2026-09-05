/**
 * The vault's display locale, and the formatters bound to it.
 *
 * The same arrangement APERtrail and NODAtrail use, and the same reason: a
 * formatting convention is a fact about a place rather than about a language,
 * so it cannot come from `I18nManager`, and `Intl`'s own default is the
 * machine's, which is what was wrong. `settings/store.ts` publishes it on load
 * and on save; until it does, everything here behaves exactly as it did.
 *
 * Small, because this plugin formats less money and fewer dates than the other
 * two. It is here rather than skipped so that a vault sets the convention once
 * and all three obey it, which is the whole point of the shared contract.
 */
import { displayLocale } from '@technosoftware/trail-core';

let active: string | undefined;

export function setDisplayLocale(setting: string): void {
  active = displayLocale(setting);
}

/** Undefined means the runtime's own, which is what every call site did before. */
export function activeDisplayLocale(): string | undefined {
  return active;
}
