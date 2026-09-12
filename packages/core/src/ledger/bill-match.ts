/**
 * Which invoice a statement row pays.
 *
 * A household enters an invoice when it arrives and imports the bank statement
 * weeks later. Both describe the same payment, and if each writes its own
 * posting the ledger counts it twice. So one of them has to recognise the
 * other, and the statement is the one that knows the payment actually happened.
 * A row that settles a bill takes the bill's account, and the bill is stamped
 * paid. Nobody types it twice, and nothing is posted twice.
 *
 * **The bank's reference is useless for this.** The obvious idea is to match on
 * the invoice number, and the file makes it look possible: every row of the
 * real statement this was written against carries `Ref.-Nr. 1563958107`. That
 * is the bank's own transaction number, issued by the bank, and it has nothing
 * to do with the number the insurer printed on the invoice. Matching on it
 * would find nothing, on every row, forever.
 *
 * What is left is the amount and the vendor's name in the text, which is what a
 * person uses when they do this by hand. The amount is exact, so it does almost
 * all the work: the real file has two `MUSTERVERSICHERUNG AG` rows on one day,
 * 750.95 and 2.10, and the amount alone tells them apart.
 *
 * **Ambiguity is reported, never resolved quietly.** Two identical unpaid bills
 * from one vendor is exactly what a monthly subscription looks like, and
 * picking one silently would be right half the time.
 *
 * App-free, and clock-free.
 */
import type { BillLine } from '../expense/bill.js';
import { roundCents } from '../money/format.js';
import type { BankStatementRow } from './statement.js';
import type { Posting } from './types.js';

/** The little a bill has to say for a row to be recognised as paying it. */
export interface BillForMatching {
  /** How the bill is named, for showing which one was matched. */
  title: string;
  companyTitle: string | null;
  amount: number | null;
  currency: string | null;
  /** Where the invoice is booked. Null is allowed: the match still holds, and the account is what a person then supplies. */
  account: number | null;
  /**
   * The accounts the invoice divides across, when one is not enough.
   *
   * An invoice that carries these has already answered the question the import
   * would otherwise have to ask, so the row is posted as a split rather than
   * handed to somebody with a total and no breakdown.
   */
  lines: BillLine[];
  issueDate: string | null;
  dueDate: string | null;
  paidDate: string | null;
  /** The account the money left, once something has settled this bill. */
  paidFrom: number | null;
}

export interface BillMatch {
  bill: BillForMatching;
  /**
   * The bills this row fits equally well, when more than one does. Empty on a
   * clean match. A caller shows these rather than pretending the first is right.
   */
  alsoFits: BillForMatching[];
}

/**
 * Words that are a company's legal form or a country, not its name.
 *
 * Excluded so a token match means something. `SWISSCOM (SCHWEIZ) AG` shares
 * `AG` with half the vendors in Switzerland and `SCHWEIZ` with a good number of
 * the rest; only `SWISSCOM` identifies anybody.
 */
const NOT_A_NAME = new Set([
  'ag',
  'sa',
  'sarl',
  'gmbh',
  'kg',
  'ohg',
  'se',
  'bv',
  'nv',
  'ltd',
  'inc',
  'plc',
  'llc',
  'co',
  'und',
  'and',
  'der',
  'die',
  'das',
  'the',
  'von',
  'fur',
  'für',
  'schweiz',
  'suisse',
  'svizzera',
  'switzerland',
]);

/** Splits on anything that is not a letter or a digit, so `SWISSCOM (SCHWEIZ)` yields two words. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3 && !NOT_A_NAME.has(word));
}

/**
 * True when a row's text names this company.
 *
 * One shared word is enough, because the amount has already had to match to the
 * cent. Requiring the whole name would fail on `SWISSCOM (SCHWEIZ) AG` against a
 * note called `Swisscom`, which is what a person calls it.
 */
export function mentionsCompany(text: string, company: string): boolean {
  const named = new Set(words(company));
  if (named.size === 0) return false;
  return words(text).some((word) => named.has(word));
}

export interface BillMatchOptions {
  /**
   * How many days before a bill's issue date a payment may be dated.
   *
   * Not zero: a bank books on the day the money moves and an invoice is dated
   * when it was written, and the two cross over a weekend often enough. Wide
   * enough to forgive that, narrow enough that a payment cannot settle an
   * invoice that had not been sent.
   */
  issueSlack?: number;
  /**
   * Companies that stand between a merchant and the bank.
   *
   * Klarna, PayPal, a card scheme's acquirer. The row says `KLARNA BANK AB` and
   * the invoice says `ZOOPLUS`, because a shop can change who collects its
   * money without telling anybody, and the day it does every one of its
   * invoices stops matching. There is nothing shared to match on: no reference,
   * no name, only the figure.
   *
   * So a row naming one of these is matched on the amount alone. That is a
   * weaker claim, and it is why the ambiguity this can produce is reported
   * rather than resolved: two unpaid invoices of the same amount behind one
   * provider is exactly what `alsoFits` is for.
   */
  paymentProviders?: readonly string[];
}

