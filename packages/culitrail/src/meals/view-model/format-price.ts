/**
 * A dish price, as text.
 *
 * Two decimal places always, because a price with one reads as a number that
 * lost a digit: `17.5` is a quantity, `17.50` is money. The currency comes from
 * one setting rather than from the note, so it is passed in rather than looked
 * up here.
 *
 * **Through the core formatter rather than a hand-built string.** It used to
 * concatenate the code, a space and `toFixed(2)`, which grouped no thousands at
 * all: a dish rarely costs four figures, so nobody noticed, and a supplier
 * order total does and would have printed `CHF 1234.50`. The core formatter
 * groups, orders the code the way the reader's convention does, and takes the
 * vault's display locale, so a price and a trip's costs are drawn the same way.
 *
 * A blank currency still prints: `formatMoneyOrNull` falls back to the bare
 * figure, which is what this did too, and a price with no code is still a
 * price.
 */
import { formatMoneyOrNull } from '@technosoftware/trail-core';
import { activeDisplayLocale } from '../../shared/display';

/**
 * `null` for a price the note does not state, so a caller renders nothing
 * rather than `0.00`.
 *
 * **Zero is a real price and is formatted like any other.** A replacement meal
 * sent free is a line worth recording, and it is not the same information as a
 * dish nobody has priced. Same distinction `eatingRecordEntry` already draws for a
 * rating of 0.
 */
export function formatPrice(amount: number | null, currency: string): string | null {
  return formatMoneyOrNull(amount, currency, activeDisplayLocale());
}
