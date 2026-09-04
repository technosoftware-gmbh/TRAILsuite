/**
 * Which currency a meal's price is in.
 *
 * **A chain, not a setting.** The meal's own property wins, then its supplier's,
 * then the vault-wide default. That order is the useful one: a company bills in
 * one currency and states it once on its own note, so a hundred and twenty-seven
 * meal notes do not each have to repeat it, and the one dish bought abroad can
 * still say so for itself.
 *
 * A separate file rather than a line inside the formatter, because every view
 * that shows a price has to resolve it the same way and two of them resolving it
 * differently is a bug nobody would see: both would render a plausible number
 * with a plausible symbol.
 *
 * App-free.
 */
import type { CompanyTerms } from '../../crm/company-terms';
import type { CULItrailSettings } from '../../settings/types';

/** What the caller already knows about the supplier. Null when there is none. */
export type CurrencySource = Pick<CompanyTerms, 'currency'> | null;

export function currencyFor(
  meal: { priceCurrency: string | null },
  supplier: CurrencySource,
  settings: CULItrailSettings
): string {
  return (
    meal.priceCurrency?.trim() || supplier?.currency?.trim() || settings.orderDefaultCurrency.trim()
  );
}
