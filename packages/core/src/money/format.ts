/**
 * Money: rounding it, and putting it on screen.
 *
 * Here rather than in a plugin on the two-consumer test, and the condition was
 * set by the code that moved: APERtrail's `shared/money.ts` said in its own
 * header that the three lines of `roundCents` were duplicated here privately as
 * `order/total.ts`'s `toCents`, and that "if a third consumer appears, it moves
 * to the core and both call it". NODAtrail is the third consumer, so this is
 * that move.
 *
 * Two decimals always. `17.5` is a quantity; `17.50` is money.
 *
 * App-free.
 */

/**
 * Money, to the cent.
 *
 * Floating-point addition over a handful of two-decimal figures lands on
 * 89.40000000000001, and a total is money rather than a measurement.
 */
export function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * A figure with its currency, in the reader's own conventions.
 *
 * The locale decides where the code goes and how the digits are grouped: an
 * English vault reads `CHF 1,309.98`, a German one `1.309,98 CHF`, and a Swiss
 * one `CHF 1'309.98`. That last is why the locale is a parameter rather than
 * the machine's own setting. A Swiss household running a Mac set to German
 * reads its own money in a convention it does not use, and the thousands
 * separator is not a detail: `1.309,98` and `1'309.98` are the same number
 * written by two conventions that disagree about what a dot means.
 *
 * The code travels with the figure rather than being configured once, because
 * a purchase, a bill and a trip are all multi-currency by construction, and a
 * figure that has lost its code is a figure that will be added to the wrong
 * total eventually.
 *
 * An unknown or malformed code is not a reason to render nothing: `Intl` throws
 * on a currency it does not recognize, and a vault that typed `CH` still
 * deserves to see its number. The fallback is the code and the figure side by
 * side, which is what a receipt looks like anyway.
 */
export function formatMoney(amount: number, currency: string | null, locale?: string): string {
  const code = currency?.trim().toUpperCase() ?? '';
  const figure = amount.toFixed(2);
  if (!code) return figure;

  try {
    return spaceBeforeSign(
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    );
  } catch {
    return `${code} ${figure}`;
  }
}

/**
 * Keeps the currency code away from a minus sign.
 *
 * Swiss German renders 5000 as `CHF 5'000.00` and -122.70 as `CHF-122.70`,
 * with no space in the negative case. That is what the locale data says, and it
 * is unreadable in a column: the figures no longer start at the same place, and
 * the minus reads as part of the code. Down a statement of thirty rows it is
 * the difference between scanning and squinting.
 *
 * Only a separator is added, and only where the code runs straight into the
 * sign. Locales that put the code last, or that already space it, come back
 * untouched.
 */
function spaceBeforeSign(rendered: string): string {
  return rendered.replace(/^(\p{L}+)(-|\u2212)/u, '$1 $2');
}

/**
 * The same, for a figure that may be absent.
 *
 * Null renders as nothing rather than as `0.00`: unpriced and free are
 * different facts, and a view that showed them the same way would report a
 * budget as met when nobody had priced it.
 */
export function formatMoneyOrNull(
  amount: number | null,
  currency: string | null,
  locale?: string
): string | null {
  return amount === null || !Number.isFinite(amount) ? null : formatMoney(amount, currency, locale);
}

/**
 * ISO codes are upper case, and a vault that typed `chf` meant CHF.
 *
 * Never translated, and never written back into the note: normalising for
 * comparison is not the same as correcting somebody's file.
 */
export function normalizeCurrency(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

/**
 * Sums figures that share a currency, keyed by that currency.
 *
 * **Currencies are never summed together.** A total is per currency, always,
 * and a caller wanting one number has to state a rate and say so. Nothing in
 * this suite fetches a rate, ever.
 *
 * An entry with no amount contributes nothing and does not create a bucket, so
 * a list of entirely unpriced lines returns an empty map rather than a set of
 * zeroes. Zero is a line that was genuinely free.
 */
export function sumByCurrency(
  entries: readonly { amount: number | null; currency: string | null }[],
  fallbackCurrency: string | null = null
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    if (entry.amount === null || !Number.isFinite(entry.amount)) continue;

    const code = normalizeCurrency(entry.currency) ?? normalizeCurrency(fallbackCurrency) ?? '';
    totals.set(code, roundCents((totals.get(code) ?? 0) + entry.amount));
  }

  return totals;
}
