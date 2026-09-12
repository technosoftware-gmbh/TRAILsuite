/**
 * Ordered, minus what has arrived.
 *
 * The one piece of arithmetic behind two different features: a meal order
 * settled by boxes from the supplier, and a purchase that ships in parts. Both
 * ask the same question in the same moment -- the second box is on the table and
 * somebody wants to know what is still coming -- and both had it answered by
 * subtracting two lists of names and counts.
 *
 * **It is here as a kernel rather than copied**, and `delivery/from-orders.ts`
 * is an adapter over it. That file is older and shipped first, and the reason
 * this did not simply live inside it is that it speaks meals: its item carries
 * a `mealTitle`, which is the right word in a freezer and the wrong one for a
 * bag of birdseed. Nothing about the notes either feature writes changed to
 * make this possible; only the shape the arithmetic is handed.
 *
 * Names are compared the way wikilinks are, trimmed and case-insensitively,
 * because that is how one note refers to another everywhere else here.
 *
 * App-free.
 */

/** A named thing and how many of it. The whole vocabulary this needs. */
export interface Counted {
  name: string;
  /** At least 1. A caller reading a note where the count is omitted supplies 1. */
  quantity: number;
}

const key = (name: string): string => name.trim().toLowerCase();

/**
 * One entry per name, summed, in the order the names first appear.
 *
 * First-appearance order rather than sorted: these fill a list somebody reads
 * against the note they came from, and re-sorting would mean scanning both to
 * find the same line twice.
 */
export function sumCounted(items: readonly Counted[]): Counted[] {
  const totals = new Map<string, Counted>();

  for (const item of items) {
    const existing = totals.get(key(item.name));
    if (existing) existing.quantity += item.quantity;
    else totals.set(key(item.name), { name: item.name, quantity: item.quantity });
  }

  return [...totals.values()];
}

/** How many of each name have arrived, across every consignment. */
export function countsOf(items: readonly Counted[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items)
    counts.set(key(item.name), (counts.get(key(item.name)) ?? 0) + item.quantity);
  return counts;
}

/**
 * What is still waiting: ordered, minus delivered.
 *
 * **A line that has fully arrived drops out rather than showing as zero**,
 * because this fills a list and a row saying "none of this is missing" is a row
 * somebody has to read past. A consignment that over-delivered drops out too:
 * the surplus is real and recorded, and there is nothing outstanding to take
 * from it. Neither is an error -- a box can hold a substitution, and a vendor
 * can send two of something by mistake, and a note that refused to record
 * either would be a note that cannot describe what happened.
 */
export function outstandingOf(
  ordered: readonly Counted[],
  delivered: readonly Counted[]
): Counted[] {
  const arrived = countsOf(delivered);

  const outstanding: Counted[] = [];
  for (const item of sumCounted(ordered)) {
    const remaining = item.quantity - (arrived.get(key(item.name)) ?? 0);
    if (remaining > 0) outstanding.push({ name: item.name, quantity: remaining });
  }
  return outstanding;
}

/**
 * How far along a consignment is, as three states.
 *
 * `none` when nothing has arrived, `all` when nothing is outstanding, `some`
 * between them. Deliberately not four: "over-delivered" is not a state somebody
 * wants a badge for, and it reads as `all`, which is what it is from the point
 * of view of waiting.
 *
 * An order with no lines at all is `none` rather than `all`. A purchase whose
 * items nobody typed says nothing about what arrived, and calling that complete
 * would mark every unlisted purchase delivered.
 */
export type Fulfilment = 'none' | 'some' | 'all';

export function fulfilmentOf(
  ordered: readonly Counted[],
  delivered: readonly Counted[]
): Fulfilment {
  if (ordered.length === 0) return 'none';
  if (delivered.length === 0) return 'none';
  return outstandingOf(ordered, delivered).length === 0 ? 'all' : 'some';
}
