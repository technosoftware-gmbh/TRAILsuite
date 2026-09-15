/**
 * What the trip comes to for each person on it.
 *
 * **From the itinerary's own lines, never from the budget.** A line already
 * says who it is for -- the people it names, or everybody on the trip -- and
 * that is the only statement in a note that can divide money between people.
 * A double room for two is half each; an excursion only one of three takes is
 * charged to that one. A category budget names nobody, and splitting it evenly
 * would print a share nobody stated, so it is left out here and stays in the
 * planned-by-category table beside this one. Thomas decided it on 15 September
 * 2026.
 *
 * **Planned lines only.** An extra nobody has taken is a price rather than
 * money anybody will spend, the same rule `plannedEstimates()` holds for every
 * other total; one somebody has taken counts for the people it names.
 *
 * **One currency in the sum.** A share in another currency is listed with its
 * own currency and left out of the person's total, the rule every total on the
 * trip document follows, rather than converted at a rate nobody stated.
 *
 * Pure: no Obsidian import, no clock.
 */
import { caseFold, roundCents } from '@technosoftware/trail-core';
import { BookingCategory } from './booking-note';
import { CostUnit } from './line-cost';
import { ItemEstimate, plannedEstimates } from './estimates';

/** One line of a person's share. */
export interface PersonShareItem {
  label: string;
  category: BookingCategory;
  /** This person's part of the line. */
  amount: number;
  currency: string | null;
  /** What the whole line comes to, for the row that says what it is a part of. */
  lineAmount: number;
  /** How many people the line is divided between. One for a line only this person is on. */
  sharedBy: number;
  unit: CostUnit;
}

export interface PersonShare {
  person: string;
  items: PersonShareItem[];
  /** The items in the trip's own currency, added up. Null when none of them is. */
  total: number | null;
  /** True when some item is in another currency and so not in `total`. */
  partial: boolean;
}

/**
 * Each person's share, in the order the trip lists its participants, then
 * anybody a line names who is not among them.
 *
 * Empty for a trip on which nobody is named at all: a share for "nobody in
 * particular" is the planned total again, and the section would say nothing
 * the table above it does not.
 */
export function perPersonShares(
  estimates: readonly ItemEstimate[],
  participants: readonly string[],
  currency: string
): PersonShare[] {
  const order: string[] = [];
  const byKey = new Map<string, PersonShare>();
  const person = (name: string): PersonShare => {
    const key = caseFold(name);
    let share = byKey.get(key);
    if (!share) {
      share = { person: name, items: [], total: null, partial: false };
      byKey.set(key, share);
      order.push(key);
    }
    return share;
  };
  for (const name of participants) person(name);

  const home = caseFold(currency);
  for (const estimate of plannedEstimates(estimates)) {
    // The same name twice on one line is one person, not a bigger divisor.
    const names = [...new Map(estimate.persons.map((name) => [caseFold(name), name])).values()];
    if (names.length === 0) continue;
    const part = roundCents(estimate.amount / names.length);
    for (const name of names) {
      const share = person(name);
      share.items.push({
        label: estimate.label,
        category: estimate.category,
        amount: part,
        currency: estimate.currency,
        lineAmount: estimate.amount,
        sharedBy: names.length,
        unit: estimate.cost.unit,
      });
      if (estimate.currency === null || caseFold(estimate.currency) === home) {
        share.total = roundCents((share.total ?? 0) + part);
      } else {
        share.partial = true;
      }
    }
  }

  return order
    .map((key) => byKey.get(key))
    .filter((share): share is PersonShare => share !== undefined);
}

/**
 * Whether the names a line carries are somebody other than the whole trip.
 *
 * A line naming exactly the participants says nothing a reader needs told, so
 * the document prints a name beside a line only where this is true. Compared
 * as sets through `caseFold`, so the order and the spelling of the case do not
 * make a line look special.
 */
export function namesSomebodyElse(
  persons: readonly string[],
  participants: readonly string[]
): boolean {
  if (persons.length === 0) return false;
  const line = new Set(persons.map((name) => caseFold(name)));
  const trip = new Set(participants.map((name) => caseFold(name)));
  if (line.size !== trip.size) return true;
  return [...line].some((name) => !trip.has(name));
}
