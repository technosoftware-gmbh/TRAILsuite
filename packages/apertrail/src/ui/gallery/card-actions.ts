/**
 * What a gallery card's 3-dot menu offers for one row.
 *
 * Pure, and separate from the view for the reason
 * `trips/related-trips-actions.ts` is separate from its block: the order and
 * the presence of these entries is a decision, and a decision taken inside
 * DOM building is one no test can reach.
 *
 * **Edit, then the page this note prints**, which is the order the
 * related-trips block already reads in. Two surfaces showing the same note
 * must not come to disagree about it, and the block is the one that had both
 * entries first.
 *
 * The cover used to be a third, because the line under a note's title, its
 * picture and its gallery were a dialog of their own; they are a section
 * inside each editor now.
 */
export type CardAction = 'editTrip' | 'edit' | 'tripDocument' | 'prospect';

/**
 * What each entry is called.
 *
 * **Every edit entry says only "Edit".** It said "Edit trip" on a trip's card,
 * because that string is the itinerary block's own button and the two shared
 * one key. They are not the same surface: the block's button sits in a note
 * among other notes' blocks and earns the word, while this menu was opened on
 * one card, so the card has already said which note it means. One word covers
 * a trip, a hotel, a city and a country without four strings that would then
 * have to be kept in step.
 *
 * The two printed pages keep their own words, because they are two different
 * documents: a prospect is one page about one note and a trip document is the
 * route across a dozen. Both keys are the block's and the trip editor's own,
 * so a card and a note cannot end up offering one thing under two names.
 */
export const CARD_ACTION_LABELS: Record<CardAction, string> = {
  editTrip: 'modals.common.edit',
  edit: 'modals.common.edit',
  tripDocument: 'tripDocument.exportButton',
  prospect: 'vehicleBrochure.exportButton',
};

export interface CardActionSubject {
  /** The row is a trip, which has an editor of its own and a printed page of its own. */
  isTrip: boolean;
  /**
   * The row is one of the six the prospect prints: a place, a country, a
   * state, a city, an excursion or a vehicle.
   *
   * One flag rather than two, because those six are exactly the notes with an
   * editor and exactly the notes with a prospect. A seventh that had one and
   * not the other would be a reason to split it, and inventing the split
   * first would be inventing a case nothing has.
   */
  hasEditor: boolean;
}

export function cardActions(subject: CardActionSubject): CardAction[] {
  const actions: CardAction[] = [];
  if (subject.isTrip) actions.push('editTrip', 'tripDocument');
  if (subject.hasEditor) actions.push('edit', 'prospect');
  return actions;
}
