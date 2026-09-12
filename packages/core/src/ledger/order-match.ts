/**
 * Which order a statement line paid for.
 *
 * The sibling of `bill-match.ts`, and an easier problem than that one for a
 * reason worth stating. Matching an invoice to a bank row cannot use a number,
 * because the only number on the row is the bank's own transaction reference.
 * A card statement line for a merchant order is the opposite case: it carries
 * the number the *merchant* issued, in the text, because that is what the
 * merchant sent to the card scheme. `TomTasty Bestellung #21383` names the
 * order, and the order note is filed under that number.
 *
 * So the number identifies and the amount only confirms. That inversion is the
 * whole design: an exact identifier means a match can be trusted, and the
 * figures being compared rather than copied means a disagreement is a finding
 * instead of a silent overwrite.
 *
 * **The statement is the truth about money.** The order says what was ordered;
 * the card says what was charged. When they differ the card wins and the
 * difference is reported, because a refund, a substitution or a partial
 * delivery are all real and all show up exactly here.
 *
 * App-free, and clock-free.
 */
import { roundCents } from '../money/format.js';
import { mentionsCompany } from './bill-match.js';

/** The little an order has to say to be recognised in a statement line. */
export interface OrderForMatching {
  /** How the note is named, for showing what was matched and for linking to it. */
  title: string;
  /** What the merchant calls this order. Taken from the filename, so it is never blank on a real note. */
  orderNumber: string;
  companyTitle: string | null;
  orderDate: string | null;
  /** What the note says it cost. Null on an order nobody has priced, which still matches. */
  price: number | null;
  priceCurrency: string | null;
}

export interface OrderMatch {
  order: OrderForMatching;
  /** The number in the text that found it. */
  matchedOn: string;
  /**
   * The figure on the statement less the order's own price, or null when the
   * order is unpriced or no figure was offered. Zero when they agree.
   */
  difference: number | null;
  /** Orders the same number fits equally well. Empty on a clean match. */
  alsoFits: OrderForMatching[];
}

/**
 * The shortest run of digits that can be an order number.
 *
 * Two would match a quantity, a year's last digits, or half a postcode. Real
 * order numbers are long, and a matcher that occasionally attaches a card
 * charge to the wrong order is worse than one that occasionally finds nothing.
 */
const SHORTEST = 3;

/** An ISO day, which is three runs of digits and none of them an order number. */
const ISO_DAY = /\d{4}-\d{2}-\d{2}/g;

/**
 * Every number in a statement line that could be an order number, best first.
 *
 * A number written after a `#` comes first, because that is how a merchant
 * marks one and nothing else on a card line is written that way. Bare runs
 * follow, which is what makes `2008744856, coop .ch` matchable at all.
 *
 * ISO dates are removed before anything is read, so `2026-01-02` cannot offer
 * `2026` as a candidate and collide with an order actually numbered 2026.
 */
export function orderNumbersIn(text: string): string[] {
  const clean = text.replace(ISO_DAY, ' ');
  const hashed = [...clean.matchAll(new RegExp(`#\\s?(\\d{${SHORTEST},})`, 'g'))].map(
    (match) => match[1] as string
  );
  const bare = [...clean.matchAll(new RegExp(`\\d{${SHORTEST},}`, 'g'))].map((match) => match[0]);
  // Hashed first, then everything else, and each number once.
  return [...new Set([...hashed, ...bare])];
}

/**
 * The order a statement line names, or null.
 *
 * `amount` is what the statement charged. Passing it fills in `difference`,
 * which is the only thing worth knowing once the order has been identified.
 */
