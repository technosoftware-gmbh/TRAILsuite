/**
 * Turning statement rows into postings somebody can approve.
 *
 * **Nothing here writes.** It produces a proposal per row with a status
 * attached, so a preview can show what would happen before it happens. An
 * import that wrote first and explained afterwards would be one nobody dares
 * run on a second month.
 *
 * The hard part is not the arithmetic, it is the two ways a household ledger
 * gets a wrong balance from an import that looks like it worked:
 *
 * **The same row imported twice**, because somebody re-exported an overlapping
 * period. Caught by the key the posting carries from the row it came from.
 *
 * **The same movement imported from both ends.** A transfer between two of the
 * household's own accounts appears in both statements: money leaving one, money
 * arriving in the other. Import both and it is posted twice, and neither
 * balance is right afterwards. This is the common case rather than the exotic
 * one, because moving money between one's own accounts is a thing people do
 * constantly. Caught by looking for the posting the other file already wrote --
 * twice over, because the two ends do not always arrive the same way: see
 * `findMirror` for a row whose account is known, and `findBookedCounterpart`
 * for one whose account is not.
 *
 * App-free, and clock-free.
 */
import { addDays, formatDayTitle, parseDayTitle } from '../dates/day.js';
import { accountForBankNumber } from './account.js';
import type { BillLine } from '../expense/bill.js';
import {
  matchBillForRow,
  matchPaidBill,
  type BillForMatching,
  type BillMatch,
} from './bill-match.js';
import {
  matchOrderForCharge,
  matchOrderForText,
  type ChargeOrderMatch,
  type OrderForMatching,
} from './order-match.js';
import { counterpartyOf, statementRowKeys } from './statement.js';
import type { BankStatementRow } from './statement.js';
import type { Account, Posting } from './types.js';

/** A text pattern that says which account a row belongs to. */
export interface ImportRule {
  /** Matched case insensitively against the row's text. */
  match: string;
  account: number;
  /** Where it came from, for a view that offers to remember a choice. */
  learned?: boolean;
}

export interface ImportOptions {
  /** The account whose statement this is. Chosen by a person: no file states it. */
  intoAccount: number;
  accounts: readonly Account[];
  rules: readonly ImportRule[];
  /** Every posting the vault already holds. */
  existing: readonly Posting[];
  /**
   * The bills the vault holds, so a row that pays one takes its account and
   * gets it stamped paid instead of being posted a second time.
   *
   * Omitted means no invoices to reconcile against, which is how the import
   * behaved before bills knew their account: every row falls through to the
   * text rules.
   */
  bills?: readonly BillForMatching[];
  /**
   * How many days apart the two ends of one transfer may be dated.
   *
   * Three, because one bank books a transfer on the day it leaves and the other
   * on the day it lands, and a weekend can sit between. Wider would start
   * swallowing genuinely separate payments of the same amount.
   */
  mirrorWindow?: number;
  /**
   * Companies that collect on a merchant's behalf.
   *
   * A shop can hand its collection to Klarna or PayPal without telling anybody,
   * and from that day its rows arrive naming the collector. The invoice still
   * names the shop, and there is nothing else shared: the bank's reference is
   * the bank's own, and the provider's message number is the provider's own. So
   * a row naming one of these is matched to invoices on the amount and the date
   * alone, and where that is ambiguous the ambiguity is reported.
   *
   * Omitted means every row must name its vendor, which is how the import
   * behaved before any of this.
   */
  paymentProviders?: readonly string[];
  /**
   * The orders the vault already holds, so a card charge takes its number.
   *
   * A sibling plugin records every order when it is placed: the merchant, the
   * day, the price and the number. The card bills it days later as a line
   * carrying the merchant and the figure and nothing else, and typing the
   * number in by hand is both the tedious part and the part that goes wrong.
   *
   * Matching here rather than in a dialog is what puts the number into the
   * posting's own text, where every later check can read it -- which is the
   * point, because an order paid for twice is invisible to every check that
   * works on money alone.
   */
  orders?: readonly OrderForMatching[];
}

