/**
 * What each place form holds.
 *
 * The list is a pure module precisely so this test can exist: the same
 * decision inside the dialog's DOM building is one nothing could reach, which
 * is how two features once shipped through an editor on a green suite.
 */
import { describe, expect, it } from 'vitest';
import { placeEditorFields } from '../src/places/place-editor-fields';
import { TRAVEL_PLACE_TYPES } from '../src/vault/entity-types';

describe('placeEditorFields', () => {
  it('collects only what identifies a place when one is being created', () => {
    for (const kind of TRAVEL_PLACE_TYPES) {
      expect(placeEditorFields(kind, false)).toEqual(['title', 'country', 'city']);
    }
  });

  /** Retitling is an Obsidian rename, which updates every wikilink pointing here. A box in this dialog would not. */
  it('never offers a title box in edit mode, for any kind', () => {
    for (const kind of TRAVEL_PLACE_TYPES) {
      expect(placeEditorFields(kind, true)).not.toContain('title');
    }
  });

  it('offers the shared head to every kind', () => {
    for (const kind of TRAVEL_PLACE_TYPES) {
      expect(placeEditorFields(kind, true).slice(0, 7)).toEqual([
        'country',
        'city',
        'geoLocation',
        'address',
        'website',
        'rating',
        'tags',
      ]);
    }
  });

  it('offers a subtype field to its own kind and to no other', () => {
    expect(placeEditorFields('accommodation', true)).toContain('accommodationType');
    expect(placeEditorFields('accommodation', true)).toContain('accommodationStatus');
    expect(placeEditorFields('accommodation', true)).not.toContain('fnbType');

    expect(placeEditorFields('fnb', true)).toContain('fnbType');
    expect(placeEditorFields('fnb', true)).not.toContain('accommodationType');

    for (const kind of ['landmark', 'location', 'photospot'] as const) {
      expect(placeEditorFields(kind, true)).toEqual([
        'country',
        'city',
        'geoLocation',
        'address',
        'website',
        'rating',
        'tags',
      ]);
    }
  });

  /**
   * Nothing here writes `visited` or `lastVisit`, and the form is where that
   * would first show up as a field somebody could fill in. The writer refuses
   * them as well; this is the other half of the same rule.
   */
  it('offers no field for anything a trip can derive', () => {
    for (const kind of TRAVEL_PLACE_TYPES) {
      const fields: string[] = placeEditorFields(kind, true);
      expect(fields).not.toContain('visited');
      expect(fields).not.toContain('lastVisit');
    }
  });
});
