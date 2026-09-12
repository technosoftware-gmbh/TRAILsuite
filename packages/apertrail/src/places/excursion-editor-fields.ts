/**
 * Which fields the excursion editor draws, in which mode.
 *
 * Pure, for the reason `place-editor-fields.ts` and `region-editor-fields.ts`
 * are: a decision taken while building DOM is one no test can reach.
 *
 * Creation asks for the three things that were already asked for -- who runs
 * it, how long it takes, where it is offered -- because that is what tells a
 * tour apart from another tour. Editing adds the website.
 *
 * **The description is not here, and that is not an omission.** The line
 * under the title belongs to the note cover's dialog, which owns it for every
 * note that has one; a second box for it here would be two places to change
 * one sentence. The long version is the note body, which Obsidian edits
 * better than any dialog.
 *
 * **The country is not here either.** It comes from the city: a tour offered
 * in Stavanger is in Norway, and asking twice would let the two answers
 * disagree.
 */
export type ExcursionEditorField = 'title' | 'city' | 'operator' | 'duration' | 'website';

export function excursionEditorFields(editMode: boolean): ExcursionEditorField[] {
  if (!editMode) return ['title', 'city', 'operator', 'duration'];
  return ['city', 'operator', 'duration', 'website'];
}
