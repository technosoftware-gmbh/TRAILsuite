/**
 * Which currencies a dropdown offers.
 *
 * A short configured list rather than the 180 ISO codes: a vault spends in
 * two or three currencies, and picking one from three beats typing three
 * letters right every time. The list is a setting because whose three they
 * are is nobody's business but the vault owner's.
 *
 * Two rules keep the list honest. The home currency is always offered, since
 * a vault that plans in a currency it left off the list would otherwise be
 * unable to pick it. And a value already written into a note is always
 * offered, so opening an editor on a booking in ZAR and saving it cannot
 * silently rewrite the currency to something else. That second rule is the
 * one the transport leg's mode dropdown already follows, for the same
 * reason.
 *
 * Pure: takes the two settings it needs rather than the whole object, so it
 * can be tested without one.
 */

/** The list as typed in settings: comma or space separated, in the order the vault wants them offered. */
export function parseCurrencyOptions(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((code) => code.trim().toUpperCase())
    .filter((code) => code !== '');
}

export interface CurrencyChoiceInput {
  /** The `currencyOptions` setting, as typed. */
  configured: string;
  homeCurrency: string;
  /** What the field currently holds, which may predate the list or have been typed by hand. */
  current?: string | null;
}

export function currencyChoices(input: CurrencyChoiceInput): string[] {
  const seen = new Set<string>();
  const choices: string[] = [];

  const add = (code: string | null | undefined): void => {
    const value = code?.trim().toUpperCase();
    if (!value || seen.has(value)) return;
    seen.add(value);
    choices.push(value);
  };

  for (const code of parseCurrencyOptions(input.configured)) add(code);
  add(input.homeCurrency);
  add(input.current);

  return choices;
}
