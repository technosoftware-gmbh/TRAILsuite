/**
 * Who paid, who owes, and the shortest way to square it.
 *
 * Derived at read time and written nowhere. That is the whole answer to the
 * objection the Trip redesign raised against money ("who owes whom"): a
 * balance that lives in a note goes stale the moment a booking changes, and
 * a balance recomputed on every render cannot.
 *
 * Shares are equal within a booking. Unequal shares need a second list of
 * maps on a note that has none, and the cases they solve are usually two
 * bookings anyway. See docs/design/trip-budget-and-bookings.md §5.4.
 *
 * Pure: no Obsidian import, no clock.
 */
import { roundCents } from 'trail-core';
import { ParsedBooking } from './booking-note';
import { lineCurrency } from './totals';

export interface PersonBalance {
  person: string;
  /** What they put in, in the trip's currency. */
  paid: number;
  /** Their share of what was spent on them. */
  owed: number;
  /** paid - owed. Positive means the trip owes them. */
  balance: number;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export interface Settlement {
  balances: PersonBalance[];
  transfers: Transfer[];
  /** How many people actually paid for something. One payer needs a sentence, not a table. */
  payerCount: number;
  /** Bookings left out because the trip cannot convert their currency, so a caller can say so rather than quietly under-reporting. */
  unconvertedCurrencies: string[];
}

export interface SettlementInput {
  bookings: ParsedBooking[];
  /** The trip's participants, used for a booking that names nobody in particular. */
  participants: string[];
  currency: string;
  rates: { currency: string; rate: number }[];
}

/**
 * The settlement for one trip.
 *
 * A booking with no payer still counts toward what people consumed: it
 * lowers everybody's balance evenly rather than pretending it was free. A
 * booking whose currency the trip cannot convert is left out entirely and
 * named, because a settlement that silently ignored a third of the spending
 * would be worse than one that admits its gap.
 */
export function tripSettlement(input: SettlementInput): Settlement {
  const { bookings, participants, currency, rates } = input;

  const rateFor = (code: string): number | null => {
    if (code === currency) return 1;
    const found = rates.find((rate) => rate.currency.toUpperCase() === code.toUpperCase());
    return found && Number.isFinite(found.rate) && found.rate > 0 ? found.rate : null;
  };

  const paid = new Map<string, number>();
  const owed = new Map<string, number>();
  const add = (map: Map<string, number>, person: string, amount: number): void => {
    map.set(person, (map.get(person) ?? 0) + amount);
  };

  const unconverted = new Set<string>();

  for (const booking of bookings) {
    if (booking.status === 'cancelled') continue;
    // A refund is a booking that cost nothing in the end. It stays on the
    // sheet and out of the arithmetic.
    const stated = booking.status === 'refunded' ? 0 : booking.amount;
    if (stated === null) continue;

    const code = lineCurrency(booking, currency);
    const rate = rateFor(code);
    if (rate === null) {
      unconverted.add(code);
      continue;
    }

    const amount = stated * rate;
    if (booking.payerTitle) add(paid, booking.payerTitle, amount);

    // Nobody named means everybody on the trip, which is the common case and
    // should not have to be typed on every booking.
    const beneficiaries = booking.forTitles.length > 0 ? booking.forTitles : participants;
    if (beneficiaries.length === 0) continue;

    const share = amount / beneficiaries.length;
    for (const person of beneficiaries) add(owed, person, share);
  }

  const everyone = [...new Set([...participants, ...paid.keys(), ...owed.keys()])];

  const balances: PersonBalance[] = everyone
    .map((person) => {
      const put = roundCents(paid.get(person) ?? 0);
      const took = roundCents(owed.get(person) ?? 0);
      return { person, paid: put, owed: took, balance: roundCents(put - took) };
    })
    .sort((a, b) => b.balance - a.balance);

  absorbRoundingResidual(balances);

  return {
    balances,
    transfers: transfersFor(balances),
    payerCount: [...paid.values()].filter((amount) => amount > 0).length,
    unconvertedCurrencies: [...unconverted].sort(),
  };
}

/**
 * Makes the balances sum to zero.
 *
 * They do not, on their own: 100 split three ways is 33.33 each and 66.67
 * for the person who paid, which is a cent more than the other two owe. Left
 * alone that cent has nowhere to go, and the transfers below come out a cent
 * short of a balance the same screen is showing. Somebody notices, once, and
 * stops trusting the whole table.
 *
 * The residual lands on the largest balance, which is the standard answer
 * and the one where a cent is least visible.
 */
function absorbRoundingResidual(balances: PersonBalance[]): void {
  const residual = roundCents(balances.reduce((sum, entry) => sum + entry.balance, 0));
  if (residual === 0 || balances.length === 0) return;

  // Only a residual small enough to BE rounding is absorbed. Balances that
  // genuinely do not sum to zero are a fact about the trip, not an artifact:
  // a booking nobody paid leaves everybody owing, and flattening that into
  // one person's column would invent a payer. Half a cent per person is the
  // most that rounding can produce.
  if (Math.abs(residual) > 0.01 * balances.length) return;

  const biggest = balances.reduce((worst, entry) =>
    Math.abs(entry.balance) >= Math.abs(worst.balance) ? entry : worst
  );
  biggest.balance = roundCents(biggest.balance - residual);
}

/**
 * The smallest set of payments that clears the balances.
 *
 * Greedy: the deepest debtor pays the largest creditor, repeat. It is not
 * provably minimal for every shape (that problem is NP-hard), and it is
 * within one transfer of it for the sizes a trip has. What it must be is
 * exact, so the last transfer absorbs the rounding rather than spreading it:
 * a settlement that leaves somebody one cent short is a settlement people
 * stop trusting.
 */
function transfersFor(balances: PersonBalance[]): Transfer[] {
  const creditors = balances
    .filter((entry) => entry.balance > 0)
    .map((entry) => ({ person: entry.person, amount: entry.balance }));
  const debtors = balances
    .filter((entry) => entry.balance < 0)
    .map((entry) => ({ person: entry.person, amount: -entry.balance }));

  const transfers: Transfer[] = [];
  let c = 0;
  let d = 0;

  while (c < creditors.length && d < debtors.length) {
    const amount = roundCents(Math.min(creditors[c].amount, debtors[d].amount));
    if (amount > 0) {
      transfers.push({ from: debtors[d].person, to: creditors[c].person, amount });
      creditors[c].amount = roundCents(creditors[c].amount - amount);
      debtors[d].amount = roundCents(debtors[d].amount - amount);
    }
    // A cent of tolerance on each side: two balances that differ by rounding
    // are settled, and chasing the difference would emit a 0.00 transfer.
    if (creditors[c].amount <= 0.005) c += 1;
    if (debtors[d].amount <= 0.005) d += 1;
  }

  return transfers;
}