export type ProposalStatus =
  /** Complete: both accounts known, ready to write. */
  | 'ready'
  /** No rule and no transfer: a person has to say which account. */
  | 'needs-account'
  /** The bank posted several payments as one line. */
  | 'needs-split'
  /** This exact row has been imported before. */
  | 'already-imported'
  /** The other end of this transfer is already in the ledger. */
  | 'mirrors-existing'
  /** An invoice settled by hand already put this payment in the ledger. */
  | 'already-settled';

export interface ImportProposal {
  row: BankStatementRow;
  key: string;
  status: ProposalStatus;
  /** Null whenever a person still has to decide something. */
  posting: Posting | null;
  /** The account on the other side, when it is known. */
  counterAccount: number | null;
  /** How the other side was decided, for showing why. */
  matchedBy: 'transfer' | 'bill' | 'rule' | null;
  /**
   * True when a rule pointed this row back at the account being imported into.
   *
   * Carried so a view can say why it is asking, rather than showing a row with
   * no account and no reason beside every row that genuinely has none.
   */
  sameAccount?: boolean;
  /**
   * The invoice this row pays, when it pays one.
   *
   * Carried even on a row that still needs an account, because knowing which
   * bill it is is most of the answer, and because writing the import is what
   * stamps that bill paid.
   */
  settles: BillMatch | null;
  /** For a batch line: how many payments the bank says it covers. */
  legCount: number | null;
  /**
   * The accounts this row divides across, when the invoice it pays says so.
   *
   * Empty on every other row. Present here rather than left to the modal so a
   * preview can show the division before anything is written, which is the
   * whole point of a preview.
   */
  legs: BillLine[];
  /** The posting this one would duplicate. */
  mirrorOf: Posting | null;
  /**
   * The order this charge paid for, when the vault holds one that fits.
   *
   * Independent of the account: an order note says what was bought and for how
   * much, and never says where it belongs. So this enriches a row rather than
   * resolving it, and a row can carry an order and still be waiting for
   * somebody to name its account.
   */
  order?: ChargeOrderMatch | null;
}

export interface ImportPlan {
  proposals: ImportProposal[];
  ready: number;
  needsAttention: number;
  skipped: number;
  /** What the ready postings would move, for a figure to check against the file. */
  readyTotal: number;
  /** How many rows were recognised as paying an invoice the vault already holds. */
  settled: number;
}

/**
 * What an import would do, row by row.
 *
 * Rows are expected oldest first, as `acceptedRows` hands them over. The order
 * matters only for the mirror check, which looks at what earlier rows of this
 * same file proposed as well as at what the vault already holds: a file that
 * contained both ends of one transfer would otherwise double it by itself.
 */