export function matchOrderForText(
  text: string,
  orders: readonly OrderForMatching[],
  amount?: number
): OrderMatch | null {
  const byNumber = new Map<string, OrderForMatching[]>();
  for (const order of orders) {
    const number = order.orderNumber.trim();
    if (!number) continue;
    byNumber.set(number, [...(byNumber.get(number) ?? []), order]);
  }

  for (const candidate of orderNumbersIn(text)) {
    const found = byNumber.get(candidate);
    const order = found?.[0];
    if (!order) continue;

    return {
      order,
      matchedOn: candidate,
      difference:
        amount === undefined || order.price === null ? null : roundCents(amount - order.price),
      // Two notes filed under one order number is somebody's filing mistake
      // rather than an ambiguity to resolve, and saying so is more use than
      // picking one.
      alsoFits: found.slice(1),
    };
  }

  return null;
}

/** A leg of a split, or a posting, as far as this needs to know. */
export interface LineToMatch {
  text: string;
  amount: number;
}

/**
 * Every line that names an order, with what it would fill in.
 *
 * Returned in the order the lines were given, so a caller can walk its own rows
 * beside the answers rather than looking each one up again.
 */
export function matchOrdersForLines<T extends LineToMatch>(
  lines: readonly T[],
  orders: readonly OrderForMatching[]
): { line: T; match: OrderMatch }[] {
  const found: { line: T; match: OrderMatch }[] = [];
  for (const line of lines) {
    const match = matchOrderForText(line.text, orders, line.amount);
    if (match) found.push({ line, match });
  }
  return found;
}

/**
 * A charge, as much of one as matching an order needs.
 *
 * Both dates are wanted because a card export dates a row twice and the two
 * disagree by a day often enough to matter: Revolut writes the moment the
 * payment started and the moment it settled, and it is the *started* date that
 * falls on the day the order was placed. Matching on the booked date alone puts
 * every Friday-evening order a day out.
 */
export interface ChargeToMatch {
  text: string;
  /** Signed as the statement wrote it: money out is negative. */
  amount: number;
  currency: string | null;
  /** The day the charge was booked, and the day the ledger will carry. */
  date: string;
  /** The day it was begun, when the export says so. */
  valueDate?: string | null;
}

export interface ChargeOrderMatch {
  order: OrderForMatching;
  /** How many days lay between the order and the nearer of the charge's two dates. */
  daysApart: number;
  /** Orders that fit this charge just as well. Empty on a clean match. */
  alsoFits: OrderForMatching[];
}

export interface ChargeMatchOptions {
  /**
   * How many days *after* the order the charge may fall.
   *
   * Six, and the asymmetry is the point. A symmetric window has to stay at
   * three or so, because these orders arrive weekly and a repeat order repeats
   * its price to the cent: at four, a charge three days after one order sits
   * four days before the next and fits both. Real data ran right at that edge
   * -- every Haushaltskonto charge landed exactly three days after its order --
   * so a merchant who settled one day slower would have gone unmatched, and
   * silently, which is the worst way to fail.
   *
   * Time is not symmetric here. Nobody is charged for an order they have not
   * placed, so the whole allowance can be spent on the side the charge can
   * actually be, and none on the side it cannot. Six days late is reachable;
   * the next week's order is not, because it lies in the charge's future.
   */
  window?: number;
  /**
   * How many days before the order a charge may still be dated.
   *
   * One, not zero. The two systems disagree about midnight often enough -- a
   * late-evening order confirmed after the card has already dated the charge --
   * and one day of grace costs nothing that the amount and the merchant do not
   * already have to pay for.
   */
  graceBefore?: number;
  /**
   * Order numbers already paid for, which are not offered again.
   *
   * The reason this parameter exists: an order is bought once, and two charges
   * pointing at one order is the error that no amount of balancing will ever
   * reveal, because both charges are real money that really left the account.
   */
  taken?: ReadonlySet<string>;
}

