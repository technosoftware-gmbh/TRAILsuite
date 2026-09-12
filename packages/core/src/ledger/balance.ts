/**
 * What an account holds, and what moved through it.
 *
 * **Balances are computed, never stored.** Every reader sums the postings on top
 * of the account's opening balance, and nothing is ever written back into an
 * account note. A decade of a household is on the order of thirty thousand
 * lines, which is nothing to sum, and in exchange a posting corrected three
 * years later corrects every balance that depends on it at once. There is
 * nothing to rebuild and nothing that can be stale.
 *
 * App-free, and clock-free.
 */
import { roundCents } from '../money/format.js';
import { increasesOnDebit, type Account, type Posting } from './types.js';

/**
 * The figure a posting contributes in one account's own currency.
 *
 * A posting between two currencies carries both figures and the rate that was
 * actually used. Each side takes the figure written in its own currency, which
 * is the only reading that leaves both balances right.
 */
export function amountFor(posting: Posting, account: Account): number {
  return takesCounter(posting, account)
    ? (posting.counterAmount ?? posting.amount)
    : posting.amount;
}

/**
 * Which side of a converted posting an account reads.
 *
 * The one place the choice is made, so `amountFor` and `currencyFor` cannot
 * disagree about it. Two functions each testing the same four conditions is two
 * functions that eventually test three of them.
 */
function takesCounter(posting: Posting, account: Account): boolean {
  return (
    account.currency !== null &&
    posting.counterCurrency !== null &&
    posting.counterAmount !== null &&
    account.currency === posting.counterCurrency
  );
}

/**
 * The currency the figure this account takes is written in.
 *
 * Null when the posting names no currency, which the format allows and every
 * reader treats as the home currency. Knowing this is what makes it possible to
 * ask whether a posting says what its accounts say: a franc figure written
 * against a euro cash box takes euros off it.
 */
export function currencyFor(posting: Posting, account: Account): string | null {
  return takesCounter(posting, account) ? posting.counterCurrency : posting.currency;
}

/** A posting whose figure for one account is written in another currency. */
export interface CurrencyMismatch {
  posting: Posting;
  account: Account;
  /** The currency the figure is written in, which is not the account's. */
  written: string;
}

/**
 * Every posting that moves a figure in the wrong currency.
 *
 * A posting between two currencies carries both figures, and each account takes
 * the one written in its own. A posting that carries only one figure and names
 * two accounts in different currencies therefore moves that figure through both
 * of them, and one of the two balances is wrong by the whole exchange rate.
 *
 * The remedy is always to write both figures. Reported rather than corrected,
 * because only the person who spent the money knows which of the two amounts is
 * the one they actually paid.
 *
 * A posting naming no currency at all is left alone: the format allows a bare
 * figure and every reader takes it as the home currency, so flagging those would
 * report a whole vault of postings that are written the way the format intends.
 */
export function currencyMismatches(
  accounts: readonly Account[],
  postings: readonly Posting[]
): CurrencyMismatch[] {
  const byNumber = new Map(accounts.map((account) => [account.number, account]));
  const found: CurrencyMismatch[] = [];

  for (const posting of postings) {
    if (!posting.currency) continue;
    for (const number of [posting.debit, posting.credit]) {
      if (number === null) continue;
      const account = byNumber.get(number);
      if (!account?.currency) continue;
      // Both sides of a posting naming one account move nothing, so neither
      // side can be in the wrong currency.
      if (posting.debit === posting.credit) continue;

      const written = currencyFor(posting, account);
      if (written && written !== account.currency) found.push({ posting, account, written });
    }
  }

  return found;
}

/** What one posting does to one account's balance: positive, negative, or nothing. */
export function effectOn(posting: Posting, account: Account): number {
  const touchesDebit = posting.debit === account.number;
  const touchesCredit = posting.credit === account.number;
  if (!touchesDebit && !touchesCredit) return 0;
  // A posting naming the same account on both sides moves nothing, which is
  // what falls out of adding the two effects rather than a special case.
  if (touchesDebit && touchesCredit) return 0;

  const figure = amountFor(posting, account);
  const grows = increasesOnDebit(account.kind) === touchesDebit;
  return grows ? figure : -figure;
}