export function planImport(rows: readonly BankStatementRow[], options: ImportOptions): ImportPlan {
  const mirrorDays = options.mirrorWindow ?? 3;
  const keys = statementRowKeys(rows);
  const imported = new Set(
    options.existing.map((posting) => posting.importKey).filter((key): key is string => !!key)
  );
  const ownAccounts = new Set(
    options.accounts
      .filter((account) => account.kind === 'asset' || account.kind === 'liability')
      .map((account) => account.number)
  );

  // Every key this file produces. A posting the ledger already holds that
  // carries one of them came from **this same statement** on an earlier run,
  // so it is another row of the file in hand rather than the far end of a
  // transfer, and two rows of one statement are two movements whatever they
  // share. Excluding them is what stops the second of two identical payments
  // from being read as the first one arriving from the other side.
  const fileKeys = new Set(keys);

  // What the ledger already held, minus this file's own earlier import. The
  // two ends of a transfer come from two different files, so this is the pool
  // that catches them -- and a row from this file is by definition not in it.
  const posted: Posting[] = options.existing.filter(
    (posting) => !posting.importKey || !fileKeys.has(posting.importKey)
  );
  // What this same run has proposed. A backstop for a duplicated export row
  // once its reference is gone, and consulted only for a row that has no
  // reference of its own: see planRow.
  const proposedHere: Posting[] = [];
  const proposals: ImportProposal[] = [];

  // An order is bought once, and the ledger already says which ones have been
  // paid for: every posting whose text names one. Read from the postings rather
  // than kept anywhere, so it is right for a vault whose entries were typed by
  // hand long before any of this existed.
  const paidOrders = new Set<string>();
  for (const posting of options.existing) {
    const named = matchOrderForText(posting.text ?? '', options.orders ?? []);
    if (named) paidOrders.add(named.order.orderNumber);
  }

  // An invoice is paid once. Two rows of the same amount from the same vendor
  // in one file are two payments, and letting both claim the one open bill
  // would stamp it paid twice and leave the second row wrongly accounted for.
  const settledBills = new Set<string>();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const key = keys[index];
    if (!row || key === undefined) continue;

    const open = (options.bills ?? []).filter((bill) => !settledBills.has(bill.title));
    const proposal = planRow(
      row,
      key,
      { ...options, bills: open },
      ownAccounts,
      posted,
      proposedHere,
      imported,
      mirrorDays,
      paidOrders
    );
    proposals.push(proposal);
    if (proposal.posting && proposal.status === 'ready') proposedHere.push(proposal.posting);
    if (proposal.settles && proposal.status !== 'already-imported') {
      settledBills.add(proposal.settles.bill.title);
    }
    // Claimed as soon as it is proposed, so two rows in one file cannot both
    // take it -- the same rule as bills, for the same reason.
    if (proposal.order && proposal.status !== 'already-imported') {
      paidOrders.add(proposal.order.order.orderNumber);
    }
  }

  const ready = proposals.filter((proposal) => proposal.status === 'ready');
  return {
    proposals,
    ready: ready.length,
    needsAttention: proposals.filter(
      (proposal) => proposal.status === 'needs-account' || proposal.status === 'needs-split'
    ).length,
    skipped: proposals.filter(
      (proposal) =>
        proposal.status === 'already-imported' ||
        proposal.status === 'mirrors-existing' ||
        proposal.status === 'already-settled'
    ).length,
    readyTotal: round(ready.reduce((sum, proposal) => sum + (proposal.row.amount ?? 0), 0)),
    settled: proposals.filter((proposal) => proposal.settles !== null).length,
  };
}

