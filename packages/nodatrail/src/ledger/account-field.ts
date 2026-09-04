/**
 * The chart of accounts as a dropdown.
 *
 * Three forms now ask which account something belongs to -- a hand posting, an
 * invoice, a payment being marked paid -- and they must offer the same list in
 * the same order, or the same account is called two things in two dialogs.
 */
import { accountLabel, type Account } from 'trail-core';
import { t } from '../lang/I18nManager';

/**
 * Options for an account dropdown, with a blank first entry.
 *
 * Blank is a real answer rather than a prompt: an invoice nobody has classified
 * yet is a normal state, and the ledger says so rather than picking an account
 * to avoid an empty box.
 */
export function accountChoices(
  accounts: readonly Account[],
  blankLabel = t('ledger.chooseAccount')
): [string, string][] {
  return [
    ['', blankLabel],
    ...accounts.map((account): [string, string] => [String(account.number), accountLabel(account)]),
  ];
}

/** Reads a dropdown value back as an account number. */
export function accountValue(raw: string): number | null {
  const number = Number(raw);
  return raw && Number.isFinite(number) ? number : null;
}