/**
 * The bill a row pays, or null.
 *
 * Only money leaving the account is considered. A credit is a refund or income,
 * and an invoice is not settled by money arriving.
 */
export function matchBillForRow(
  row: BankStatementRow,
  bills: readonly BillForMatching[],
  options: BillMatchOptions = {}
): BillMatch | null {
  if (row.amount >= 0) return null;
  const paid = roundCents(-row.amount);
  const slack = options.issueSlack ?? 5;
  const text = `${row.text} ${row.rawText}`;

  // A row collected by a payment provider carries the provider's name and not
  // the merchant's, so the name on it says nothing about which invoice this is.
  // Dropping the name check is the whole of the accommodation: the amount, the
  // currency and the date still have to agree.
  const viaProvider = (options.paymentProviders ?? []).some((provider) =>
    mentionsCompany(text, provider)
  );

  const fits = bills.filter((bill) => {
    if (bill.paidDate) return false;
    if (bill.amount === null || roundCents(bill.amount) !== paid) return false;
    if (bill.currency && row.currency && bill.currency !== row.currency) return false;
    if (!viaProvider && (!bill.companyTitle || !mentionsCompany(text, bill.companyTitle))) {
      return false;
    }
    return notBefore(row.date, bill.issueDate, slack);
  });

  const [best, ...rest] = [...fits].sort(compareBills);
  return best ? { bill: best, alsoFits: rest } : null;
}

/**
 * Oldest first: due date, then issue date, then title so the order never
 * depends on what the vault happened to hand over.
 */
function compareBills(a: BillForMatching, b: BillForMatching): number {
  const byDue = (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
  if (byDue !== 0) return byDue;
  const byIssue = (a.issueDate ?? '9999').localeCompare(b.issueDate ?? '9999');
  return byIssue !== 0 ? byIssue : a.title.localeCompare(b.title);
}

/** True when the payment is not dated meaningfully before the invoice existed. */
function notBefore(paidDay: string, issueDate: string | null, slack: number): boolean {
  if (!issueDate) return true;
  const days = Math.round(
    (Date.parse(`${paidDay}T00:00:00Z`) - Date.parse(`${issueDate}T00:00:00Z`)) / 86400000
  );
  return Number.isFinite(days) ? days >= -slack : true;
}

/**
 * The bill a row was already posted for, by hand.
 *
 * The mark-paid dialog exists for payments no statement will ever carry, and it
 * writes its own posting because nothing else will. But nothing stops somebody
 * marking a bill paid from an account whose statement they then import, and
 * that payment would be posted a second time from a file that has no idea the
 * first one happened.
 *
 * So a row is checked against the bills already settled **from this very
 * account**. A hit is a payment the ledger holds twice over, and the import
 * skips it. The date has to be close as well as the amount: a subscription
 * paid by hand in March does not excuse the April charge.
 */
export function matchPaidBill(
  row: BankStatementRow,
  bills: readonly BillForMatching[],
  intoAccount: number,
  window = 5,
  /**
   * Read for the same reason as in `matchBillForRow`, and it matters more here.
   * A row this misses is not an unmatched row a person can fix on screen: it is
   * a second posting of a payment the ledger already holds, written silently.
   */
  paymentProviders: readonly string[] = []
): BillForMatching | null {
  if (row.amount >= 0) return null;
  const paid = roundCents(-row.amount);
  const text = `${row.text} ${row.rawText}`;
  const viaProvider = paymentProviders.some((provider) => mentionsCompany(text, provider));

  return (
    bills.find((bill) => {
      if (!bill.paidDate || bill.paidFrom !== intoAccount) return false;
      if (bill.amount === null || roundCents(bill.amount) !== paid) return false;
      if (!viaProvider && (!bill.companyTitle || !mentionsCompany(text, bill.companyTitle))) {
        return false;
      }
      return withinDays(row.date, bill.paidDate, window);
    }) ?? null
  );
}

function withinDays(a: string, b: string, window: number): boolean {
  const days = Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000;
  return Number.isFinite(days) ? days <= window : false;
}

/**
 * The postings that already record this payment, if the ledger holds them.
 *
 * A payment can reach the ledger before the invoice is stamped paid: a leg of a
 * batched bank row settles it, or somebody enters the posting by hand. Marking
 * the invoice paid then writes the money a second time, and nothing downstream
 * can tell the two apart -- two honest-looking postings for one payment, in a
 * month that will not reconcile for a reason nobody can see.
 *
 * **The window runs from the invoice, not from the proposed paid date.** That
 * was the first attempt and it was wrong: a batched payment on the 23rd against
 * a paid date defaulting to the due date on the 31st is eight days apart, the
 * window was five, and the dialog posted a duplicate of a payment it was
 * looking straight at. Anchoring on the invoice is also what keeps a monthly
 * bill honest -- January's posting cannot settle February's invoice, because it
 * falls before February's invoice was issued.
 *
 * Every leg has to be covered: one leg of a three-way split already posted is
 * not the same payment, and posting the rest would be right.
 */
export function postingsCovering(
  postings: readonly Posting[],
  legs: readonly { account: number; amount: number }[],
  paidFrom: number,
  /** The day the invoice was issued, or null when it does not say. */
  from: string | null,
  /** The day it is being marked paid. */
  to: string,
  slack = 5
): Posting[] {
  if (legs.length === 0) return [];

  const earliest = from ? shiftDay(from, -slack) : shiftDay(to, -slack);
  const latest = shiftDay(to, slack);

  const taken = new Set<Posting>();
  const found: Posting[] = [];

  for (const leg of legs) {
    const hit = postings.find(
      (posting) =>
        !taken.has(posting) &&
        roundCents(posting.amount) === roundCents(leg.amount) &&
        touches(posting, leg.account) &&
        touches(posting, paidFrom) &&
        posting.date >= earliest &&
        posting.date <= latest
    );
    // One leg unaccounted for and this is not the same payment.
    if (!hit) return [];
    taken.add(hit);
    found.push(hit);
  }

  return found;
}

/** An ISO day moved by a number of days, as an ISO day. */
function shiftDay(day: string, days: number): string {
  const at = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(at)) return day;
  return new Date(at + days * 86400000).toISOString().slice(0, 10);
}

