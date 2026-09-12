/**
 * Which fields the place editor draws, for which kind, in which mode.
 *
 * A list rather than a run of `if` statements inside the dialog, for the
 * reason `trips/related-trips-actions.ts` was pulled out of its block: a
 * decision taken while building DOM is a decision no test can reach, and this
 * package has already shipped two features through an editor that had none.
 * The rendering stays in the modal; what belongs in each form does not.
 */
import { TravelPlaceType } from '../vault/entity-types';

export type PlaceEditorField =
  | 'title'
  | 'country'
  | 'city'
  | 'geoLocation'
  | 'address'
  | 'website'
  | 'rating'
  | 'tags'
  | 'accommodationType'
  | 'accommodationStatus'
  | 'fnbType';

/**
 * Creation collects what identifies a place; editing collects the rest.
 *
 * That split is `createPhotoSpotNote()`'s own argument, carried over rather
 * than re-decided: a place you just heard about is worth a note before you
 * know anything else about it, and a dialog asking for ten fields at that
 * moment is a dialog somebody closes.
 *
 * **No title row in edit mode.** Retitling a place is an Obsidian rename,
 * which updates every wikilink pointing at it; a box here would either break
 * those links or duplicate something the app does better.
 */
export function placeEditorFields(kind: TravelPlaceType, editMode: boolean): PlaceEditorField[] {
  if (!editMode) return ['title', 'country', 'city'];

  const fields: PlaceEditorField[] = [
    'country',
    'city',
    'geoLocation',
    'address',
    'website',
    'rating',
    'tags',
  ];
  // Each subtype field belongs to one kind and appears on no other form. The
  // writer draws the same line, so a landmark can neither be given one here
  // nor lose one it was carrying.
  if (kind === 'accommodation') fields.push('accommodationType', 'accommodationStatus');
  if (kind === 'fnb') fields.push('fnbType');
  return fields;
}
