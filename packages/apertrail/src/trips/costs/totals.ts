/**
 * What a trip's bookings add up to.
 *
 * The whole feature rests on three rules, and every one of them exists
 * because of a way a money display can lie.
 *
 * **A total over lines that carry no amount is null, never zero.** A trip
 * whose bookings nobody has priced has no total; showing it a confident 0.00
 * beside a budget of 1500 would read as a plugin that had lost the money.
 * The same rule `trail-core`'s `computedOrderTotal()` returns null for, and
 * for the same reason.
 *
 * **Currencies are never summed.** A trip with francs and euros has two
 * totals. A single figure appears only where the trip itself states a rate,
 * and it is labelled with the rate it used. The plugin never invents one.
 *
 * **Nothing here is written back.** Every figure is derived at read time
 * from the bookings, so it cannot go stale and cannot disagree with the
 * notes.
 *
 * Pure: no Obsidian import, no clock. See
 * docs/design/trip-budget-and-bookings.md §5.
 */
import { roundCents } from '@technosoftware/trail-core';
import { BOOKING_CATEGORIES, BookingCategory, ParsedBooking } from './booking-note';

/** A booking with its currency already resolved through the note, the trip and the setting. */
export interface CostLine {
  booking: ParsedBooking;
  currency: string;
}

export interface CategoryTotal {
  category: BookingCategory;
  /** What the plan allows, in the trip's own currency. Null for a category nobody budgeted. */
  planned: number | null;
  /** Estimated, booked and paid together: what it is going to cost on current evidence. */
  committed: number | null;
  /** What has actually left the account. */
  paid: number | null;
  /** planned - committed, in the trip's currency, or null when either half is missing. */
  variance: number | null;
}

export interface CurrencyTotal {
  currency: string;
  committed: number;
  paid: number;
  /** The same committed figure in the trip's currency, when the trip states a rate for it. */
  convertedCommitted: number | null;
  /** The rate that conversion used, as the trip states it. Null when there is none. */
  rate: number | null;
}

export interface TripCostTotals {
  /** The trip's own currency: what the budget is in, and what conversions land in. */
  currency: string;
  byCategory: CategoryTotal[];
  byCurrency: CurrencyTotal[];
  /** Committed across every currency the trip could convert, plus everything already in its own. Null when nothing is priced. */
  committedConverted: number | null;
  paidConverted: number | null;
  plannedTotal: number | null;
  /** Currencies with figures but no rate, so a caller can say which part of the total is missing. */
  unconvertedCurrencies: string[];
  /** How many bookings sit in each status, so a trip full of `booked` and empty of `paid` looks like what it is. */
  statusCounts: Record<string, number>;
}

/**
 * Which statuses count toward which total.
 *
 * `estimate` counts as committed deliberately: a budget that only counts
 * what is already booked reads as comfortable right up to the moment it is
 * not. `cancelled` counts nowhere. `refunded` counts as zero and stays
 * visible, which is why it is here rather than filtered out earlier.
 */
function committedAmount(booking: ParsedBooking): number | null {
  if (booking.status === 'cancelled') return null;
  if (booking.status === 'refunded') return 0;
  return booking.amount;
}

function paidAmount(booking: ParsedBooking): number | null {
  if (booking.status === 'refunded') return 0;
  return booking.status === 'paid' ? booking.amount : null;
}

/**
 * Sums what is there, and answers null when nothing is.
 *
 * The nullable is the point: `[]` and `[null, null]` both mean "no evidence"
 * rather than "nothing was spent".
 */
function sumOrNull(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  return roundCents(present.reduce((total, value) => total + value, 0));
}

export interface BudgetLine {
  category: BookingCategory;
  amount: number;
}

export interface TripRate {
  currency: string;
  /** How many units of the trip's currency one unit of this one costs, as the user typed it. */
  rate: number;
}

export interface TripCostInput {
  bookings: ParsedBooking[];
  budget: BudgetLine[];
  rates: TripRate[];
  /** The trip's currency, already resolved through `tripCurrency` and the `homeCurrency` setting. */
  currency: string;
}

/**
 * One trip's committed total, for a card that has room for a figure and not
 * for an explanation.
 *
 * Null when there is nothing to total, which is what keeps a card from
 * showing 0.00 for every trip nobody has priced.
 */
