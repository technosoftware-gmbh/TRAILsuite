/**
 * I18nManager's own behaviour, as distinct from whether the tables are
 * complete (translation-keys.test.ts covers that).
 *
 * Most of what is pinned here is failure behaviour. Every one of these paths
 * is reached by real vaults, and every one of them is written to degrade
 * rather than throw, because a plugin that fails to load over a missing
 * string is worse than one showing an English label.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { I18nManager, t } from '../src/lang/I18nManager';
import {
  MEAL_SLOT_KEYS,
  WEEKDAY_KEYS,
  mealSlotLabel,
  parseMealSlotKey,
  parseWeekdayKey,
  weekdayHeading,
  weekdayLabel,
  weekdayRank,
} from '../src/lang/vocabulary';

const manager = I18nManager.getInstance();

// tests/setup.ts leaves the manager on English. Anything switching locale puts
// it back, so test order stays irrelevant.
afterEach(async () => {
  await manager.setLocale('en');
});

describe('locale selection', () => {
  it('starts on English under Node, where none of the globals it reads exist', () => {
    expect(manager.getCurrentLocale()).toBe('en');
  });

  it('switches to a locale that ships a table', async () => {
    await manager.setLocale('de');
    expect(manager.getCurrentLocale()).toBe('de');
    expect(t('vocabulary.weekdays.tuesday')).toBe('Dienstag');
  });

  it('falls back to English for a locale it knows the name of but ships no table for', async () => {
    // Italian is in the supported list so detection can recognize it, but no
    // it.ts exists. Registering an empty table would make every t() return its
    // key, which is worse than English.
    await manager.setLocale('it');
    expect(manager.getCurrentLocale()).toBe('en');
    expect(t('vocabulary.weekdays.tuesday')).toBe('Tuesday');
  });

  it('falls back to English for a locale it has never heard of', async () => {
    await manager.setLocale('xx-YY');
    expect(manager.getCurrentLocale()).toBe('en');
  });

  it('reports only the locales that actually ship a table as available', () => {
    expect(manager.getAvailableLocales().map((l) => l.code)).toEqual(['en', 'de']);
    // The supported list is longer on purpose: it is what detection matches
    // against, not what is translated.
    expect(manager.getSupportedLocales().length).toBeGreaterThan(2);
  });
});

describe('key lookup', () => {
  it('returns the key itself for a key no table has', () => {
    // The behaviour that makes a missing string invisible, and therefore the
    // reason translation-keys.test.ts exists at all.
    expect(t('nope.not.a.key')).toBe('nope.not.a.key');
  });

  it('returns the key rather than an object when a key resolves to a subtree', () => {
    expect(t('vocabulary.weekdays')).toBe('vocabulary.weekdays');
  });

  it('falls back to English for a key the active locale is missing', async () => {
    // Not reachable today, since the two tables are asserted identical. It is
    // pinned because it is what makes adding a locale safe: a partial third
    // table renders English rather than raw keys.
    await manager.setLocale('de');
    expect(t('settings.folders.defaults.crmFolderName')).toBe('CRM');
  });

  it('interpolates named placeholders and leaves unknown ones alone', () => {
    const raw = manager.t('vocabulary.weekdays.monday', { unused: 'x' });
    expect(raw).toBe('Monday');
  });
});

describe('the fixed vocabularies', () => {
  it('translates a weekday label while leaving the written heading in English', async () => {
    // The whole point of §G.2: the note keeps `## Tuesday` in every locale,
    // the UI says Dienstag. If these two ever agree, existing meal-plan notes
    // have been orphaned.
    await manager.setLocale('de');
    expect(weekdayLabel('tuesday')).toBe('Dienstag');
    expect(weekdayHeading('tuesday')).toBe('Tuesday');
  });

  it('translates meal slots', async () => {
    await manager.setLocale('de');
    expect(mealSlotLabel('lunch')).toBe('Mittagessen');
  });

  it('parses a weekday heading case-insensitively', () => {
    expect(parseWeekdayKey('Tuesday')).toBe('tuesday');
    expect(parseWeekdayKey('  tuesday ')).toBe('tuesday');
    expect(parseMealSlotKey('LUNCH')).toBe('lunch');
  });

  it('refuses to parse a translated weekday name', async () => {
    // A note saying `## Dienstag` was not written by this plugin. Adopting it
    // would leave two spellings of Tuesday in one vault, only one of which the
    // writer would ever produce again.
    await manager.setLocale('de');
    expect(parseWeekdayKey('Dienstag')).toBeNull();
  });

  it('sorts weekdays Monday-first and puts unknown headings last', () => {
    // Monday-first matches ISO week numbering, which the planning area is
    // already keyed on, rather than a locale preference.
    expect(weekdayRank('monday')).toBe(0);
    expect(weekdayRank('sunday')).toBe(6);
    // A section a user added by hand sorts to the end rather than being lost.
    expect(weekdayRank('Shopping day')).toBe(WEEKDAY_KEYS.length);
    expect(weekdayRank(undefined)).toBe(WEEKDAY_KEYS.length);
  });

  it('covers seven days and four meal slots, and no more', () => {
    expect(WEEKDAY_KEYS).toHaveLength(7);
    expect(MEAL_SLOT_KEYS).toHaveLength(4);
  });
});
