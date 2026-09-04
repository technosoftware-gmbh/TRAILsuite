/**
 * The badge row: formulas, aliases, arrays, labels and layout.
 *
 * A badge that silently renders nothing is the failure this file exists to
 * catch, and every branch below is a way one could.
 */
import { describe, expect, it } from 'vitest';
import { checkExprSyntax, evaluateExpr } from '../src/shared/expr-eval';
import { mergeSettings } from '../src/settings/validate';
import { CustomBadge } from '../src/settings/types';
import { badgeLabel, planBadgeRow, resolveBadgeValues } from '../src/meals/view-model/badge-values';
import { formatMinutes } from '../src/meals/view-model/format-time';

const settings = mergeSettings({});

function badge(overrides: Partial<CustomBadge> = {}): CustomBadge {
  return {
    type: 'badge',
    property: 'diet',
    color: 'default',
    valueType: 'auto',
    splitArray: false,
    enabled: true,
    builtin: false,
    ...overrides,
  };
}

describe('evaluateExpr', () => {
  it('does arithmetic', () => {
    expect(evaluateExpr('2 + 3 * 4', {})).toBe(14);
    expect(evaluateExpr('(2 + 3) * 4', {})).toBe(20);
    expect(evaluateExpr('-5 + 2', {})).toBe(-3);
  });

  it('reads named values out of the scope', () => {
    expect(evaluateExpr('prepTime + reheatTime', { prepTime: 15, reheatTime: 30 })).toBe(45);
  });

  it('treats a property the note does not have as null rather than an error', () => {
    // The common case, not the edge case: most meals state some of their
    // fields. Throwing would fail the whole formula over one absent property.
    expect(evaluateExpr('missing', {})).toBeNull();
    expect(evaluateExpr('missing || 7', {})).toBe(7);
  });

  it('short-circuits || on truthiness rather than on a coerced number', () => {
    // This is what makes the built-in Total badge behave: a meal stating
    // neither time shows no Total, rather than "0 min" on every such meal.
    expect(evaluateExpr('(prepTime || 0) + (reheatTime || 0) || null', {})).toBeNull();
    expect(evaluateExpr('(prepTime || 0) + (reheatTime || 0) || null', { prepTime: 15 })).toBe(15);
    expect(
      evaluateExpr('(prepTime || 0) + (reheatTime || 0) || null', { prepTime: 15, reheatTime: 30 })
    ).toBe(45);
  });

  it('returns null for a malformed expression rather than throwing at a render site', () => {
    for (const bad of ['2 +', '(2', 'a b', '@@@', '']) {
      expect(evaluateExpr(bad, {})).toBeNull();
    }
  });

  it('evaluates nothing it was not given', () => {
    // The reason this is a hand-written parser rather than eval(): a formula
    // lives in data.json, which a user edits and a sync service moves around.
    expect(evaluateExpr('globalThis', {})).toBeNull();
    expect(evaluateExpr('process.exit(1)', {})).toBeNull();
    expect(evaluateExpr('[1,2]', {})).toBeNull();
  });

  it('reports a syntax error for the editor without needing real data', () => {
    expect(checkExprSyntax('(prepTime || 0) + 1')).toBeNull();
    expect(checkExprSyntax('2 +')).not.toBeNull();
    // An unknown property is not a syntax error.
    expect(checkExprSyntax('somethingNobodyHas + 1')).toBeNull();
  });
});

describe('formatMinutes', () => {
  it('reads the way a meal states a duration', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(75)).toBe('1 h 15 min');
  });

  it('renders nothing rather than "0 min" for an absent or zero value', () => {
    // Otherwise every meal that says nothing about time grows a badge
    // announcing it takes no time.
    expect(formatMinutes(null)).toBe('');
    expect(formatMinutes(0)).toBe('');
    expect(formatMinutes(-5)).toBe('');
  });

  it('rounds, since a computed total can carry a fraction', () => {
    expect(formatMinutes(74.6)).toBe('1 h 15 min');
  });
});

