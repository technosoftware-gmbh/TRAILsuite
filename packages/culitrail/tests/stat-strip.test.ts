/**
 * The cell-or-chip rule.
 *
 * A strip cell is one label over one value in a fixed column. The rule that
 * decides which badges can be one is derived from what the badge resolved to
 * rather than configured, so these cases are the specification: get one of them
 * wrong and a header renders a label over a blank, or shows the first of three
 * diets and silently drops the other two.
 */
import { describe, expect, it } from 'vitest';
import { mergeSettings } from '../src/settings/validate';
import {
  badgeCells,
  badgeDisplay,
  planBadges,
  splitBadgeRow,
} from '../src/meals/view-model/badge-display';
import { planBadgeRow, type PlannedBadge } from '../src/meals/view-model/badge-values';
import { headerStrip } from '../src/meals/view-model/header-strip';
import type { MealMeta } from '../src/meals/types';
import type { BadgeType, CustomBadge } from '../src/settings/types';

function badge(over: Partial<CustomBadge> = {}): CustomBadge {
  return {
    type: 'badge',
    property: 'prepTime',
    label: 'Prep',
    color: 'default',
    valueType: 'auto',
    splitArray: false,
    enabled: true,
    builtin: false,
    ...over,
  };
}

function planned(values: string[], over: Partial<CustomBadge> = {}): PlannedBadge {
  return { badge: badge(over), type: 'badge', label: 'Prep', values };
}

function layout(type: BadgeType): PlannedBadge {
  return { badge: badge({ type }), type, label: '', values: [] };
}

describe('whether a badge is a cell or a chip', () => {
  it('makes a single-valued badge a cell, which is the whole point', () => {
    expect(badgeDisplay(planned(['25 min']))).toBe('cell');
  });

  it('keeps a badge with several values as a chip', () => {
    // One column cannot hold two figures, and showing the first would drop the
    // second without saying so.
    expect(badgeDisplay(planned(['vegetarian', 'gluten-free']))).toBe('chip');
  });

  it('keeps a list-valued badge a chip even when a note lists exactly one', () => {
    // The case that makes the rule key on `splitArray` rather than on the values
    // it resolved to. Deciding from the values alone meant a meal naming two
    // diets showed diet under the title and a meal naming one showed it in the
    // strip, so the badge moved from meal to meal. Pinning it by
    // configuration is what keeps a header's shape predictable.
    expect(badgeDisplay(planned(['vegetarian'], { splitArray: true }))).toBe('chip');
  });

  it('keeps a valueless badge as a chip', () => {
    // How a true boolean arrives from the planner: the badge renders as its icon
    // and label, and there is no figure to put under a label.
    expect(badgeDisplay(planned(['']))).toBe('chip');
  });

  it('honours an explicit chip on a badge that could have been a cell', () => {
    expect(badgeDisplay(planned(['25 min'], { display: 'chip' }))).toBe('chip');
  });

  it('treats a separator and a newline as chips, since a strip has neither', () => {
    expect(badgeDisplay(layout('separator'))).toBe('chip');
    expect(badgeDisplay(layout('newline'))).toBe('chip');
  });

  it('keeps a badge with its label hidden as a chip', () => {
    // `hideLabel` is how a badge renders as its icon and value alone. A column
    // needs a heading, so hiding it would leave a figure over blank space.
    expect(badgeDisplay(planned(['25 min'], { hideLabel: true }))).toBe('chip');
  });

  it('keeps a badge that has no label at all as a chip', () => {
    // A user-defined badge whose label was cleared. Same reason, arrived at a
    // different way, and the planner reports it the same: an empty label.
    const entry: PlannedBadge = { badge: badge(), type: 'badge', label: '', values: ['25 min'] };
    expect(badgeDisplay(entry)).toBe('chip');
  });
});

