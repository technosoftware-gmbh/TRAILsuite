/**
 * Which meals the picker offers first.
 *
 * **Sorted to the top, not filtered to.** The freezer holds more than the last
 * box: something from the delivery before it is still there, and a filter would
 * make that meal unreachable from the picker that is supposed to plan it. What
 * arrived most recently is what somebody is most likely to be planning, which is
 * an argument about order and nothing more.
 *
 * A stable partition rather than a sort, so the library's own order survives
 * inside each half. `readNotesOfType` returns meals in a settled order and a
 * comparator that only knows about delivery would shuffle the rest of them for
 * no reason.
 *
 * App-free.
 */

/** Marks a choice as having been in the most recent delivery. */
export interface DeliveredFlag {
  delivered: boolean;
}

/**
 * The same choices, flagged and reordered: delivered first, everything after.
 *
 * `delivered` is a lower-cased set of meal titles, which is what
 * `lastDeliveredTitles` produces. Matching on the title rather than the path is
 * deliberate: a delivery note names meals as wikilinks, and a link is a title.
 */
export function deliveredFirst<T extends { label: string }>(
  choices: readonly T[],
  delivered: ReadonlySet<string>
): (T & DeliveredFlag)[] {
  const flagged = choices.map((choice) => ({
    ...choice,
    delivered: delivered.has(choice.label.trim().toLowerCase()),
  }));

  return [...flagged.filter((choice) => choice.delivered), ...flagged.filter((c) => !c.delivered)];
}
