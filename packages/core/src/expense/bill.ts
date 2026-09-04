/**
 * A bill note: what it says, and what it currently is.
 *
 * A bill is money owed rather than money spent, which is why it is a note of
 * its own rather than a property on a purchase: one purchase can be settled by
 * two instalments and one bill can cover two purchases, and neither fits inside
 * the other without lying about it. That is the same argument a delivery note
 * is here on.
 *
 * **The status is derived, and only `cancelled` is stored.** Paid follows from
 * a paid date, overdue and due from the due date and today. Cancellation is the
 * one state no date can express, and that is the whole reason the property
 * exists.
 *
 * App-free, and clock-free: every question about today takes today.
 */
import { formatDayTitle } from '../dates/day.js';
import { readIsoDate } from '../dates/read.js';
import { readNumberLike, readPathList, readString } from '../frontmatter/read.js';
import { linkOrText, wikilinkValue } from '../links/wikilink.js';
import { normalizeCurrency, roundCents } from '../money/format.js';
import { isBillStatus, type BillStatus } from './types.js';

export interface BillProperties {
  typePropertyName: string;
  typeValue: string;
  companyProperty: string;
  areaProperty: string;
  categoryProperty: string;
  amountProperty: string;
  currencyProperty: string;
  issueDateProperty: string;
  dueDateProperty: string;
  paidDateProperty: string;
  referenceProperty: string;
  documentProperty: string;
  directionProperty: string;
  recurringProperty: string;
  purchaseProperty: string;
  statusProperty: string;
  /** The account the invoice is booked to. */
  accountProperty: string;
  /** The list of accounts an invoice divides across, when one account is not enough. */
  linesProperty: string;
  lineAccountField: string;
  lineAmountField: string;
  lineNoteField: string;
  /** The account the money left when it was paid. */
  paidFromProperty: string;
}

/**
 * One part of an invoice, booked to its own account.
 *
 * The amount may be negative: a discount, a credit, a rounding line. Real
 * invoices carry them, and a line editor that refused would send somebody back
 * to arithmetic they should not be doing.
 */
export interface BillLine {
  account: number;
  amount: number;
  note: string;
}

/**
 * Which way an invoice points.
 *
 * `incoming` is a bill the household owes; `outgoing` is one it has sent. The
 * two are the same document read from opposite ends, which is why they share a
 * note type rather than having one each: every difference between them is a
 * value, not a shape.
 *
 * Identifiers, not words on screen. The German labels are the translation
 * tables' job, the same rule the account kinds follow, so a value in
 * frontmatter is not translated on its way in or out.
 */
export const BILL_DIRECTIONS = ['incoming', 'outgoing'] as const;
export type BillDirection = (typeof BILL_DIRECTIONS)[number];

/**
 * The direction a note states, defaulting to `incoming`.
 *
 * **Absent means incoming**, and that is the load-bearing part. Every invoice
 * that existed before this property did is one the household owes, so the
 * absent value has to mean the common case: the alternative is a day on which
 * every invoice in a vault changes meaning at once.
 *
 * Anything unrecognised is also incoming rather than an error. A typo in a
 * hand-edited note should leave the invoice where it was, not move it to the
 * other side of the income statement.
 */
export function readBillDirection(value: unknown): BillDirection {
  return value === 'outgoing' ? 'outgoing' : 'incoming';
}

export interface ParsedBill {
  companyTitle: string | null;
  areaTitle: string | null;
  category: string | null;
  amount: number | null;
  currency: string | null;
  issueDate: string | null;
  dueDate: string | null;
  paidDate: string | null;
  reference: string | null;
  /**
   * The paper this note is about: one file, or several.
   *
   * An invoice arrives as a covering letter and a payment slip often enough
   * that one path was not enough, and scanning a two-page invoice in two goes
   * produces the same shape. Read leniently from a bare string or a list, and
   * **written back as a bare string while there is only one**, so no note that
   * predates this is rewritten just for being read.
   *
   * Order is the note's own, because it is the only thing that says which of
   * them is the invoice.
   */
  documentPaths: string[];
  /** Which way this invoice points. `incoming` on every note that does not say. */
  direction: BillDirection;
  recurringTitle: string | null;
  purchaseTitle: string | null;
  /**
   * The account this invoice is booked to: an expense account for most bills,
   * a payable for an instalment that settles a debt already recorded.
   *
   * Null on a bill nobody has classified yet, which is a bill the ledger cannot
   * post and says so rather than guessing an account.
   */
  account: number | null;
  /**
   * The accounts this invoice divides across, when one is not enough.
   *
   * Empty on the ordinary invoice, which is booked whole to `account`. A
   * telephone bill with a hardware line on it, or an energy bill covering
   * electricity and gas, is two or three accounts on one piece of paper, and
   * splitting it by hand into separate notes would invent invoices that never
   * existed.
   *
   * **These replace `account` rather than adding to it.** Both would be two
   * claims about where the same money goes.
   */
  lines: BillLine[];
  /**
   * The account the money left. Written by whoever settled the bill: the
   * statement import when the payment arrives in a file, the mark-paid dialog
   * when it never will.
   */
  paidFrom: number | null;
  /** What the note claims, if anything. `billStatus()` is what a view asks. */
  statedStatus: BillStatus | null;
}