describe('a figure badge as a strip cell', () => {
  it('folds a prefix and a suffix into the one figure', () => {
    // In a chip these are their own muted spans beside the value. A cell is one
    // label over one figure, so they read as part of it rather than as two more
    // elements the grid would have to place.
    expect(badgeCells([planned(['615'], { prefix: 'approx.', suffix: 'kcal' })])).toEqual([
      { label: 'Prep', value: 'approx. 615 kcal' },
    ]);
  });

  it('leaves a figure alone when there is no prefix or suffix', () => {
    expect(badgeCells([planned(['25 min'])])).toEqual([{ label: 'Prep', value: '25 min' }]);
  });
});

describe('splitting a planned row', () => {
  it('sends figures to the strip and everything else to the chip row', () => {
    const { chips, cells } = splitBadgeRow([
      planned(['vegetarian', 'vegan'], { splitArray: true }),
      planned(['25 min']),
      planned(['']),
    ]);

    expect(cells.map((entry) => entry.values)).toEqual([['25 min']]);
    expect(chips).toHaveLength(2);
  });

  it('reads a row of nothing but figures as an empty chip row rather than an empty container', () => {
    const { chips, cells } = splitBadgeRow([planned(['25 min']), planned(['1 h'])]);
    expect(chips).toEqual([]);
    expect(cells).toHaveLength(2);
  });

  it('keeps each half in the configured order rather than sorting', () => {
    // The badge list is the header's layout. Somebody who put Total before Prep
    // meant it, and a split that reordered within a half would undo that.
    const { cells } = splitBadgeRow([planned(['1 h']), planned(['25 min'])]);
    expect(cells.map((entry) => entry.values.join())).toEqual(['1 h', '25 min']);
  });

  it('drops a divider the split stranded in the chip row', () => {
    // Configured between two badges that both became cells, so it is left with
    // nothing on either side of it. `planBadgeRow` cannot see this coming: both
    // badges rendered, and only the split separated them.
    const { chips, cells } = splitBadgeRow([
      planned(['25 min']),
      layout('separator'),
      planned(['1 h']),
    ]);

    expect(cells).toHaveLength(2);
    expect(chips).toEqual([]);
  });

  it('keeps a divider that still sits between two chips', () => {
    const { chips } = splitBadgeRow([
      planned(['vegetarian', 'vegan'], { splitArray: true }),
      layout('separator'),
      planned(['']),
    ]);

    expect(chips.map((entry) => entry.type)).toEqual(['badge', 'separator', 'badge']);
  });
});

describe('the rule against the badges that actually ship', () => {
  it('puts diet in the chip row and the times in the strip, with no note asked to say so', () => {
    // The request was "the diet badge should be under the title". This asserts it
    // falls out of the rule rather than from a special case: diet ships
    // `splitArray: true`, so a note listing two diets makes it a chip by shape.
    const settings = mergeSettings({});
    const { chips, cells } = splitBadgeRow(
      planBadgeRow(
        {
          diet: ['vegetarian', 'gluten-free'],
          prepTime: 15,
          reheatTime: 30,
          lastEaten: '2026-07-30',
        },
        settings,
        undefined,
        new Date(2026, 7, 11)
      )
    );

    expect(chips.map((entry) => entry.badge.property)).toEqual(['diet']);
    // Prep, reheat and the derived total, plus last eaten.
    expect(cells.map((entry) => entry.badge.property)).toEqual([
      'prepTime',
      'reheatTime',
      'total',
      'lastEaten',
    ]);
  });

  it('puts diet in the same place on a meal that names only one', () => {
    // The regression guard for the rule's first cut, which read the resolved
    // values and therefore moved diet into the strip on this note while leaving
    // it under the title on the one above.
    const settings = mergeSettings({});
    const { chips, cells } = splitBadgeRow(planBadgeRow({ diet: ['vegetarian'] }, settings));

    expect(chips.map((entry) => entry.badge.property)).toEqual(['diet']);
    expect(cells).toEqual([]);
  });

  it('plans and splits in one pass, taking the clock once', () => {
    // The eating-streak badge counts weeks against the current time. Planning twice
    // to render the two halves would read it twice, so `planBadges` exists to
    // make one pass the only way to get both.
    const settings = mergeSettings({ headerBadges: undefined });
    const { chips, cells } = planBadges(
      { diet: ['vegan'], prepTime: 10 },
      settings,
      undefined,
      new Date(2026, 7, 11)
    );

    expect(chips.map((entry) => entry.badge.property)).toEqual(['diet']);
    expect(cells.map((entry) => entry.badge.property)).toEqual(['prepTime', 'total']);
  });

  it('puts a bare string diet in the chip row too, since the badge is what declares the shape', () => {
    // `diet: vegetarian` unquoted and unlisted. The property is not an array
    // here at all, so only the badge's own `splitArray` can answer, which is the
    // argument for keying on it.
    const settings = mergeSettings({});
    const { chips } = splitBadgeRow(planBadgeRow({ diet: 'vegetarian' }, settings));

    expect(chips.map((entry) => entry.badge.property)).toEqual(['diet']);
  });
});

