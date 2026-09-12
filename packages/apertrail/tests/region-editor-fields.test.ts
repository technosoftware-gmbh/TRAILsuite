/**
 * What each of the three hierarchy forms holds.
 *
 * Pure so that it can be checked at all, the move `place-editor-fields.ts`
 * made first.
 */
import { describe, expect, it } from 'vitest';
import { regionEditorFields } from '../src/places/region-editor-fields';
import { RegionKind } from '../src/places/write-region';

const KINDS: RegionKind[] = ['country', 'state', 'city'];

describe('regionEditorFields', () => {
  it('collects what places a note in the hierarchy when one is being created', () => {
    expect(regionEditorFields('country', false)).toEqual(['title']);
    expect(regionEditorFields('state', false)).toEqual(['title', 'country']);
    expect(regionEditorFields('city', false)).toEqual(['title', 'country', 'state']);
  });

  it('never offers a title box in edit mode, for any kind', () => {
    for (const kind of KINDS) {
      expect(regionEditorFields(kind, true), kind).not.toContain('title');
    }
  });

  /** A country is at the top: nothing above it to name. */
  it('offers a country no country of its own', () => {
    expect(regionEditorFields('country', true)).not.toContain('country');
    expect(regionEditorFields('country', false)).not.toContain('country');
  });

  it('offers the capital to the two kinds that have one', () => {
    expect(regionEditorFields('country', true)).toContain('capital');
    expect(regionEditorFields('state', true)).toContain('capital');
    expect(regionEditorFields('city', true)).not.toContain('capital');
  });

  it('offers coordinates and tags to the city alone', () => {
    for (const field of ['geoLocation', 'tags'] as const) {
      expect(regionEditorFields('city', true)).toContain(field);
      expect(regionEditorFields('state', true)).not.toContain(field);
      expect(regionEditorFields('country', true)).not.toContain(field);
    }
  });

  /**
   * The direction rule, seen from the form: a state's list of cities and a
   * country's list of states are read and never written, so neither is a
   * field anybody can fill in here.
   */
  it('offers no field for a child list', () => {
    for (const kind of KINDS) {
      const fields: string[] = regionEditorFields(kind, true);
      expect(fields).not.toContain('cities');
      expect(fields).not.toContain('states');
    }
  });
});