export interface BillRecord<F = unknown> extends ParsedBill {
  file: F;
  title: string;
}

export function parseBill(
  frontmatter: Record<string, unknown>,
  properties: BillProperties
): ParsedBill {
  const p = properties;
  const rawStatus = readString(frontmatter[p.statusProperty]);

  return {
    companyTitle: linkOrText(frontmatter[p.companyProperty]),
    areaTitle: linkOrText(frontmatter[p.areaProperty]),
    category: readString(frontmatter[p.categoryProperty]),
    amount: readNumberLike(frontmatter[p.amountProperty]),
    currency: normalizeCurrency(readString(frontmatter[p.currencyProperty])),
    issueDate: readIsoDate(frontmatter[p.issueDateProperty]),
    dueDate: readIsoDate(frontmatter[p.dueDateProperty]),
    paidDate: readIsoDate(frontmatter[p.paidDateProperty]),
    reference: readString(frontmatter[p.referenceProperty]),
    documentPaths: readPathList(frontmatter[p.documentProperty]),
    direction: readBillDirection(frontmatter[p.directionProperty]),
    recurringTitle: linkOrText(frontmatter[p.recurringProperty]),
    purchaseTitle: linkOrText(frontmatter[p.purchaseProperty]),
    account: readNumberLike(frontmatter[p.accountProperty]),
    lines: readBillLines(frontmatter[p.linesProperty], p),
    paidFrom: readNumberLike(frontmatter[p.paidFromProperty]),
    statedStatus: isBillStatus(rawStatus) ? (rawStatus.trim() as BillStatus) : null,
  };
}

/**
 * What a bill is right now.
 *
 * The order matters, and each step is a claim about which fact beats which:
 *
 * 1. **A paid date wins over everything**, including a stated status. Somebody
 *    typing the day they paid is making a stronger claim than a dropdown left
 *    behind.
 * 2. **A stated status wins over the dates**, which is how `cancelled` works
 *    and how a vault overrides a derivation it disagrees with.
 * 3. Otherwise the due date decides, against today.
 *
 * A bill with no due date is `open` forever, and that is right: it is owed and
 * nothing has said when. Calling it overdue would invent a deadline.
 */
export function billStatus(
  bill: Pick<ParsedBill, 'paidDate' | 'dueDate' | 'statedStatus'>,
  today: Date,
  dueSoonDays = 7
): BillStatus {
  if (bill.paidDate) return 'paid';
  if (bill.statedStatus) return bill.statedStatus;
  if (!bill.dueDate) return 'open';

  const now = formatDayTitle(today);
  if (bill.dueDate < now) return 'overdue';

  const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dueSoonDays);
  return bill.dueDate <= formatDayTitle(horizon) ? 'due' : 'open';
}

/** Still owed: anything but paid and cancelled. What a "what do I owe" total sums. */
export function isOutstanding(status: BillStatus): boolean {
  return status === 'open' || status === 'due' || status === 'overdue';
}

/**
 * The day a bill's money belongs to.
 *
 * The due date, falling back to the issue date. Not the paid date: a bill paid
 * late still belongs to the month it was due in, which is the month somebody
 * budgeted it in. A view that wants cash flow rather than accrual asks for the
 * paid date itself.
 */
export function billPeriodDate(bill: Pick<ParsedBill, 'dueDate' | 'issueDate'>): string | null {
  return bill.dueDate ?? bill.issueDate;
}

/**
 * What a money note is called: `20260604_baloise_1000000001`.
 *
 * Every one of the four is the same shape of thing -- something happened, on a
 * day, with a company, under a number they gave it -- so all four are named the
 * same way. An invoice by its issue date, a purchase by its order date, a
 * recurring cost by the day the arrangement starts.
 *
 * Deriving the name rather than asking for one means the note and the document
 * beside it sort together, and means nobody has to invent a title while looking
 * at a piece of paper that already has an identity of its own. It is also the
 * convention the folder of PDFs this was written against already follows.
 *
 * **The day is stamped `YYYYMMDD`, without separators**, so it reads as one
 * token and the underscores only ever separate the three parts.
 *
 * A part that is missing is left out along with its separator, so a bill with
 * no reference is `20260604_baloise` rather than `20260604_baloise_`. All three
 * missing yields an empty string, which is the caller's cue that there is
 * nothing to name the note after yet.
 *
 * Whitespace inside a part is collapsed but not removed: a company is called
 * what its note is called, and `Baloise Versicherung` squeezed to
 * `BaloiseVersicherung` would be a second name for the same firm.
 */
