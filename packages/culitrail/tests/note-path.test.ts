/**
 * Path template resolution, and the person token in particular.
 */
import { describe, expect, it } from 'vitest';
import { personFileToken, resolveNotePath, templateNeedsPerson } from '../src/shared/note-path';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const monday = new Date(2026, 7, 10); // 2026-08-10, ISO week 2026-W33

describe('personFileToken', () => {
  it('uses the full title with whitespace removed', () => {
    // The FULL name on purpose. An earlier version used the first word only,
    // and two people in one household sharing a first name wrote both their
    // plans into the same file.
    expect(personFileToken('Stefan Muster')).toBe('StefanMuster');
    expect(personFileToken('Anne Marie Smith')).toBe('AnneMarieSmith');
  });

  it('strips characters a filename cannot carry', () => {
    // A person note can legitimately be titled with a slash or a colon.
    // Leaving those in produces a path that simply cannot be created, and the
    // failure surfaces as "the meal plan will not save" rather than as
    // anything pointing at the name.
    expect(personFileToken("Anne-Marie O'Brien / Smith")).toBe("Anne-MarieO'BrienSmith");
    expect(personFileToken('A: B*C?D"E<F>G|H')).toBe('ABCDEFGH');
  });

  it('leaves an ordinary single-word name untouched', () => {
    expect(personFileToken('Stefan')).toBe('Stefan');
  });
});

describe('resolveNotePath', () => {
  it('resolves the shipped meal-plan default', () => {
    expect(
      resolveNotePath(DEFAULT_SETTINGS.mealPlanPath, { date: monday, person: 'Stefan Muster' })
    ).toBe('Eating/Meal Plans/2026/2026-W33-StefanMuster-MealPlan.md');
  });

  it('uses the ISO week-year, not the calendar year, for {GGGG}', () => {
    // 2025-12-29 belongs to ISO week 2026-W01. The folder has to follow the
    // week, or a week's notes end up split across two year folders.
    const yearEnd = new Date(2025, 11, 29);
    expect(resolveNotePath('Plans/{GGGG}/{GGGG}-W{WW}.md', { date: yearEnd })).toBe(
      'Plans/2026/2026-W01.md'
    );
    // The calendar tokens exist and disagree, which is exactly why the
    // defaults do not use them.
    expect(resolveNotePath('{YYYY}', { date: yearEnd })).toBe('2025');
  });

  it('zero-pads the week number', () => {
    expect(resolveNotePath('{GGGG}-W{WW}', { date: new Date(2026, 1, 23) })).toBe('2026-W09');
  });

  it('substitutes the person before the date tokens', () => {
    // A name containing something that looks like a token must not be
    // re-read as one on the second pass.
    expect(resolveNotePath('{person}-{GGGG}.md', { date: monday, person: 'MM Smith' })).toBe(
      'MMSmith-2026.md'
    );
  });

  it('leaves an unknown token as written rather than blanking it', () => {
    // A literal {foo} in the file explorer is visibly wrong. A path silently
    // collapsed to nothing quietly collides with another week's note.
    expect(resolveNotePath('Plans/{nope}/{GGGG}.md', { date: monday })).toBe(
      'Plans/{nope}/2026.md'
    );
  });

  it('leaves {person} alone when no person was supplied', () => {
    // Better a visibly unresolved path than a file literally named for an
    // empty string, which is what silently substituting would produce.
    expect(resolveNotePath('{person}-plan.md', { date: monday })).toBe('{person}-plan.md');
  });

  it('substitutes every occurrence of a repeated token', () => {
    expect(resolveNotePath('{GGGG}/{GGGG}.md', { date: monday })).toBe('2026/2026.md');
  });
});

describe('templateNeedsPerson', () => {
  it('recognizes a per-person template', () => {
    expect(templateNeedsPerson(DEFAULT_SETTINGS.mealPlanPath)).toBe(true);
    // A template a household shares rather than one note each: nothing to fill
    // in, so it resolves without knowing whose week it is.
    expect(templateNeedsPerson('Eating/Meal Plans/{GGGG}/{GGGG}-W{WW}.md')).toBe(false);
  });
});
