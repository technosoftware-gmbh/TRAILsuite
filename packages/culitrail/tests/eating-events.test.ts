/**
 * Reading eating history back off the plan lines.
 *
 * The vault-walking half needs an App and is exercised against the real vault
 * rather than here; what these cover is the two pure decisions it rests on –
 * which folder the plans live in, and what a line says about the meal it
 * records.
 */
import { describe, expect, it } from 'vitest';
import { mergeSettings } from '../src/settings/validate';
import { mealPlanFolder } from '../src/planning/meal-plan/eating-events';
import { readEatingFields } from '../src/planning/meal-plan/meal-suffix';

const settings = mergeSettings({});

describe('mealPlanFolder', () => {
  it('takes the part of the template that does not vary', () => {
    // Resolving the template needs a week and a person, so it can only ever
    // name one note. Reading the history needs every week there has been.
    expect(mealPlanFolder(settings)).toBe('Eating/Meal Plans/');
  });

  it('follows a template somebody has moved', () => {
    const moved = mergeSettings({ mealPlanPath: 'Kitchen/Plans/{GGGG}/{GGGG}-W{WW}.md' });
    expect(mealPlanFolder(moved)).toBe('Kitchen/Plans/');
  });

  it('gives the vault root for a template with no folder at all', () => {
    const flat = mergeSettings({ mealPlanPath: '{GGGG}-W{WW}-{person}.md' });
    expect(mealPlanFolder(flat)).toBe('');
  });
});

describe('readEatingFields', () => {
  it('reads what an eater wrote onto the line', () => {
    const fields = readEatingFields(
      ' #meal/lunch [rating:: 4] [time:: 11:30] [note:: ½ portion] <!--culi-id:mig-b274-->'
    );

    expect(fields).toEqual({
      time: '11:30',
      note: '½ portion',
      id: 'mig-b274',
    });
  });

  it('gives null for everything a plain planned line says', () => {
    expect(readEatingFields(' #meal/lunch')).toEqual({
      time: null,
      note: null,
      id: null,
    });
  });

  it('refuses a time that is not a clock time', () => {
    expect(readEatingFields(' [time:: half eleven]').time).toBeNull();
    expect(readEatingFields(' [time:: 25:00]').time).toBeNull();
    expect(readEatingFields(' [time:: 09:05]').time).toBe('09:05');
  });

  it('round-trips what the writer put there', () => {
    expect(readEatingFields(' [note:: 11:30 · Stefan]').note).toBe('11:30 · Stefan');
  });
});