export function financeNoteStem(date: Date | null, company: string, reference: string): string {
  const stamp = date ? formatDayTitle(date).replace(/-/g, '') : '';
  return [stamp, tidyPart(company), tidyPart(reference)].filter((part) => part !== '').join('_');
}

function tidyPart(part: string): string {
  return part.trim().replace(/\s+/g, ' ');
}

/**
 * Read leniently, on the same terms as every other list in a vault: a row that
 * names no account is skipped and the rest are kept, because one bad line in a
 * hand-edited note must not cost somebody the other five.
 */
function readBillLines(raw: unknown, p: BillProperties): BillLine[] {
  if (!Array.isArray(raw)) return [];

  const lines: BillLine[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;

    const account = readNumberLike(record[p.lineAccountField]);
    if (account === null) continue;

    lines.push({
      account,
      amount: roundCents(readNumberLike(record[p.lineAmountField]) ?? 0),
      note: readString(record[p.lineNoteField]) ?? '',
    });
  }
  return lines;
}

/** What the lines add up to. The figure a split posting has to match. */
export function billLineTotal(lines: readonly BillLine[]): number {
  return roundCents(lines.reduce((sum, line) => sum + line.amount, 0));
}

/**
 * The accounts this invoice posts to, whichever way it was filled in.
 *
 * One entry for a bill booked whole, one per line for a bill that divides. The
 * single caller-facing shape, so nothing downstream has to ask which of the two
 * a particular note used.
 */
export function billPostingLines(bill: ParsedBill): BillLine[] {
  if (bill.lines.length > 0) return bill.lines;
  if (bill.account === null || bill.amount === null) return [];
  return [{ account: bill.account, amount: bill.amount, note: '' }];
}

export type BillContent = ParsedBill;

export function buildBillFrontmatter(
  properties: BillProperties,
  content: BillContent
): Record<string, unknown> {
  const p = properties;
  const frontmatter: Record<string, unknown> = { [p.typePropertyName]: p.typeValue };

  if (content.companyTitle) frontmatter[p.companyProperty] = wikilinkValue(content.companyTitle);
  if (content.areaTitle) frontmatter[p.areaProperty] = wikilinkValue(content.areaTitle);
  if (content.category) frontmatter[p.categoryProperty] = content.category;
  if (content.amount !== null) frontmatter[p.amountProperty] = content.amount;
  if (content.currency) frontmatter[p.currencyProperty] = content.currency;
  if (content.issueDate) frontmatter[p.issueDateProperty] = content.issueDate;
  if (content.dueDate) frontmatter[p.dueDateProperty] = content.dueDate;
  if (content.paidDate) frontmatter[p.paidDateProperty] = content.paidDate;
  if (content.reference) frontmatter[p.referenceProperty] = content.reference;
  if (content.account !== null) frontmatter[p.accountProperty] = content.account;
  if (content.lines.length > 0) {
    frontmatter[p.linesProperty] = content.lines.map((line) => {
      const row: Record<string, unknown> = {
        [p.lineAccountField]: line.account,
        [p.lineAmountField]: line.amount,
      };
      if (line.note) row[p.lineNoteField] = line.note;
      return row;
    });
  }
  if (content.paidFrom !== null) frontmatter[p.paidFromProperty] = content.paidFrom;
  // Written only when it is outgoing. Incoming is what an absent value means,
  // so writing it would add a property to every invoice in the vault to say
  // what every reader already assumes.
  if (content.direction === 'outgoing') frontmatter[p.directionProperty] = content.direction;

  // One stays a bare string. A list of one would rewrite the frontmatter of
  // every note that has ever had a document, to say exactly what it said.
  if (content.documentPaths.length === 1) {
    frontmatter[p.documentProperty] = content.documentPaths[0];
  } else if (content.documentPaths.length > 1) {
    frontmatter[p.documentProperty] = [...content.documentPaths];
  }
  if (content.recurringTitle) {
    frontmatter[p.recurringProperty] = wikilinkValue(content.recurringTitle);
  }
  if (content.purchaseTitle) {
    frontmatter[p.purchaseProperty] = wikilinkValue(content.purchaseTitle);
  }
  // Written only when the note is making a claim the dates cannot. A derived
  // status written into the note would be stale the following morning.
  if (content.statedStatus) frontmatter[p.statusProperty] = content.statedStatus;

  return frontmatter;
}
