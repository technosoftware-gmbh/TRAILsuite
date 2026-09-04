/**
 * What a gallery card shows below its picture.
 *
 * Every case here is about a card staying the same height and the same shape as
 * the card beside it, because a card is a grid item stretched to its row's
 * height: one that is taller makes every card next to it taller and leaves the
 * rest with a gap under their content. The counts that decided which rows earn a
 * place are in `card-face.ts`.
 */
import { describe, expect, it } from 'vitest';
import { mergeSettings } from '../src/settings/validate';
import { readMealMeta } from '../src/meals/parser/meal-meta';
import { cardFace } from '../src/meals/view-model/card-face';
import type { GalleryEntry } from '../src/meals/view-model/gallery-entry';

const settings = mergeSettings({});

function entry(frontmatter: Record<string, unknown> = {}): GalleryEntry {
  return {
    file: { path: 'Meal.md' } as GalleryEntry['file'],
    title: 'Meal',
    folder: '',
    tags: [],
    meta: readMealMeta(frontmatter, settings),
    createdAt: 0,
    modifiedAt: 0,
    hasReheating: true,
    supplier: null,
  };
}

const NUTRITION = { calories: 647, protein: 41, fat: 20, carbs: 70, servings: 1 };

describe('the nutrition columns', () => {
  it('uses abbreviated labels and drops the gram suffix', () => {
    // A card is about 200px wide and four columns of it are 50px each, which
    // "Calories" does not fit on one line. A wrapping label is the one thing that
    // would make a card taller than its neighbours.
    const face = cardFace(entry(NUTRITION), settings);

    expect(face.nutrition.map((cell) => cell.label)).toEqual(['kcal', 'prot', 'fat', 'carb']);
    expect(face.nutrition.map((cell) => cell.value)).toEqual(['647', '41', '20', '70']);
  });

  it('keeps the basis available for a tooltip rather than dropping it', () => {
    // The card has no room for a caption line, and showing 647 with nothing
    // saying whether that is a plate or a tray is the failure `nutrition-row.ts`
    // exists to prevent. It goes on the strip's title instead.
    expect(cardFace(entry(NUTRITION), settings).nutritionCaption).toBeTruthy();
  });

  it('says nothing at all for a note that states no nutrition', () => {
    // Two of the 126 notes measured against. The card's fixed height is what
    // keeps those two the same size as the rest, not a row of dashes.
    const face = cardFace(entry({}), settings);

    expect(face.nutrition).toEqual([]);
    expect(face.nutritionCaption).toBeNull();
  });
});

describe('the info strip', () => {
  it('is always exactly two columns', () => {
    const withEverything = cardFace(
      entry({
        ...NUTRITION,
        eatenCount: 12,
        lastEaten: '2026-08-06',
        prepTime: 35,
        reheatTime: 35,
      }),
      settings
    );
    const withNothing = cardFace(entry({}), settings);

    expect(withEverything.info).toHaveLength(2);
    expect(withNothing.info).toHaveLength(2);
  });

  it('leaves total time off the card, however much of it the note states', () => {
    // Measured rather than preferred: three columns put an ellipsis through both
    // `1 h 10 min` and the date. Time is also the least earned of the three, at
    // 14 notes of 126 against 124 for the other two, and the meal view shows it
    // in full one tap away.
    const face = cardFace(entry({ prepTime: 35, reheatTime: 35, totalTime: 70 }), settings);

    expect(face.info.map((cell) => cell.label)).toEqual(['Eaten', 'Last']);
  });

  it('shortens the date, because the full one does not fit its column', () => {
    const face = cardFace(entry({ lastEaten: '2026-08-06' }), settings);
    const shown = face.info[1].value;

    expect(shown).toContain('26');
    // A four-digit year is what overflows an 85px column.
    expect(shown).not.toContain('2026');
  });

  it('shows a dash for a meal nobody has eaten, not a zero', () => {
    // Zero is a figure somebody recorded. A dash is the absence of one, and
    // `eatenCount` is deleted rather than written as 0 when a log empties.
    const face = cardFace(entry({}), settings);
    expect(face.info.map((cell) => cell.value)).toEqual(['–', '–']);
  });

  it('counts the entries in the log when the note states no count', () => {
    // `eatenCount` is derived by `readMealMeta` from the eating history, so a
    // note carrying only the log still shows a number here.
    const face = cardFace(entry({ eatingHistory: ['2026-08-06', '2026-07-30'] }), settings);
    expect(face.info[0].value).toBe('2');
  });
});

/**
 * A price is drawn by the same formatter as every other figure in the suite.
 *
 * These used to assert a plain space between the code and the number, because
 * `formatPrice` built the string by hand and grouped no thousands at all. It
 * goes through the core formatter now, so a four-figure order total is
 * separated like one and the whole vault reads one convention.
 *
 * `Intl` separates the code from the figure with a **non-breaking** space,
 * which is why these assertions cannot be typed with the space bar. That is the
 * right character for money -- a code and its figure should never be split
 * across a line -- and it is what the other two plugins have always shown.
 */
const NBSP = '\u00a0';

describe('the price on a card', () => {
  it('formats two decimal places with the configured currency', () => {
    // `17` is what a note holds; `17.00` is money. One decimal place reads as a
    // number that lost a digit.
    expect(cardFace(entry({ price: 17 }), settings).price).toBe(
      `${settings.orderDefaultCurrency}${NBSP}17.00`
    );
  });

  it('is null when the note states none, so the row renders empty', () => {
    // Empty rather than absent: the element is always created, because a card
    // that skipped a row would be shorter than its neighbours.
    expect(cardFace(entry({}), settings).price).toBeNull();
  });

  it('keeps a price of zero rather than reading it as absent', () => {
    expect(cardFace(entry({ price: 0 }), settings).price).toBe(
      `${settings.orderDefaultCurrency}${NBSP}0.00`
    );
  });

  it('reads a note that writes `cost:` instead', () => {
    expect(cardFace(entry({ cost: 21.9 }), settings).price).toBe(
      `${settings.orderDefaultCurrency}${NBSP}21.90`
    );
  });
});
