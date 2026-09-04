/**
 * What a figure on an itinerary line actually comes to.
 *
 * A trip with two people needs two flights and a room the two of them are in,
 * so a bare amount on a line is ambiguous: an airline quotes per passenger, a
 * hotel quotes per room per night, a museum quotes per head. The line
 * therefore states what its number is per, and this file does the one
 * multiplication that follows.
 *
 * Nothing here is ever written back into a note. The multiplication is redone
 * on every render, so adding a third traveller to a trip corrects every line
 * that did not name people, and the row shows its working rather than asking
 * to be trusted.
 *
 * Pure: no Obsidian import, no clock. See
 * docs/design/trip-budget-and-bookings.md §16.
 */

/** The fixed vocabulary. Values, not settings: they are written into notes and read back by name. */
export const COST_UNITS = ['total', 'person', 'night', 'personNight'] as const;
export type CostUnit = (typeof COST_UNITS)[number];

/**
 * What a hand-written line means when it says nothing.
 *
 * `total` rather than the unit the line type is usually quoted in, because a
 * bare number somebody typed must not silently multiply into something larger
 * than they meant. The editors default their select to the likely unit
 * instead, so a line made through the UI always says which it is.
 */
export const FALLBACK_COST_UNIT: CostUnit = 'total';

export function parseCostUnit(value: string | null | undefined): CostUnit {
  const found = COST_UNITS.find((unit) => unit === value?.trim());
  return found ?? FALLBACK_COST_UNIT;
}

/** Which units a line of this kind is offered, in the order the editor lists them. */
export function costUnitsFor(kind: 'stop' | 'night' | 'leg'): CostUnit[] {
  return kind === 'night' ? ['night', 'total', 'person', 'personNight'] : ['person', 'total'];
}

/**
 * Nights between two dates, or null where the stay does not say.
 *
 * Null rather than 1, so a caller can tell "one night" from "no idea" and say
 * so. Both are dates without clock times, which is what a stay carries.
 */
export function nightsBetween(checkIn: string | null, checkOut: string | null): number | null {
  const from = Date.parse(`${(checkIn ?? '').slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${(checkOut ?? '').slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  const nights = Math.round((to - from) / 86_400_000);
  return nights > 0 ? nights : null;
}

/**
 * Nights between two days of the trip, or null where the stay does not say.
 *
 * The same count as between the dates those days resolve to, and knowable
 * without them: day 3 to day 5 is two nights whether or not anybody has fixed
 * a departure yet. Which is the point -- a trip still being written as twelve
 * numbered days can already price a three-night stay, and a budget that went
 * blank until the dates were set would be blank exactly when it is most
 * useful.
 */
export function nightsBetweenDays(
  checkInDay: number | null | undefined,
  checkOutDay: number | null | undefined
): number | null {
  if (
    checkInDay === null ||
    checkInDay === undefined ||
    checkOutDay === null ||
    checkOutDay === undefined
  ) {
    return null;
  }
  const nights = checkOutDay - checkInDay;
  return nights > 0 ? nights : null;
}

/** Who a line is for: the people it names, or everybody on the trip, which is what naming nobody means. */
export function lineTravellers(persons: string[], participants: string[]): string[] {
  return persons.length > 0 ? persons : participants;
}

export interface LineCost {
  /** What the line comes to: the stated figure times its multiplier. Null when nobody has priced it. */
  amount: number | null;
  /** The figure as the note states it, kept so a row can show the sum rather than only its answer. */
  unitAmount: number | null;
  unit: CostUnit;
  multiplier: number;
  people: number;
  /** Nights the multiplication used, and null where the stay states none, in which case it counted once. */
  nights: number | null;
}

export interface LineCostInput {
  cost: number | null;
  unit: CostUnit;
  /** The people this line names. Empty means everybody on the trip. */
  persons: string[];
  participants: string[];
  /** The stay's own dates, for a per-night figure. Absent on a stop or a leg. */
  checkIn?: string | null;
  checkOut?: string | null;
  /** The stay's own days of the trip, for a stay on a trip that has no dates yet. */
  checkInDay?: number | null;
  checkOutDay?: number | null;
}

/**
 * The line's total, and everything the row needs to explain it.
 *
 * A party of nobody counts as one: a trip that lists no participants is a
 * trip somebody took alone, and multiplying its flights by zero would report
 * a free holiday.
 */
export function lineCost(input: LineCostInput): LineCost {
  const people = Math.max(1, lineTravellers(input.persons, input.participants).length);
  // Day numbers first: a stay that carries them is relative, and its dates
  // are either absent or a leftover from before it was made so. Neither
  // pair needs the trip's departure, because a night count is a difference
  // and a difference does not care where the counting started.
  const nights =
    nightsBetweenDays(input.checkInDay, input.checkOutDay) ??
    nightsBetween(input.checkIn ?? null, input.checkOut ?? null);
  const perNight = nights ?? 1;

  const multiplier =
    input.unit === 'person'
      ? people
      : input.unit === 'night'
        ? perNight
        : input.unit === 'personNight'
          ? people * perNight
          : 1;

  return {
    amount: input.cost === null ? null : Math.round(input.cost * multiplier * 100) / 100,
    unitAmount: input.cost,
    unit: input.unit,
    multiplier,
    people,
    nights,
  };
}
