/**
 * Everything this plugin can open an editor for, as one union.
 *
 * Every surface that offers editing -- a gallery card's menu, a
 * related-trips block -- had begun to grow one branch and one callback per
 * kind, and one more was due with every phase. A union means a new kind is a
 * member here and a case in one switch, rather than a field on the gallery
 * row, a dependency on the view, a method on the plugin and a branch in two
 * places.
 *
 * The record is the one the board already read. Nothing here re-reads the
 * vault to find a note somebody is looking at.
 */
import {
  TravelCity,
  TravelCountry,
  TravelExcursion,
  TravelPlace,
  TravelState,
  TravelVehicle,
} from './types';

/** The three notes that hold the geographic hierarchy together. */
export type EditableRegion =
  | { kind: 'country'; record: TravelCountry }
  | { kind: 'state'; record: TravelState }
  | { kind: 'city'; record: TravelCity };

export type EditableEntity =
  | { kind: 'place'; record: TravelPlace }
  | EditableRegion
  | { kind: 'excursion'; record: TravelExcursion }
  | { kind: 'vehicle'; record: TravelVehicle };

/** Whether a subject is one of the three regions, which is the question the region editor asks before it takes one. */
export function isEditableRegion(subject: EditableEntity): subject is EditableRegion {
  return subject.kind === 'country' || subject.kind === 'state' || subject.kind === 'city';
}

/**
 * The end of a run of checks over `EditableEntity`, which fails to compile
 * when a kind has been added to the union and not handled above it.
 *
 * The point is the compile error, not the throw: without this the last
 * `if` in such a run quietly becomes the default, and a kind added later
 * opens whatever editor happens to be written last. The comment claiming a
 * new kind "fails to compile" was written before this existed, which is how
 * a comment becomes the only thing enforcing a rule.
 */
export function assertEveryEditableHandled(subject: never): never {
  throw new Error(`No editor for ${JSON.stringify(subject)}`);
}
