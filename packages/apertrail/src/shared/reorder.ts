/**
 * Moving one row of a list up or down.
 *
 * A swap with its neighbour, which is what an up/down button means and is not
 * the same as removing and reinserting: a swap moves exactly two rows and
 * cannot renumber the rest of the list behind somebody's back.
 *
 * Here rather than inline because there are two callers now -- the itinerary's
 * stops and the trip editor's gallery -- and the interesting part is the edge,
 * where the first row is asked to move up. It returns whether anything moved,
 * so a caller can decline to save rather than writing the note again with the
 * same content in it.
 *
 * Up and down rather than dragging, in both callers. Dragging is better with a
 * mouse and worse with a finger, and this plugin has already shipped one input
 * that did not work on the iPad.
 */
export function moveInList<T>(list: T[], index: number, delta: number): boolean {
  const target = index + delta;
  if (index < 0 || index >= list.length) return false;
  if (target < 0 || target >= list.length) return false;

  [list[index], list[target]] = [list[target], list[index]];
  return true;
}