describe('the header strip, nutrition and figures in one row', () => {
  const meta = (over: Partial<MealMeta> = {}): MealMeta =>
    ({
      servings: 2,
      nutrition: { calories: 615, protein: 21, fat: 30, carbs: 64 },
      ...over,
    }) as MealMeta;

  it('puts nutrition first, then the figures', () => {
    // Nutrition leads because the caption is left-aligned under the strip, so it
    // has to sit under the columns it describes rather than across from them.
    const settings = mergeSettings({});
    const strip = headerStrip(meta(), settings, [planned(['25 min'])]);

    expect(strip.cells.map((cell) => cell.value)).toEqual([
      '615',
      '21 g',
      '30 g',
      '64 g',
      '25 min',
    ]);
  });

  it('rules off the first figure column, so the caption cannot claim it', () => {
    const settings = mergeSettings({});
    const strip = headerStrip(meta(), settings, [planned(['25 min']), planned(['1 h'])]);

    // Four nutrition columns, then two figures, and the rule falls between them.
    expect(strip.cells.map((cell) => cell.groupStart === true)).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(strip.caption).toBeTruthy();
  });

  it('draws no rule when there is nothing on one side of it', () => {
    // A rule at the start of the strip is a stray line, and one after a group
    // nothing follows is the badge row's stranded-separator bug again.
    const settings = mergeSettings({});
    const nutritionOnly = headerStrip(meta(), settings, []);
    expect(nutritionOnly.cells.some((cell) => cell.groupStart)).toBe(false);

    const figuresOnly = headerStrip(
      meta({ nutrition: { calories: null, protein: null, fat: null, carbs: null } }),
      settings,
      [planned(['25 min'])]
    );
    expect(figuresOnly.cells.some((cell) => cell.groupStart)).toBe(false);
  });

  it('says nothing about a basis when the note states no nutrition', () => {
    // A caption with no figures over it would be a label for an empty set.
    const settings = mergeSettings({});
    const strip = headerStrip(
      meta({ nutrition: { calories: null, protein: null, fat: null, carbs: null } }),
      settings,
      [planned(['25 min'])]
    );

    expect(strip.caption).toBeNull();
    expect(strip.cells).toHaveLength(1);
  });

  it('is empty for a note that states neither, so the header renders no strip', () => {
    // The real case that started this: `Grüne Casarecce mit Poulet` has empty
    // prep, reheat and total, no lastEaten and no eating history. Two of 126 notes
    // look like that, and the header has to be happy with it.
    const settings = mergeSettings({});
    const strip = headerStrip(
      meta({ nutrition: { calories: null, protein: null, fat: null, carbs: null } }),
      settings,
      []
    );

    expect(strip.cells).toEqual([]);
    expect(strip.caption).toBeNull();
  });
});