function planRow(
  row: BankStatementRow,
  key: string,
  options: ImportOptions,
  ownAccounts: ReadonlySet<number>,
  posted: readonly Posting[],
  proposedHere: readonly Posting[],
  imported: ReadonlySet<string>,
  mirrorDays: number,
  paidOrders: ReadonlySet<string> = new Set()
): ImportProposal {
  const order = matchOrderForCharge(row, options.orders ?? [], { taken: paidOrders });
  const base = {
    row,
    key,
    posting: null,
    counterAccount: null,
    matchedBy: null,
    settles: null,
    legs: [],
    legCount: row.batchCount,
    mirrorOf: null,
    sameAccount: false,
    order,
  } satisfies Omit<ImportProposal, 'status'>;

  // Checked before anything else is decided: a row already in the ledger needs
  // no account and no split.
  if (imported.has(key)) return { ...base, status: 'already-imported' };

  // A payment somebody marked paid by hand from this same account is already
  // posted, by a dialog that had no idea a statement would follow.
  const settledByHand = matchPaidBill(
    row,
    options.bills ?? [],
    options.intoAccount,
    undefined,
    options.paymentProviders ?? []
  );
  if (settledByHand) return { ...base, status: 'already-settled' };

  const resolved = resolveCounter(row, options);
  const counterAccount = resolved.account;
  const settles = resolved.settles;

  if (row.batchCount !== null && row.batchCount > 1) {
    // The bank collapsed several payments into one line. Which accounts they
    // belong to is not in the file at all, so this can only be offered as a
    // split for a person to fill in.
    return { ...base, status: 'needs-split', counterAccount, matchedBy: resolved.by, settles };
  }

  // An invoice that divides across accounts has already answered the question
  // the split editor exists to ask. The legs come off the note, the header
  // names only the account that paid, and nobody re-types a breakdown that is
  // written down twice already.
  const billLegs = settles?.bill.lines ?? [];
  if (billLegs.length > 0) {
    const outward = row.amount < 0;
    return {
      ...base,
      status: 'ready',
      matchedBy: 'bill',
      settles,
      legs: billLegs,
      posting: {
        ...postingFor(row, key, options.intoAccount, 0),
        // The side the legs fill is left blank, which is the shape the journal
        // parser reads a split back from.
        debit: outward ? null : options.intoAccount,
        credit: outward ? options.intoAccount : null,
      },
    };
  }

  if (counterAccount === null) {
    // Before asking, ask the ledger. A movement the other statement already
    // posted needs no account from anybody, and the posting it matched names
    // the account it went to.
    //
    // Skipped for a row that matched an invoice: a bill is a document somebody
    // looked at, and it outranks a shape read off two numbers and a date.
    const booked = settles
      ? null
      : findBookedCounterpart(row, options.intoAccount, posted, ownAccounts);
    if (booked) {
      const far = row.amount > 0 ? booked.credit : booked.debit;
      return {
        ...base,
        status: 'mirrors-existing',
        counterAccount: far,
        matchedBy: 'transfer',
        settles,
        mirrorOf: booked,
      };
    }

    // A matched bill with no account of its own lands here: which invoice this
    // is, is known; where it belongs is not, and that is the one question worth
    // asking.
    return { ...base, status: 'needs-account', settles };
  }

  /**
   * A row whose other side resolved to the account being imported into.
   *
   * Nobody means this. A posting from an account to itself moves nothing:
   * `effectOn` returns zero for it, so the payment simply does not happen, the
   * books still close because a zero is balanced, and the only symptom is a
   * closing balance that disagrees with the bank by the amount of every row
   * this befell.
   *
   * It is reachable from an over-broad rule, and the way it happened in a real
   * vault is worth recording: a learned rule of `Stefan Muster` -> 1011,
   * written from one row, then matched the account holder's own name inside
   * `Ursprünglicher Auftraggeber: STEFAN MUSTER` on rows that had nothing
   * to do with account 1011. Three payments were written as `1011 | 1011` and
   * moved nothing; a fourth was then dropped as a mirror of one of them,
   * because two self-postings of the same amount on the same day are identical
   * by every test `findMirror` applies. Four rows, one bad rule, and an import
   * that reported success.
   *
   * Asking is the only safe answer: the rule cannot be trusted for this row,
   * and guessing a different account would be inventing one.
   */
  if (counterAccount === options.intoAccount) {
    return { ...base, status: 'needs-account', settles, sameAccount: true };
  }

  const posting = withOrderNumber(postingFor(row, key, options.intoAccount, counterAccount), order);

  // Only a movement between two accounts the household owns can arrive twice.
  // A payment to a shop appears in one statement and one only.
  if (ownAccounts.has(counterAccount) && ownAccounts.has(options.intoAccount)) {
    // Against the ledger, minus whatever this same file put there before: the
    // far end of a transfer is in another file and carries that bank's own
    // reference, so a different reference proves nothing there, but a posting
    // this statement itself wrote is another row of it and never a mirror.
    // `posted` is filtered on `fileKeys` for exactly that.
    //
    // Against this same run **only for a row with no reference of its own**.
    // That backstop exists for a duplicated export row once the reference is
    // gone: `statementRowKey` falls back to the running balance, so two rows a
    // key cannot separate are the export repeating itself rather than two
    // payments, which a balance column could not have left behind twice.
    //
    // Found in a real vault, twice over, and the second time is the instructive
    // one. Two card payments of CHF 500.00 two days apart, both from the same
    // account to the same card. On the first import the second was dropped as a
    // mirror of what this run had just proposed. Gating that pool fixed the
    // symptom and not the bug: on the next import of the same file the first
    // payment was in the ledger, so the second was dropped again, now as a
    // mirror of an **existing** posting -- and because every other row was
    // already imported, the run reported nothing to do while the account stayed
    // 500.00 out. A fix that moves where a bug happens is not a fix.
    const mirror =
      findMirror(posting, posted, mirrorDays) ??
      (row.reference === null ? findMirror(posting, proposedHere, mirrorDays) : null);
    if (mirror) {
      return {
        ...base,
        status: 'mirrors-existing',
        counterAccount,
        matchedBy: resolved.by,
        settles,
        mirrorOf: mirror,
      };
    }
  }

  return { ...base, status: 'ready', posting, counterAccount, matchedBy: resolved.by, settles };
}

