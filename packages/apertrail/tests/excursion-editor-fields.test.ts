/** What the excursion form holds, checked where it can be. */
import { describe, expect, it } from 'vitest';
import { excursionEditorFields } from '../src/places/excursion-editor-fields';

describe('excursionEditorFields', () => {
  it('asks at creation for what tells one tour from another', () => {
    expect(excursionEditorFields(false)).toEqual(['title', 'city', 'operator', 'duration']);
  });

  it('never offers a title box in edit mode', () => {
    expect(excursionEditorFields(true)).not.toContain('title');
  });

  it('adds the website once the note exists', () => {
    expect(excursionEditorFields(true)).toContain('website');
    expect(excursionEditorFields(false)).not.toContain('website');
  });

  /**
   * Two fields deliberately absent. The description belongs to the note
   * cover, which owns that line for every note that has one, and the country
   * comes from the city rather than from a dropdown of its own.
   */
  it('offers neither a description nor a country', () => {
    for (const mode of [true, false]) {
      const fields: string[] = excursionEditorFields(mode);
      expect(fields).not.toContain('description');
      expect(fields).not.toContain('country');
    }
  });
});
