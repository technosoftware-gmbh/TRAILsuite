/**
 * Which fields the country, state and city editor draws, for which kind, in
 * which mode.
 *
 * A list rather than a run of `if` statements inside the dialog, for the
 * reason `place-editor-fields.ts` beside it gives: a decision taken while
 * building DOM is a decision no test can reach.
 *
 * The same split creation and editing take everywhere in this plugin.
 * Creating a region collects what places it in the hierarchy, because that is
 * what a note needs to be found by; the capital, the coordinates and the tags
 * are things somebody fills in once the note exists.
 *
 * **No title row in edit mode**, the rule every editor here follows:
 * retitling is an Obsidian rename, which updates every wikilink pointing at
 * the note.
 */
import { RegionKind } from './write-region';

export type RegionEditorField = 'title' | 'country' | 'state' | 'capital' | 'geoLocation' | 'tags';

export function regionEditorFields(kind: RegionKind, editMode: boolean): RegionEditorField[] {
  if (!editMode) {
    if (kind === 'country') return ['title'];
    if (kind === 'state') return ['title', 'country'];
    return ['title', 'country', 'state'];
  }

  // The capital is a City, so a country's and a state's editor point down at
  // one. That is the one downward link any of these notes carries, and it is
  // a single note rather than a list, which is why it does not run into the
  // rule that keeps `states:` and `cities:` unwritten.
  if (kind === 'country') return ['capital'];
  if (kind === 'state') return ['country', 'capital'];
  return ['country', 'state', 'geoLocation', 'tags'];
}