/**
 * The posting with the order's number written into its description.
 *
 * This is the whole payoff of matching, and it is worth being clear why the
 * number goes in the text rather than into a field of its own. A field would be
 * this plugin's private note about a row. The text is what every later reader
 * sees -- the journal, the reports, a person scrolling the month, and the
 * checks that ask whether one order has been paid for twice. Written there, the
 * match survives being re-read by something that never heard of importing.
 *
 * Left alone when the row already names the order, which is how a statement
 * that does print the number stays untouched, and when two orders fit equally
 * well, because a guess written into the text reads exactly like a fact.
 */
function withOrderNumber(posting: Posting, order: ChargeOrderMatch | null): Posting {
  if (!order || order.alsoFits.length > 0) return posting;
  const text = posting.text ?? '';
  if (matchOrderForText(text, [order.order])) return posting;
  return { ...posting, text: `${text} #${order.order.orderNumber}`.trim() };
}

function resolveCounter(
  row: BankStatementRow,
  options: ImportOptions
): { account: number | null; by: 'transfer' | 'bill' | 'rule' | null; settles: BillMatch | null } {
  // The account number a transfer prints beats everything else: it is what the
  // bank says, rather than what a note claims or a pattern guessed.
  if (row.transfer) {
    const account = accountForBankNumber(options.accounts, row.transfer.account);
    if (account) return { account: account.number, by: 'transfer', settles: null };
  }

  // An invoice beats a text rule, because somebody looked at this particular
  // document and said where it belongs, where a rule is a pattern that happened
  // to match. A matched bill with no account still wins: the row is that
  // invoice whether or not anybody has classified it.
  const settles = matchBillForRow(row, options.bills ?? [], {
    paymentProviders: options.paymentProviders,
  });
  if (settles)
    return {
      account: settles.bill.account,
      by: settles.bill.account === null ? null : 'bill',
      settles,
    };

  // **Both sides are cut at the same place**, and that symmetry is the whole
  // of it. Cutting only the row would break every rule ever learned from a
  // whole description, because such a rule carries a message and an originator
  // the row's counterparty half does not have. Cutting only the rule would
  // leave the row's originator field matchable. Cut both and a rule keeps
  // working, a rule that is a bare name matches only where that name is the
  // counterparty, and a rule learned from one invoice number generalises to
  // the vendor -- which is what somebody writing a rule for a shop meant.
  //
  // `rawText` is no longer searched. It is the original line, so including it
  // undid the cleaning that `strip` had just done and put the originator back.
  const haystack = counterpartyOf(row.text).toLowerCase();
  // Longest pattern first, so a specific rule beats a general one whatever
  // order they were written in. Measured on the cut rule, since that is what
  // is compared.
  const rules = [...options.rules]
    .map((rule) => ({ rule, needle: counterpartyOf(rule.match).toLowerCase() }))
    .sort((a, b) => b.needle.length - a.needle.length);
  for (const { rule, needle } of rules) {
    if (needle && haystack.includes(needle))
      return { account: rule.account, by: 'rule', settles: null };
  }

  return { account: null, by: null, settles: null };
}

/**
 * The posting a row implies, given both accounts.
 *
 * The sign is the whole of it. A negative row is money that left the account
 * being imported, which credits it and debits the other side; a positive row is
 * the reverse. That one rule produces the right posting for a payment, a
 * salary, and a transfer in either direction, which is the reassuring sign that
 * it is the right rule.
 */
export function postingFor(
  row: BankStatementRow,
  key: string,
  intoAccount: number,
  counterAccount: number
): Posting {
  const outward = row.amount < 0;
  return {
    date: row.date,
    debit: outward ? counterAccount : intoAccount,
    credit: outward ? intoAccount : counterAccount,
    amount: Math.abs(row.amount),
    currency: row.currency,
    text: row.text,
    reference: null,
    counterAmount: null,
    counterCurrency: null,
    line: row.line,
    // A row from a file is one entry by itself; a split made from it is given
    // its legs by the writer, which is what re-reads them as one.
    entryLine: row.line,
    splitOf: null,
    importKey: key,
  };
}