export function committedForCard(
  input: TripCostInput
): { committed: number | null; currency: string } | null {
  if (input.bookings.length === 0) return null;
  const totals = tripCostTotals(input);
  return { committed: totals.committedConverted, currency: totals.currency };
}

/** A booking's currency: its own, then the trip's. The chain exists so a single-currency trip types a currency exactly zero times. */
export function lineCurrency(booking: ParsedBooking, tripCurrency: string): string {
  return booking.currency ?? tripCurrency;
}

/**
 * Everything the costs block and the dashboard tile read.
 *
 * One pass, one shape, so two surfaces cannot disagree about the same trip:
 * the same reason CULItrail's order card and its invoice both go through
 * `trail-core`'s order totals.
 */
export function tripCostTotals(input: TripCostInput): TripCostTotals {
  const { bookings, budget, rates, currency } = input;

  const rateFor = (code: string): number | null => {
    if (code === currency) return 1;
    const found = rates.find((rate) => rate.currency.toUpperCase() === code.toUpperCase());
    return found && Number.isFinite(found.rate) && found.rate > 0 ? found.rate : null;
  };

  const byCategory: CategoryTotal[] = BOOKING_CATEGORIES.map((category) => {
    const inCategory = bookings.filter((booking) => booking.category === category);
    const planned = sumOrNull(
      budget.filter((line) => line.category === category).map((line) => line.amount)
    );

    // Converted on the way in, so a category total is one figure in the
    // trip's currency rather than a per-currency breakdown nobody asked a
    // category for. A booking whose currency has no rate is left out of the
    // category figure entirely rather than added at parity, which would be
    // an invented rate of 1.
    const converted = (amount: (booking: ParsedBooking) => number | null) =>
      sumOrNull(
        inCategory.map((booking) => {
          const value = amount(booking);
          if (value === null) return null;
          const rate = rateFor(lineCurrency(booking, currency));
          return rate === null ? null : value * rate;
        })
      );

    const committed = converted(committedAmount);
    const paid = converted(paidAmount);

    return {
      category,
      planned,
      committed,
      paid,
      // Null rather than a variance against zero: "unbudgeted" and "over
      // budget by everything" are different statements and only one is true.
      variance: planned === null || committed === null ? null : roundCents(planned - committed),
    };
  });

  const currencies = [
    ...new Set(bookings.map((booking) => lineCurrency(booking, currency))),
  ].sort();

  const byCurrency: CurrencyTotal[] = currencies
    .map((code) => {
      const inCurrency = bookings.filter((booking) => lineCurrency(booking, currency) === code);
      const committed = sumOrNull(inCurrency.map(committedAmount));
      const paid = sumOrNull(inCurrency.map(paidAmount));
      const rate = rateFor(code);

      return {
        currency: code,
        committed: committed ?? 0,
        paid: paid ?? 0,
        convertedCommitted:
          committed === null || rate === null ? null : roundCents(committed * rate),
        rate: code === currency ? null : rate,
        priced: committed !== null || paid !== null,
      };
    })
    // A currency nobody has priced anything in is not a currency this trip
    // spends in; it is a booking somebody has not filled in yet.
    .filter((entry) => entry.priced)
    .map(({ priced: _priced, ...entry }) => entry);

  const convertible = byCurrency.filter((entry) => entry.convertedCommitted !== null);

  return {
    currency,
    byCategory,
    byCurrency,
    committedConverted: sumOrNull(convertible.map((entry) => entry.convertedCommitted)),
    paidConverted: sumOrNull(
      convertible.map((entry) => {
        const rate = rateFor(entry.currency);
        return rate === null ? null : entry.paid * rate;
      })
    ),
    plannedTotal: sumOrNull(budget.map((line) => line.amount)),
    unconvertedCurrencies: byCurrency
      .filter((entry) => entry.convertedCommitted === null)
      .map((entry) => entry.currency),
    statusCounts: bookings.reduce<Record<string, number>>((counts, booking) => {
      counts[booking.status] = (counts[booking.status] ?? 0) + 1;
      return counts;
    }, {}),
  };
}
