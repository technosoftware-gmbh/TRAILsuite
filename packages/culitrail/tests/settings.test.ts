/**
 * The settings layer's guarantees: locale-aware defaults, folder derivation
 * from a root, and mergeSettings() surviving whatever is actually in
 * data.json.
 *
 * These run before any feature code exists, which is deliberate. Every later
 * area assumes a fully typed settings object with no missing fields, and this
 * is the file that makes that assumption true.
 */
import { describe, expect, it } from 'vitest';
import { I18nManager } from '../src/lang/I18nManager';
import { DEFAULT_SETTINGS, getLocalizedDefaults, joinFolder } from '../src/settings/defaults';
import { mergeSettings } from '../src/settings/validate';

describe('joinFolder', () => {
  it('drops empty segments so an empty root means the vault root', () => {
    expect(joinFolder('', 'Eating')).toBe('Eating');
    expect(joinFolder(undefined, 'Eating', 'Meals')).toBe('Eating/Meals');
  });

  it('trims stray slashes rather than producing a double separator', () => {
    expect(joinFolder('/4 Resources/', '/Eating/')).toBe('4 Resources/Eating');
  });
});

describe('getLocalizedDefaults', () => {
  it('derives every sub-folder from its root', () => {
    const f = getLocalizedDefaults();
    expect(f.eatingFolder).toBe('Eating');
    expect(f.mealsFolder).toBe('Eating/Meals');
    expect(f.mealPlansFolder).toBe('Eating/Meal Plans');
    expect(f.ordersFolder).toBe('Eating/Orders');
    expect(f.crmFolder).toBe('CRM');
    expect(f.personsFolder).toBe('CRM/People');
    expect(f.companiesFolder).toBe('CRM/Companies');
  });

  it('moves the whole tree when the common parent is set', () => {
    const f = getLocalizedDefaults({ rootFolder: '4 Resources' });
    expect(f.eatingFolder).toBe('4 Resources/Eating');
    expect(f.mealsFolder).toBe('4 Resources/Eating/Meals');
    expect(f.crmFolder).toBe('4 Resources/CRM');
    expect(f.personsFolder).toBe('4 Resources/CRM/People');
  });

  it('moves one tree without moving the other', () => {
    const f = getLocalizedDefaults({ eatingFolder: 'Kitchen' });
    expect(f.mealsFolder).toBe('Kitchen/Meals');
    // CRM is a separate root and must not follow Eating anywhere.
    expect(f.crmFolder).toBe('CRM');
  });

  /**
   * The case this whole parameter exists for: a vault relocated its tree
   * before a sub-folder setting existed, and gets that sub-folder under its
   * OWN root rather than under the pristine default. The saved root is the
   * vault owner's answer to "where does this live", and it has to apply to
   * sub-folders that did not exist when they answered.
   */
  it('puts a later-added sub-folder under the saved root, not the default one', () => {
    const f = getLocalizedDefaults({ eatingFolder: '4 Ressourcen/Essen' });
    expect(f.ordersFolder).toBe('4 Ressourcen/Essen/Orders');
    expect(f.mealPlanPath).toBe(
      '4 Ressourcen/Essen/Meal Plans/{GGGG}/{GGGG}-W{WW}-{person}-MealPlan.md'
    );
  });

  it('keeps the filename half of a note path untranslated and untouched', () => {
    // The folder half follows the locale; the filename half is written into
    // filenames that already exist in vaults, and a locale change must not
    // orphan a single week's note.
    const f = getLocalizedDefaults();
    expect(f.mealPlanPath.endsWith('/{GGGG}/{GGGG}-W{WW}-{person}-MealPlan.md')).toBe(true);
  });

  it('uses ISO week tokens rather than calendar-year ones', () => {
    // {YYYY}/{ww} are calendar-year based and disagree with the ISO week near
    // a year boundary, which is exactly when a meal plan note gets written to
    // the wrong year's folder.
    const f = getLocalizedDefaults();
    expect(f.mealPlanPath).toContain('{GGGG}');
    expect(f.mealPlanPath).toContain('{WW}');
    expect(f.mealPlanPath).not.toContain('{YYYY}');
    expect(f.mealPlanPath).not.toContain('{ww}');
  });
});