describe('resolveBadgeValues', () => {
  it('reads a plain property', () => {
    expect(
      resolveBadgeValues(badge({ property: 'diet' }), { diet: 'vegetarian' }, settings)
    ).toEqual(['vegetarian']);
  });

  it('reads through the same alias chain the rest of the view uses', () => {
    // Without this a badge configured for prepTime shows nothing on a note
    // saying `prep:`, while the meta banner beside it shows the value fine.
    // Two parts of one header disagreeing is worse than either being wrong.
    expect(resolveBadgeValues(badge({ property: 'prepTime' }), { prep: 15 }, settings)).toEqual([
      '15',
    ]);
  });

  it('formats a minutes badge', () => {
    expect(
      resolveBadgeValues(
        badge({ property: 'prepTime', valueType: 'minutes' }),
        { prepTime: 75 },
        settings
      )
    ).toEqual(['1 h 15 min']);
  });

  it('renders a true boolean as a valueless chip and a false one as nothing', () => {
    // A favorite meal shows a star; an unfavorited one shows nothing at
    // all, rather than a chip reading "false".
    expect(
      resolveBadgeValues(badge({ property: 'favorite' }), { favorite: true }, settings)
    ).toEqual(['']);
    expect(
      resolveBadgeValues(badge({ property: 'favorite' }), { favorite: false }, settings)
    ).toEqual([]);
  });

  it('splits or joins an array as configured', () => {
    const value = { diet: ['vegetarian', 'gluten-free'] };
    expect(resolveBadgeValues(badge({ splitArray: true }), value, settings)).toEqual([
      'vegetarian',
      'gluten-free',
    ]);
    expect(resolveBadgeValues(badge({ splitArray: false }), value, settings)).toEqual([
      'vegetarian, gluten-free',
    ]);
  });

  it('unwraps a wikilink-shaped value', () => {
    expect(
      resolveBadgeValues(badge({ property: 'diet' }), { diet: '[[Vegetarian]]' }, settings)
    ).toEqual(['Vegetarian']);
  });

  it('renders a date in the reader locale while the note keeps its ISO form', () => {
    const [rendered] = resolveBadgeValues(
      badge({ property: 'lastEaten' }),
      { lastEaten: '2026-07-28' },
      settings
    );
    expect(rendered).not.toBe('2026-07-28');
    expect(rendered).toContain('2026');
  });

  it('evaluates a formula badge', () => {
    const total = badge({
      property: 'total',
      valueType: 'minutes',
      formula: '(prepTime || 0) + (reheatTime || 0) || null',
    });
    expect(resolveBadgeValues(total, { prepTime: 15, reheatTime: 30 }, settings)).toEqual([
      '45 min',
    ]);
    expect(resolveBadgeValues(total, {}, settings)).toEqual([]);
  });

  it('yields nothing for a property the note does not carry', () => {
    // The badge disappears rather than showing an empty chip, which is what
    // lets one badge set serve meals that state wildly different amounts
    // about themselves.
    expect(resolveBadgeValues(badge({ property: 'diet' }), {}, settings)).toEqual([]);
  });
});

describe('badgeLabel', () => {
  it('translates a built-in through its key', () => {
    expect(badgeLabel(badge({ labelKey: 'badges.builtin.prep', builtin: true }))).toBe('Prep');
  });

  it('lets an explicit label override the key, which is how editing a built-in works', () => {
    // The key stays behind it, unused but intact, so clearing the override
    // restores the localized text rather than leaving the badge blank.
    expect(badgeLabel(badge({ labelKey: 'badges.builtin.prep', label: 'Vorbereitung' }))).toBe(
      'Vorbereitung'
    );
  });

  it('is empty for a badge with neither', () => {
    expect(badgeLabel(badge())).toBe('');
  });
});

describe('planBadgeRow', () => {
  it('plans the shipped built-ins against a full meal', () => {
    const planned = planBadgeRow(
      { diet: 'vegetarian', prepTime: 15, reheatTime: 30, lastEaten: '2026-07-28' },
      settings
    );
    expect(planned.map((entry) => entry.label)).toEqual([
      'Diet',
      'Prep',
      'Reheat',
      'Total',
      'Last eaten',
    ]);
    expect(planned.find((entry) => entry.label === 'Total')?.values).toEqual(['45 min']);
  });

  it('returns nothing at all for a meal with no metadata', () => {
    // So the caller skips the container rather than leaving an empty row
    // taking up space above every bare meal.
    expect(planBadgeRow({}, settings)).toEqual([]);
  });

  it('skips disabled badges and whatever the caller skips', () => {
    const custom = mergeSettings({
      headerBadges: [
        badge({ property: 'diet', labelKey: 'badges.builtin.diet' }),
        badge({ property: 'prepTime', enabled: false }),
      ],
    });
    expect(planBadgeRow({ diet: 'vegetarian', prepTime: 15 }, custom)).toHaveLength(1);
    expect(planBadgeRow({ diet: 'vegetarian' }, custom, (b) => b.property === 'diet')).toEqual([]);
  });

  describe('layout elements', () => {
    const withSeparators = (badges: CustomBadge[]) => mergeSettings({ headerBadges: badges });

    it('keeps a separator between two badges', () => {
      const s = withSeparators([
        badge({ property: 'diet' }),
        badge({ type: 'separator', property: '' }),
        badge({ property: 'prepTime' }),
      ]);
      expect(planBadgeRow({ diet: 'vegetarian', prepTime: 15 }, s).map((e) => e.type)).toEqual([
        'badge',
        'separator',
        'badge',
      ]);
    });

    it('drops a separator stranded at the start or end by a missing badge', () => {
      // The row is configured once and rendered against every meal, so a
      // badge disappearing because its property is absent is the normal case,
      // not a rare one.
      const s = withSeparators([
        badge({ property: 'diet' }),
        badge({ type: 'separator', property: '' }),
        badge({ property: 'prepTime' }),
      ]);
      expect(planBadgeRow({ prepTime: 15 }, s).map((e) => e.type)).toEqual(['badge']);
      expect(planBadgeRow({ diet: 'vegetarian' }, s).map((e) => e.type)).toEqual(['badge']);
    });

    it('collapses separators that end up adjacent', () => {
      const s = withSeparators([
        badge({ property: 'diet' }),
        badge({ type: 'separator', property: '' }),
        badge({ property: 'prepTime' }),
        badge({ type: 'separator', property: '' }),
        badge({ property: 'reheatTime' }),
      ]);
      expect(planBadgeRow({ diet: 'vegetarian', reheatTime: 30 }, s).map((e) => e.type)).toEqual([
        'badge',
        'separator',
        'badge',
      ]);
    });

    it('renders nothing when only layout elements would survive', () => {
      const s = withSeparators([
        badge({ type: 'separator', property: '' }),
        badge({ property: 'diet' }),
      ]);
      expect(planBadgeRow({}, s)).toEqual([]);
    });
  });
});