/** The postings that touch an account, in date then line order. */
export function postingsFor(postings: readonly Posting[], account: Account): Posting[] {
  return postings
    .filter((posting) => posting.debit === account.number || posting.credit === account.number)
    .sort(byDateThenLine);
}

/**
 * The balance on a day, inclusive.
 *
 * `on` is an ISO day rather than a Date because a balance is a fact about a
 * calendar day and comparing the strings is both exact and free. Null means
 * every posting there is.
 *
 * **The opening date does not filter.** A posting dated before the opening
 * balance still counts, because a person who back-dated one meant it to. The
 * opening date is what a report shows to say how far back the figures go.
 */
export function balanceAt(
  postings: readonly Posting[],
  account: Account,
  on: string | null = null
): number {
  let total = account.opening;
  for (const posting of postings) {
    if (on !== null && posting.date > on) continue;
    total += effectOn(posting, account);
  }
  return roundCents(total);
}

/** What moved through an account between two days, inclusive, ignoring its opening balance. */
export function movementBetween(
  postings: readonly Posting[],
  account: Account,
  from: string,
  to: string
): number {
  let total = 0;
  for (const posting of postings) {
    if (posting.date < from || posting.date > to) continue;
    total += effectOn(posting, account);
  }
  return roundCents(total);
}

/** One line of an account statement, as the ledger produces it from its own postings. */
export interface StatementRow {
  posting: Posting;
  /** What it did to this account, signed. */
  change: number;
  /** The balance after it. */
  balance: number;
  /** The other account, for showing where the money went. */
  other: number | null;
}

/**
 * An account's postings with a running balance, which is what gets held up
 * against a bank statement.
 *
 * The comparison this makes possible is the one piece of discipline the design
 * cannot remove: double entry proves the books agree with themselves, and only
 * a bank statement proves they agree with the bank.
 */
export function statement(
  postings: readonly Posting[],
  account: Account,
  from: string | null = null,
  to: string | null = null
): StatementRow[] {
  const touching = postingsFor(postings, account);
  const rows: StatementRow[] = [];

  let balance = account.opening;
  for (const posting of touching) {
    const change = effectOn(posting, account);
    balance = roundCents(balance + change);

    if (from !== null && posting.date < from) continue;
    if (to !== null && posting.date > to) continue;

    rows.push({
      posting,
      change,
      balance,
      other: posting.debit === account.number ? posting.credit : posting.debit,
    });
  }

  return rows;
}

/** Every account's balance on a day, by account number. */
export function balances(
  postings: readonly Posting[],
  accounts: readonly Account[],
  on: string | null = null
): Map<number, number> {
  const result = new Map<number, number>();
  for (const account of accounts) result.set(account.number, balanceAt(postings, account, on));
  return result;
}

/**
 * Postings naming an account number no account note claims.
 *
 * Not an error at parse time, because the journal is read without the chart in
 * hand and a posting to an account somebody has not created yet is a thing to
 * be told about rather than a thing to lose.
 */
export function unknownAccounts(
  postings: readonly Posting[],
  known: ReadonlySet<number>
): { posting: Posting; number: number }[] {
  const found: { posting: Posting; number: number }[] = [];
  for (const posting of postings) {
    for (const number of [posting.debit, posting.credit]) {
      if (number !== null && !known.has(number)) found.push({ posting, number });
    }
  }
  return found;
}

function byDateThenLine(a: Posting, b: Posting): number {
  return a.date === b.date ? a.line - b.line : a.date < b.date ? -1 : 1;
}

/**
 * Postings that name one account on both sides.
 *
 * `effectOn` returns zero for these, deliberately and correctly: a movement
 * from an account to itself moves nothing. What makes them worth reporting is
 * that nothing else notices. The line parses, the entry is balanced, every
 * total is unaffected and the books still close -- so a payment written this
 * way simply never happened, and the only symptom is a balance that disagrees
 * with the bank.
 *
 * Found in a real vault, where an over-broad import rule pointed four rows at
 * the account they were being imported into.
 */
export function selfPostings(postings: readonly Posting[]): Posting[] {
  return postings.filter((posting) => posting.debit !== null && posting.debit === posting.credit);
}
