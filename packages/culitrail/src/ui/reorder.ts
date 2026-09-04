/**
 * Reordering an editable list.
 *
 * Its own module because `list-editor.ts` imports Obsidian and so cannot be
 * loaded under Node, and this is the half worth testing: the order of most of
 * the lists it serves is load-bearing (a badge row's layout, a mode's rule
 * weighting, the order a label prints its nutrients in), so an off-by-one here
 * would silently retune every mode in a vault.
 *
 * App-free.
 */

/** A copy of the list with one entry moved. Pure, so a caller can compare before and after. */
export function moved<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }

  const next = [...items];
  const [entry] = next.splice(from, 1);
  next.splice(to, 0, entry);
  return next;
}