function touches(posting: Posting, account: number): boolean {
  return posting.debit === account || posting.credit === account;
}

/** What a payment that nearly matches this invoice disagrees about. */
export type NearMissReason = 'account' | 'date';

export interface NearMiss {
  posting: Posting;
  reason: NearMissReason;
}

/**
 * How many days beyond the invoice window a payment is still worth mentioning.
 *
 * Sixty rather than forever. A same-amount posting six months from an invoice
 * is far more likely to be a different month of the same subscription than a
 * very late payment, and reporting it would teach the reader to dismiss this
 * warning -- which is worse than not showing it.
 */
const NEAR_MISS_DAYS = 60;

/**
 * Payments that match this invoice on the money but disagree on one thing.
 *
 * For when `postingsCovering` found nothing. Its checks are deliberately
 * strict, and they fail closed into the most expensive outcome there is: the
 * dialog offers to write a posting for a payment that is already in the books,
 * and the reader has no way to know it is looking at one. Both ways it happened
 * in a real vault, within a fortnight of each other:
 *
 * - **The account disagreed.** An invoice said `4039` and the import had filed
 *   the payment to `4036`. Everything else lined up.
 * - **The date fell outside the days searched.** An invoice due on the 14th was
 *   paid on the 26th, and the search around the invoice reached only the 19th.
 *
 * Each reason requires everything *except* its own dimension to match, so this
 * says "the payment is there and one field is off" rather than "here is a
 * posting of the same size". The caller decides what to do about it: nothing
 * here blocks anything, because a person who means to write the posting anyway
 * is sometimes right.
 *
 * Single-account invoices only. A split whose legs half-match is a genuinely
 * ambiguous thing to report and would need a different sentence for every
 * shape it can fail in.
 */
export function paymentsNearMiss(
  postings: readonly Posting[],
  legs: readonly { account: number; amount: number }[],
  paidFrom: number,
  from: string | null,
  to: string,
  slack = 5
): NearMiss[] {
  const leg = legs.length === 1 ? legs[0] : undefined;
  if (!leg) return [];

  const earliest = from ? shiftDay(from, -slack) : shiftDay(to, -slack);
  const latest = shiftDay(to, slack);

  const sameMoney = postings.filter(
    (posting) => roundCents(posting.amount) === roundCents(leg.amount) && touches(posting, paidFrom)
  );

  const found: NearMiss[] = [];

  for (const posting of sameMoney) {
    const inWindow = posting.date >= earliest && posting.date <= latest;
    const rightAccount = touches(posting, leg.account);

    // Everything but the account.
    if (inWindow && !rightAccount) {
      found.push({ posting, reason: 'account' });
      continue;
    }

    // Everything but the date. `postingsCovering` would have found this one had
    // the window reached it, so saying which day it is on is the whole fix.
    if (!inWindow && rightAccount) {
      const near =
        posting.date >= shiftDay(earliest, -NEAR_MISS_DAYS) &&
        posting.date <= shiftDay(latest, NEAR_MISS_DAYS);
      if (near) found.push({ posting, reason: 'date' });
    }
  }

  return found;
}
