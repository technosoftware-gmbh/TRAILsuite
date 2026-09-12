/**
 * What a related-trips block offers as buttons, and in which order.
 *
 * Pure and App-free, and split out of the block for the reason
 * `related-trips.ts` beside it is: the lookup is the part worth testing and
 * the block is DOM building. The defect this exists to make visible is a real
 * one -- the ship's cabin dialog shipped as a command with no button anywhere,
 * and stayed that way through two more entity types, because the answer to
 * "which note types offer which button" lived inside a render nothing could
 * reach.
 *
 * Labels are translation KEYS rather than strings: this module knows what is
 * offered, and the catalogue knows what it is called in each language.
 */

/** Every note type the block draws for. A person is one; the other six are the prospect subjects. */
export type BlockSubjectKind =
  'vehicle' | 'excursion' | 'place' | 'city' | 'state' | 'country' | 'person';

export type BlockAction = 'edit' | 'prospect';

/**
 * The subjects with an editor of their own.
 *
 * A list rather than a condition, because it grows one phase at a time: the
 * five place kinds and the three that hold the hierarchy together have an
 * editor, and the excursion and the vehicle are meant to follow. A kind added
 * here and nowhere else fails the block's own test rather than quietly
 * offering a button that opens nothing.
 */
export const KINDS_WITH_EDITOR: BlockSubjectKind[] = [
  'place',
  'city',
  'state',
  'country',
  'excursion',
  'vehicle',
];

export const BLOCK_ACTION_LABELS: Record<BlockAction, string> = {
  // The same key the card's menu uses for the same act, which is what keeps
  // the two surfaces from drifting into two words for one thing.
  edit: 'modals.common.edit',
  prospect: 'vehicleBrochure.exportButton',
};

/**
 * **Edit, then whatever is specific to the type**, which is the order a
 * gallery card's menu reads in as well: two surfaces showing the same note
 * must not come to disagree about it. See docs/ui-conventions.md.
 *
 * The cover was a third button until the line under a note's title, its
 * picture and its gallery moved inside each editor.
 *
 * A person is offered nothing, and that is a decision rather than a gap -- a
 * page about somebody, printed from their address and their tags, is not a
 * thing this plugin should make, and there is no cover on a Person note to
 * edit either.
 *
 * **A ship no longer has a button of its own for its cabins.** It had one
 * because its dialog was named after them, and that dialog turned out to be
 * the vehicle's editor all along: the facts and the catalogue in one form, on
 * purpose. One note, one Edit button, the same as everything else here.
 */
export function subjectActions(kind: BlockSubjectKind): BlockAction[] {
  if (kind === 'person') return [];
  const actions: BlockAction[] = KINDS_WITH_EDITOR.includes(kind) ? ['edit'] : [];
  actions.push('prospect');
  return actions;
}
