/**
 * A recurring cost note, and the occurrences it implies.
 *
 * An insurance premium, a leasing instalment, a subscription: an amount on a
 * cadence, with a day it starts counting from.
 *
 * **Projection is arithmetic, not a side effect.** Nothing here writes a bill
 * note, and nothing writes an occurrence into any note. The occurrences are
 * recomputed on every render, so correcting the amount corrects every projected
 * month at once, and a plugin that quietly wrote twelve notes a year into
 * somebody's vault would be a plugin they stop trusting the folder of.
 *
 * App-free, and clock-free.
 */
import { addDays, formatDayTitle, parseDayTitle } from '../dates/day.js';
import { addMonthsKeepingDay } from '../dates/periods.js';
import { readIsoDate } from '../dates/read.js';
import { readNumberLike, readPathList, readString } from '../frontmatter/read.js';
import { linkOrText, wikilinkValue } from '../links/wikilink.js';
import { normalizeCurrency } from '../money/format.js';
import {
  isRecurringCadence,
  isRecurringStatus,
  type RecurringCadence,
  type RecurringStatus,
} from './types.js';

export interface RecurringProperties {
  typePropertyName: string;
  typeValue: string;
  companyProperty: string;
  areaProperty: string;
  categoryProperty: string;
  amountProperty: string;
  currencyProperty: string;
  cadenceProperty: string;
  intervalProperty: string;
  startDateProperty: string;
  endDateProperty: string;
  statusProperty: string;
  documentProperty: string;
  referenceProperty: string;
  /** The account every occurrence of this cost is booked to. */
  accountProperty: string;
}

export interface ParsedRecurring {
  companyTitle: string | null;
  areaTitle: string | null;
  category: string | null;
  /** What one occurrence costs. Null means nobody has priced it, which is not zero. */
  amount: number | null;
  currency: string | null;
  cadence: RecurringCadence;
  /** Every N cadences. At least 1: an interval of zero would project an infinite series. */
  interval: number;
  /** The day the cadence counts from. Without one nothing can be projected, and that is reported rather than guessed. */
  startDate: string | null;
  endDate: string | null;
  status: RecurringStatus;
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
  /**
   * The account every occurrence of this cost is booked to.
   *
   * A standing arrangement pays the same thing every time: the insurance
   * premium is always the insurance account, the leasing instalment always the
   * leasing one. Kept on the arrangement rather than answered again on each
   * invoice, which is where the answer was already known and typed anyway.
   *
   * Null on a cost nobody has classified. It stays a legal state, because a
   * standing charge is worth recording before somebody has decided where it
   * belongs.
   */
  account: number | null;
  /**
   * The number the other party knows this arrangement by: a policy number, a
   * contract number, a customer number.
   *
   * Not the same thing as a bill's reference, which identifies one invoice.
   * This identifies the standing agreement, and it is what somebody quotes on
   * the phone.
   */
  reference: string | null;
}

export interface RecurringRecord<F = unknown> extends ParsedRecurring {
  file: F;
  title: string;
}

/**
 * An unrecognised cadence reads as `monthly` and an unrecognised status as
 * `active`.
 *
 * Both are what a half-typed note most likely means, and both are the reading
 * that keeps the charge visible. A cost that vanished from every projection
 * because of a typo is the failure mode this vocabulary exists to avoid.
 */
export function parseRecurring(
  frontmatter: Record<string, unknown>,
  properties: RecurringProperties
): ParsedRecurring {
  const p = properties;
  const rawCadence = readString(frontmatter[p.cadenceProperty]);
  const rawStatus = readString(frontmatter[p.statusProperty]);

  return {
    companyTitle: linkOrText(frontmatter[p.companyProperty]),
    areaTitle: linkOrText(frontmatter[p.areaProperty]),
    category: readString(frontmatter[p.categoryProperty]),
    amount: readNumberLike(frontmatter[p.amountProperty]),
    currency: normalizeCurrency(readString(frontmatter[p.currencyProperty])),
    cadence: isRecurringCadence(rawCadence) ? (rawCadence.trim() as RecurringCadence) : 'monthly',
    interval: Math.max(1, Math.round(readNumberLike(frontmatter[p.intervalProperty]) ?? 1)),
    startDate: readIsoDate(frontmatter[p.startDateProperty]),
    endDate: readIsoDate(frontmatter[p.endDateProperty]),
    status: isRecurringStatus(rawStatus) ? (rawStatus.trim() as RecurringStatus) : 'active',
    documentPaths: readPathList(frontmatter[p.documentProperty]),
    account: readNumberLike(frontmatter[p.accountProperty]),
    reference: readString(frontmatter[p.referenceProperty]),
  };
}

/** How many months one step of a cadence covers. Weekly is not months and is handled apart. */
function monthsPerStep(cadence: RecurringCadence): number | null {
  switch (cadence) {
    case 'monthly':
      return 1;
    case 'quarterly':
      return 3;
    case 'semiannual':
      return 6;
    case 'annual':
      return 12;
    case 'weekly':
    case 'once':
      return null;
  }
}

/** One projected charge: the day it falls and what it costs. */
export interface Occurrence {
  /** ISO day. */
  date: string;
  amount: number | null;
  currency: string | null;
}

