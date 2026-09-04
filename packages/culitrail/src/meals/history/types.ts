/**
 * The eating-history record as it is persisted, which is a different shape from
 * the `EatingEntry` the parser hands to a view.
 *
 * The difference is deliberate. A view wants one flat thing to render, merged
 * from wherever it was found. A writer needs the identity (`id`) and the clock
 * time (`date` carries `YYYY-MM-DDTHH:mm`, not just the day), because two
 * people eating the same dinner are two records on one day and editing one of
 * them must not touch the other.
 */

export interface EatingRecord {
  /**
   * Stable, and separate from the date because the date is itself editable.
   * Matching on date would silently collide the moment two records shared one.
   */
  id: string;
  /** `YYYY-MM-DDTHH:mm`. The day alone loses the ordering of two cooks on one date. */
  date: string;
  /** `[[Person Title]]`, so Obsidian's own rename tracking keeps it correct. */
  personLink?: string;
  /**
   * 0 to 5, or absent.
   *
   * Unlike a meal's own rating, where 0 and unset are the same thing, a
   * record can carry a real 0: "I made this and did not like it" is different
   * information from "I have not rated this cook."
   */
  rating?: number;
  note: string;
}