describe('localized defaults follow the active locale', () => {
  it('seeds German folder names and German body headings in a German vault', async () => {
    const manager = I18nManager.getInstance();
    const previous = manager.getCurrentLocale();
    await manager.setLocale('de');
    try {
      const f = getLocalizedDefaults();
      expect(f.eatingFolder).toBe('Essen');
      expect(f.mealsFolder).toBe('Essen/Mahlzeiten');
      expect(f.notesHeading).toBe('Notizen');
      expect(f.reheatingHeading).toBe('Aufwärmen');
      expect(f.eatingHistoryHeading).toBe('Essverlauf');
      // The CRM names are copied verbatim from APERtrail's own German table.
      // If this ever fails, the shared-CRM contract has quietly broken and a
      // vault with both plugins will read two different People folders.
      expect(f.crmFolder).toBe('CRM');
      expect(f.personsFolder).toBe('CRM/Personen');
      expect(f.companiesFolder).toBe('CRM/Firmen');
    } finally {
      await manager.setLocale(previous);
    }
  });
});

describe('mergeSettings', () => {
  it('produces a complete settings object from nothing at all', () => {
    for (const raw of [null, undefined, {}, 'not an object', 42]) {
      const s = mergeSettings(raw);
      expect(s.mealsFolder).toBe('Eating/Meals');
      expect(s.typePropertyName).toBe('type');
      expect(s.state.mealPlan).toEqual([]);
    }
  });

  /**
   * The per-100 g nutrition names, which are a frontmatter contract rather
   * than a preference: `trail-core` reads the two lists through the three
   * sub-key names and neither list through anything else, so a default that
   * drifted would leave every meal's nutrition unreadable with nothing to say
   * why. Asserted by value for that reason, the way the CRM contract is.
   */
  it('names the per-100 g nutrition properties the way notes already spell them', () => {
    const s = mergeSettings({});
    expect(s.caloriesPer100gProperty).toBe('caloriesPer100g');
    expect(s.kjPer100gProperty).toBe('kjPer100g');
    expect(s.macronutrientsProperty).toBe('macronutrients');
    expect(s.micronutrientsProperty).toBe('micronutrients');
    expect(s.nutrientNameField).toBe('name');
    expect(s.nutrientUnitField).toBe('unit');
    expect(s.nutrientValueField).toBe('value');
  });

  it('keeps the per-100 g energy names distinct from the per-serving one', () => {
    // The confusion these longer names exist to prevent: `calories` is per
    // serving and `caloriesPer100g` is per 100 g, and a note carrying both
    // states two different true things.
    const s = mergeSettings({});
    expect(s.caloriesPer100gProperty).not.toBe(s.caloriesProperty);
    expect(s.kjPer100gProperty).not.toBe(s.kjProperty);
  });

  it('leaves the per-100 g names in English in a German vault', async () => {
    // A frontmatter key is not display text. A vault that switched language
    // must not end up with half its meals keyed `macronutrients` and half
    // something else, neither half readable from the other side of the switch.
    const manager = I18nManager.getInstance();
    const previous = manager.getCurrentLocale();
    await manager.setLocale('de');
    try {
      const s = mergeSettings({});
      expect(s.macronutrientsProperty).toBe('macronutrients');
      expect(s.micronutrientsProperty).toBe('micronutrients');
      expect(s.nutrientValueField).toBe('value');
    } finally {
      await manager.setLocale(previous);
    }
  });

  it('lets a vault that spells them otherwise keep its own names', () => {
    const s = mergeSettings({ macronutrientsProperty: 'naehrwerte', nutrientValueField: 'amount' });
    expect(s.macronutrientsProperty).toBe('naehrwerte');
    expect(s.nutrientValueField).toBe('amount');
    // The rest still come from the defaults rather than being dragged along.
    expect(s.nutrientNameField).toBe('name');
  });

  it('keeps the legacy per-100 g section headings, which the reader still needs', () => {
    // Nothing writes these sections any more, but a vault is full of meals
    // that carry them, and the heading is the only thing that can find the
    // figures in one of those.
    const s = mergeSettings({});
    expect(s.nutritionHeading).toBe('Nutritional Information (Per 100g)');
    expect(s.micronutrientHeading).toBe('Micronutrient Information (Per 100g)');
  });

  it('keeps a saved value over the default', () => {
    const s = mergeSettings({
      mealsFolder: '4 Ressourcen/Mahlzeiten',
      orderDefaultCurrency: 'EUR',
    });
    expect(s.mealsFolder).toBe('4 Ressourcen/Mahlzeiten');
    expect(s.orderDefaultCurrency).toBe('EUR');
  });

  it('replaces a wrongly typed value rather than passing it through', () => {
    // A hand-edited or corrupt data.json must never put a non-string into a
    // folder path: every later reader treats these as strings unguarded.
    const s = mergeSettings({
      mealsFolder: 42,
      enableDashboard: 'yes',
      myAllergens: 'peanuts',
      additionalMealFolders: [1, 'Archive/Meals', null],
    });
    expect(s.mealsFolder).toBe('Eating/Meals');
    expect(s.enableDashboard).toBe(true);
    expect(s.myAllergens).toEqual([]);
    // A partly valid array keeps its usable members rather than being dropped.
    expect(s.additionalMealFolders).toEqual(['Archive/Meals']);
  });

  it('derives sub-folders from a saved root the vault already moved', () => {
    const s = mergeSettings({ eatingFolder: 'Kitchen' });
    expect(s.mealsFolder).toBe('Kitchen/Meals');
    expect(s.ordersFolder).toBe('Kitchen/Orders');
  });

  it('falls back on a value outside a fixed vocabulary', () => {
    expect(mergeSettings({ nutritionDisplay: 'per-mouthful' }).nutritionDisplay).toBe(
      'per-serving'
    );
    expect(mergeSettings({ dashboardActivityRangeWeeks: 7 }).dashboardActivityRangeWeeks).toBe(8);
    expect(mergeSettings({ dashboardActivityRangeWeeks: 12 }).dashboardActivityRangeWeeks).toBe(12);
  });

  describe('badges', () => {
    it('ships built-ins that carry a translation key rather than a frozen label', () => {
      // The whole point of labelKey/nameKey: these objects get persisted on
      // first save, so a literal default would freeze in whatever language the
      // vault happened to be in, with no later fix able to tell an untouched
      // default from a deliberate choice.
      const s = mergeSettings({});
      expect(s.headerBadges.every((b) => b.builtin && b.labelKey && !b.label)).toBe(true);
    });

    it('accepts an empty badge list as a deliberate choice', () => {
      expect(mergeSettings({ headerBadges: [] }).headerBadges).toEqual([]);
    });

    it('restores the built-ins when every saved badge was unusable', () => {
      // Distinguishable from the case above: a non-empty input that validated
      // down to nothing means corruption, not intent.
      const s = mergeSettings({ headerBadges: [{ nonsense: true }, 'also nonsense'] });
      expect(s.headerBadges).toEqual(DEFAULT_SETTINGS.headerBadges);
    });

    it('keeps a separator badge, which has neither a property nor a formula', () => {
      const s = mergeSettings({ headerBadges: [{ type: 'separator', color: 'default' }] });
      expect(s.headerBadges.some((badge) => badge.type === 'separator')).toBe(true);
    });

    it('keeps a computed badge, which has neither a property nor a formula either', () => {
      const s = mergeSettings({
        headerBadges: [{ derived: 'eatingStreak', color: 'yellow', builtin: true }],
      });
      expect(s.headerBadges.filter((badge) => badge.derived === 'eatingStreak')).toHaveLength(1);
    });

    it('adds a built-in the saved list predates, when that built-in ships disabled', () => {
      // The migration case. A vault that saved its badge order before the streak
      // badge existed would never get it otherwise, because the saved list wins
      // outright and the editor cannot re-add a built-in.
      const saved = DEFAULT_SETTINGS.headerBadges.filter((badge) => !badge.derived);
      const s = mergeSettings({ headerBadges: saved });

      expect(s.headerBadges.some((badge) => badge.derived === 'eatingStreak')).toBe(true);
      // Appended, so an arrangement somebody made is left as they made it.
      expect(s.headerBadges.slice(0, saved.length)).toEqual(saved);
    });

    it('adds it disabled, so an arranged header gains no visible chip', () => {
      const saved = DEFAULT_SETTINGS.headerBadges.filter((badge) => !badge.derived);
      const s = mergeSettings({ headerBadges: saved });

      expect(s.headerBadges.find((badge) => badge.derived === 'eatingStreak')?.enabled).toBe(false);
    });

    it('does not restore a built-in that ships enabled', () => {
      // Absent cannot be told from deliberately removed, and re-adding one that
      // renders by default would undo the removal on every load.
      const withoutDiet = DEFAULT_SETTINGS.headerBadges.filter(
        (badge) => badge.property !== 'diet'
      );
      const s = mergeSettings({ headerBadges: withoutDiet });

      expect(s.headerBadges.some((badge) => badge.property === 'diet')).toBe(false);
    });

    it('leaves a deliberately emptied list empty', () => {
      expect(mergeSettings({ headerBadges: [] }).headerBadges).toEqual([]);
    });
  });

  describe('persisted state', () => {
    it('keeps entries that have an id and drops those that do not', () => {
      const s = mergeSettings({
        state: {
          mealPlan: [{ id: 'a', mealPath: 'Eating/Meals/Penne.md' }, { mealPath: 'no id here' }],
        },
      });
      expect(s.state.mealPlan).toHaveLength(1);
    });

    it('survives a state block that is not an object', () => {
      const s = mergeSettings({ state: 'corrupt' });
      expect(s.state.mealPlan).toEqual([]);
      expect(s.state.mealPlanActivePerson).toBe('');
    });
  });
});