/** Letters and digits only, lowercased: `TomTasty AG` and `Tom Tasty` become one string. */
function squash(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * True when a charge's text names this company.
 *
 * `mentionsCompany` wants a whole word in common, which is right for an invoice
 * matcher and wrong here: the note says `TomTasty AG` and the card prints
 * `Tom Tasty`, and those share no word at all. So the run-together forms are
 * compared as well, which makes the space the merchant's own systems disagree
 * about stop mattering.
 *
 * Only for names long enough to mean something run together. Below that the
 * substring test starts finding company names inside unrelated words, and the
 * amount and the date cannot be asked to carry a match on their own.
 */
const SHORTEST_SQUASHED = 5;

function namesCompany(text: string, company: string): boolean {
  if (mentionsCompany(text, company)) return true;
  const wanted = squash(company.replace(/\b(ag|sa|gmbh|ltd|inc|bv|nv|plc|llc)\b/gi, ''));
  return wanted.length >= SHORTEST_SQUASHED && squash(text).includes(wanted);
}

/**
 * Days from the order to the charge: positive when the charge came later.
 *
 * Signed rather than absolute, because which of the two came first is the fact
 * that lets the window be generous in the only direction a charge can lie.
 */
function daysAfter(charge: string, order: string): number | null {
  const days = (Date.parse(`${charge}T00:00:00Z`) - Date.parse(`${order}T00:00:00Z`)) / 86400000;
  return Number.isFinite(days) ? Math.round(days) : null;
}

/**
 * The order a card charge paid for, without either one naming the other.
 *
 * The sibling above matches on a number the statement printed. This one exists
 * for the statements that print no number at all: a Revolut line says
 * `Tom Tasty` and a figure, and nothing else. What is left is the merchant, the
 * amount and the day -- the three a person uses when they do this by hand.
 *
 * **The amount is exact and the identifier is weak, which is the reverse of
 * `matchOrderForText`.** So this is deliberately strict where that one is
 * relaxed: the price must agree to the cent, the currency must agree, the
 * merchant must be named, the order must not already have been paid for, and
 * the days must be few. Two orders that survive all of that are reported rather
 * than chosen between, because a repeated weekly order repeats its price and
 * picking the nearer one would be a coin toss dressed as an answer.
 */
export function matchOrderForCharge(
  charge: ChargeToMatch,
  orders: readonly OrderForMatching[],
  options: ChargeMatchOptions = {}
): ChargeOrderMatch | null {
  if (charge.amount >= 0) return null;
  const paid = roundCents(-charge.amount);
  const window = options.window ?? 6;
  const grace = options.graceBefore ?? 1;
  const taken = options.taken ?? new Set<string>();

  const scored: { order: OrderForMatching; daysApart: number }[] = [];
  for (const order of orders) {
    if (taken.has(order.orderNumber)) continue;
    if (order.price === null || roundCents(order.price) !== paid) continue;
    if (order.priceCurrency && charge.currency && order.priceCurrency !== charge.currency) continue;
    if (!order.companyTitle || !namesCompany(charge.text, order.companyTitle)) continue;
    if (!order.orderDate) continue;

    // The nearer of the two dates the export offers. A card row that starts on
    // the order day and settles the next is one day out on one of them and
    // exact on the other, and the exact one is the one that means something.
    const apart = [charge.date, charge.valueDate]
      .filter((day): day is string => !!day)
      .map((day) => daysAfter(day, order.orderDate as string))
      .filter((days): days is number => days !== null)
      .filter((days) => days <= window && days >= -grace);
    if (apart.length === 0) continue;
    const nearest = Math.min(...apart.map((days) => Math.abs(days)));

    scored.push({ order, daysApart: nearest });
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => a.daysApart - b.daysApart || a.order.title.localeCompare(b.order.title));

  const best = scored[0] as { order: OrderForMatching; daysApart: number };
  // Equally near is equally likely. Only a strictly nearer order is a choice
  // rather than a guess.
  const rivals = scored.filter((entry) => entry.daysApart === best.daysApart).slice(1);
  return { order: best.order, daysApart: best.daysApart, alsoFits: rivals.map((r) => r.order) };
}