/**
 * Every occurrence falling inside a closed range of ISO days.
 *
 * Empty for a cost that is paused, ended, or has no start date: none of the
 * three can be projected, and projecting them anyway would put money into a
 * budget that nobody has committed.
 *
 * `once` yields at most its start date, which is what makes it usable for a
 * one-off commitment somebody wants beside the standing ones rather than a
 * special case elsewhere.
 *
 * Bounded at 512 steps. A cadence and an interval come out of a hand-edited
 * note, and a weekly charge asked for a century is a loop nobody meant to
 * write.
 */
export function occurrencesBetween(
  cost: Pick<
    ParsedRecurring,
    'cadence' | 'interval' | 'startDate' | 'endDate' | 'status' | 'amount' | 'currency'
  >,
  fromIso: string,
  toIso: string
): Occurrence[] {
  if (cost.status !== 'active' || !cost.startDate) return [];

  const start = parseDayTitle(cost.startDate);
  if (!start) return [];

  const stop = cost.endDate && cost.endDate < toIso ? cost.endDate : toIso;
  if (stop < fromIso) return [];

  const months = monthsPerStep(cost.cadence);
  const found: Occurrence[] = [];

  for (let step = 0; step < 512; step += 1) {
    const day =
      cost.cadence === 'weekly'
        ? addDays(start, step * 7 * cost.interval)
        : months === null
          ? start
          : addMonthsKeepingDay(start, step * months * cost.interval);

    const iso = formatDayTitle(day);
    if (iso > stop) break;
    if (iso >= fromIso) {
      found.push({ date: iso, amount: cost.amount, currency: cost.currency });
    }
    if (cost.cadence === 'once') break;
  }

  return found;
}

/**
 * What a cost comes to across a range, per currency it is stated in.
 *
 * A count rather than a sum where the amount is null, because an unpriced
 * standing charge still falls due and a budget that omitted it would be
 * confidently wrong about the month.
 */
export function projectedTotal(
  cost: Parameters<typeof occurrencesBetween>[0],
  fromIso: string,
  toIso: string
): { amount: number | null; count: number } {
  const occurrences = occurrencesBetween(cost, fromIso, toIso);
  if (occurrences.length === 0) return { amount: null, count: 0 };

  return {
    amount: cost.amount === null ? null : Math.round(cost.amount * occurrences.length * 100) / 100,
    count: occurrences.length,
  };
}

/** The facts an invoice and the arrangement behind it both state. */
export interface RecurringInheritance {
  companyTitle: string | null;
  areaTitle: string | null;
  category: string | null;
  amount: number | null;
  currency: string | null;
  account: number | null;
}

/**
 * An invoice filled in from the standing arrangement it belongs to.
 *
 * The premium is the same insurer, the same figure and the same account every
 * quarter, and typing all three again once a quarter is how an invoice ends up
 * disagreeing with the arrangement it came from.
 *
 * **Only what the arrangement states is copied.** A cost with no area leaves
 * the invoice's area as it was rather than clearing it: "not recorded here" and
 * "deliberately none" are different answers, and only the second is the
 * arrangement's to give. So this fills a form and never empties one, which also
 * makes picking the wrong cost and then the right one recoverable.
 *
 * `split` is set for an invoice already divided across accounts. Those lines
 * are the more specific claim about where the money goes, and one account from
 * the arrangement would be a second claim about the same money.
 */
export function inheritFromRecurring(
  current: RecurringInheritance,
  cost: Pick<
    ParsedRecurring,
    'companyTitle' | 'areaTitle' | 'category' | 'amount' | 'currency' | 'account'
  >,
  options: { split?: boolean } = {}
): RecurringInheritance {
  return {
    companyTitle: cost.companyTitle ?? current.companyTitle,
    areaTitle: cost.areaTitle ?? current.areaTitle,
    category: cost.category ?? current.category,
    amount: cost.amount ?? current.amount,
    currency: cost.currency ?? current.currency,
    account: options.split ? current.account : (cost.account ?? current.account),
  };
}

export type RecurringContent = ParsedRecurring;

export function buildRecurringFrontmatter(
  properties: RecurringProperties,
  content: RecurringContent
): Record<string, unknown> {
  const p = properties;
  const frontmatter: Record<string, unknown> = { [p.typePropertyName]: p.typeValue };

  if (content.companyTitle) frontmatter[p.companyProperty] = wikilinkValue(content.companyTitle);
  if (content.areaTitle) frontmatter[p.areaProperty] = wikilinkValue(content.areaTitle);
  if (content.category) frontmatter[p.categoryProperty] = content.category;
  if (content.amount !== null) frontmatter[p.amountProperty] = content.amount;
  if (content.currency) frontmatter[p.currencyProperty] = content.currency;
  frontmatter[p.cadenceProperty] = content.cadence;
  // 1 is the absence of an interval rather than an interval, the same way a
  // quantity of one is left off a purchase line.
  if (content.interval !== 1) frontmatter[p.intervalProperty] = content.interval;
  if (content.startDate) frontmatter[p.startDateProperty] = content.startDate;
  if (content.endDate) frontmatter[p.endDateProperty] = content.endDate;
  frontmatter[p.statusProperty] = content.status;
  // One stays a bare string. A list of one would rewrite the frontmatter of
  // every note that has ever had a document, to say exactly what it said.
  if (content.documentPaths.length === 1) {
    frontmatter[p.documentProperty] = content.documentPaths[0];
  } else if (content.documentPaths.length > 1) {
    frontmatter[p.documentProperty] = [...content.documentPaths];
  }
  if (content.account !== null) frontmatter[p.accountProperty] = content.account;
  if (content.reference) frontmatter[p.referenceProperty] = content.reference;

  return frontmatter;
}