/**
 * A posting already in the ledger that is the same movement as this one.
 *
 * Same pair of accounts, same direction, same amount, dated no further apart
 * than `windowDays`. Not the same import key: the two ends of a transfer come
 * from two different files and carry two different keys, which is exactly why
 * the key alone cannot catch this.
 *
 * Direction is part of it and has to be. A thousand francs sent to the other
 * account and a thousand sent back the same day share the pair, the amount and
 * the date, and they are two movements rather than one counted twice.
 */
export function findMirror(
  posting: Posting,
  existing: readonly Posting[],
  windowDays: number
): Posting | null {
  const date = parseDayTitle(posting.date);
  if (!date) return null;

  const from = formatDayTitle(addDays(date, -windowDays));
  const to = formatDayTitle(addDays(date, windowDays));

  for (const candidate of existing) {
    if (candidate.debit !== posting.debit || candidate.credit !== posting.credit) continue;
    if (Math.abs(candidate.amount - posting.amount) > 0.005) continue;
    if (candidate.date < from || candidate.date > to) continue;
    return candidate;
  }
  return null;
}

/**
 * The far end of this row, when the ledger already holds it and the file does
 * not say which account it belongs to.
 *
 * `findMirror` cannot help here. It compares two complete postings, and a row
 * with no account resolved has no posting to compare: it falls out at
 * `needs-account` before the mirror check is ever reached. So a movement whose
 * two legs carry different references, and whose text names no account, is
 * asked about on the second import even though the answer is already written
 * in the journal.
 *
 * Found in a real vault. A standing monthly 850.00 from account 1011 to
 * account 1030 leaves 1011 as a payment to a person's name and arrives in 1030
 * as a payment from a person's name, and the bank numbers the two legs
 * separately -- unlike its own internal transfer, which prints one reference on
 * both. The 1011 import had already posted all three months correctly; the 1030
 * import asked about all three anyway, and answering would have doubled them.
 *
 * **Same day only, and never a guess.** The three-day window `findMirror` uses
 * exists because two *different* banks book a transfer on different days. Both
 * legs of a movement inside one bank are the same day, which is the case this
 * is for, so a narrower rule costs nothing and shrinks what it could collide
 * with to almost nothing. And where more than one posting fits, this returns
 * null and the person is asked, because two candidates is exactly the
 * situation in which picking one is how a ledger acquires a wrong number
 * nobody looks for.
 *
 * The far side must be an account the household owns. That is what makes this
 * a transfer rather than a payment that happens to match, and it keeps the
 * check to the one thing it was reasoned about.
 */
export function findBookedCounterpart(
  row: BankStatementRow,
  intoAccount: number,
  existing: readonly Posting[],
  ownAccounts: ReadonlySet<number>
): Posting | null {
  // Money in debits the account being imported into; money out credits it.
  // The same rule `postingFor` uses, read backwards.
  const inward = row.amount > 0;
  const amount = Math.abs(row.amount);

  const fits = existing.filter((candidate) => {
    if (candidate.date !== row.date) return false;
    if (Math.abs(candidate.amount - amount) > 0.005) return false;
    if (candidate.currency !== row.currency) return false;

    const near = inward ? candidate.debit : candidate.credit;
    const far = inward ? candidate.credit : candidate.debit;
    if (near !== intoAccount) return false;
    if (far === null || far === intoAccount) return false;
    return ownAccounts.has(far);
  });

  return fits.length === 1 ? (fits[0] ?? null) : null;
}

/**
 * A rule learned from a choice somebody made.
 *
 * The counterparty as the file wrote it, which is stable: the same shop bills
 * under the same name every month. Offered rather than saved, because a rule
 * written from one unusual payment would misfile every later one.
 *
 * **The counterparty, not the whole description.** That is what this comment
 * always claimed and what the code did not do: it learned the message and the
 * originator too, so a rule for a shop carried one invoice number and matched
 * that row and no other. Old rules are unaffected, because matching cuts them
 * at the same place.
 */
export function ruleFrom(row: BankStatementRow, account: number): ImportRule {
  return { match: counterpartyOf(row.text), account, learned: true };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
