/**
 * The nutrition cells and, more importantly, the caption under them.
 *
 * The same four numbers mean different things under different settings.
 * A caption that says "per serving" over figures that could not be divided is
 * a wrong label on a number somebody might act on.
 */
import { describe, expect, it } from 'vitest';
import { mergeSettings } from '../src/settings/validate';
import { readMealMeta } from '../src/meals/parser/meal-meta';
import { ABSENT_FIGURE, nutritionRow } from '../src/meals/view-model/nutrition-row';

const meta = (frontmatter: Record<string, unknown>) => readMealMeta(frontmatter, mergeSettings({}));

const settings = (overrides: Record<string, unknown>) => mergeSettings(overrides);

describe('nutritionRow', () => {
  it('is null for a meal that states no nutrition at all', () => {
    // Null rather than four dashes, so the header of an ordinary meal does
    // not carry an empty grid announcing what it does not know.
    expect(nutritionRow(meta({ servings: 4 }), mergeSettings({}))).toBeNull();
  });

  it('renders a figure with its unit, and calories without one', () => {
    const row = nutritionRow(
      meta({ calories: 600, protein: 20, servings: 2 }),
      settings({ nutritionSource: 'per-serving', nutritionDisplay: 'per-serving' })
    );
    expect(row?.cells.map((cell) => cell.text)).toEqual([
      '600',
      '20 g',
      ABSENT_FIGURE,
      ABSENT_FIGURE,
    ]);
  });

  it('shows a dash for a figure the note does not state', () => {
    const row = nutritionRow(meta({ calories: 600 }), mergeSettings({}));
    // Asserted against the constant rather than a literal dash: the point is that
    // an absent figure is marked, and which mark it is has changed once already
    // (it was an em dash, which the plugin ships in no user-facing text).
    expect(row?.cells[1].text).toBe(ABSENT_FIGURE);
  });

  it('rounds a near-whole number rather than showing float noise', () => {
    const row = nutritionRow(
      meta({ calories: 100, servings: 3 }),
      settings({ nutritionSource: 'meal-total', nutritionDisplay: 'per-serving' })
    );
    expect(row?.cells[0].text).toBe('33.3');
  });

  it('captions converted figures with the basis the reader asked for', () => {
    const perServing = nutritionRow(
      meta({ calories: 600, servings: 2 }),
      settings({ nutritionSource: 'meal-total', nutritionDisplay: 'per-serving' })
    );
    expect(perServing?.cells[0].text).toBe('300');
    expect(perServing?.caption).toBe('Nutrition per serving');

    const total = nutritionRow(
      meta({ calories: 600, servings: 2 }),
      settings({ nutritionSource: 'per-serving', nutritionDisplay: 'total' })
    );
    expect(total?.cells[0].text).toBe('1200');
    expect(total?.caption).toBe('Nutrition for the whole meal');
  });

  it('captions honestly when it could not convert for want of a servings count', () => {
    // Common in imports. The numbers shown are the stored ones, so the
    // caption names the stored basis rather than the one that was asked for.
    const row = nutritionRow(
      meta({ calories: 600 }),
      settings({ nutritionSource: 'meal-total', nutritionDisplay: 'per-serving' })
    );
    expect(row?.cells[0].text).toBe('600');
    expect(row?.caption).toBe('Nutrition for the whole meal, as written');
  });
});
