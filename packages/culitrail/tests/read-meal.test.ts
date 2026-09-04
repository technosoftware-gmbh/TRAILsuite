/**
 * Reading a meal off disk, and the auto-open decision that puts a note in
 * front of somebody in the view CULItrail has for it.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { mergeSettings } from '../src/settings/validate';
import { readMeal } from '../src/meals/read-meal';
import {
  clearAutoOpenSuppression,
  isAutoOpenSuppressed,
  shouldOpenInOwnView,
  suppressAutoOpenOnce,
} from '../src/meals/lifecycle/auto-open';
import * as viewTypes from '../src/meals/view-types';
import { fakeFile, makeFakeVault } from './fake-vault';

const settings = mergeSettings({});

const PENNE = `---
type: meal
servings: 2
prepTime: 15
reheatTime: 30
---

A Sicilian pasta that lives or dies on salting the aubergine.

## Reheating

### Oven
Heat for 20 minutes at 180 °C.

## Notes

Works with rigatoni.
`;

const vault = makeFakeVault([
  {
    path: 'Eating/Meals/Penne alla Norma.md',
    frontmatter: {
      type: 'meal',
      servings: 2,
      prepTime: 15,
      reheatTime: 30,
    },
    contents: PENNE,
  },
  {
    path: 'Eating/Meals/Bare.md',
    frontmatter: { type: 'meal' },
    contents: 'Bought at the market, eaten the same evening.\n',
  },
]);

const penneFile = fakeFile('Eating/Meals/Penne alla Norma.md');
const bareFile = fakeFile('Eating/Meals/Bare.md');

describe('readMeal', () => {
  it('assembles meta, description and notes from one read', async () => {
    const meal = await readMeal(vault, penneFile, settings);

    expect(meal.title).toBe('Penne alla Norma');
    expect(meal.meta.servings).toBe(2);
    expect(meal.meta.reheatTime).toBe(30);
    expect(meal.description).toBe('A Sicilian pasta that lives or dies on salting the aubergine.');
    expect(meal.notes).toBe('Works with rigatoni.');
  });

  it('keeps the body, so a view can render whatever the parser did not claim', async () => {
    const meal = await readMeal(vault, penneFile, settings);
    expect(meal.body).not.toContain('type: meal');
    expect(meal.body).toContain('## Reheating');
  });

  it('parses a note that is one line of text and nothing else', async () => {
    // No headings, no sections, no meta. Still a meal, and every view has to
    // survive one.
    const meal = await readMeal(vault, bareFile, settings);
    expect(meal.meta.servings).toBeNull();
    expect(meal.description).toBe('Bought at the market, eaten the same evening.');
    expect(meal.notes).toBe('');
  });
});

describe('the auto-open decision', () => {
  const base = {
    autoOpenEnabled: true,
    activeMarkdownPath: 'Eating/Meals/Penne alla Norma.md',
    isSubject: true,
    suppressed: false,
  };

  it('opens a note shown in a Markdown view', () => {
    expect(shouldOpenInOwnView(base)).toBe(true);
  });

  it('does nothing when the setting is off', () => {
    expect(shouldOpenInOwnView({ ...base, autoOpenEnabled: false })).toBe(false);
  });

  it('does nothing when the active view is not Markdown', () => {
    // Already one of our views, or a dashboard, or a PDF. Converting anything
    // here would fight whatever is showing.
    expect(shouldOpenInOwnView({ ...base, activeMarkdownPath: null })).toBe(false);
  });

  it('does nothing for a note this view does not render', () => {
    expect(shouldOpenInOwnView({ ...base, isSubject: false })).toBe(false);
  });

  it('respects a deliberate switch to Markdown', () => {
    // Without this the escape hatch appears not to work at all: the listener
    // converts the leaf straight back.
    expect(shouldOpenInOwnView({ ...base, suppressed: true })).toBe(false);
  });

  it('says nothing about which kind of note it is deciding for', () => {
    // Meal notes and order notes go through this one decision with their own
    // setting and their own detection. A branch on the kind here is what would
    // let the two behave differently by accident.
    const order = {
      ...base,
      activeMarkdownPath: 'Eating/Orders/2026-07-24-33335.md',
    };
    expect(shouldOpenInOwnView(order)).toBe(true);
    expect(shouldOpenInOwnView({ ...order, autoOpenEnabled: false })).toBe(false);
    expect(shouldOpenInOwnView({ ...order, suppressed: true })).toBe(false);
  });
});

describe('auto-open suppression', () => {
  beforeEach(() => clearAutoOpenSuppression());

  it('suppresses a path and lets it expire', async () => {
    suppressAutoOpenOnce('Eating/Meals/Penne alla Norma.md', 10);
    expect(isAutoOpenSuppressed('Eating/Meals/Penne alla Norma.md')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(isAutoOpenSuppressed('Eating/Meals/Penne alla Norma.md')).toBe(false);
  });

  it('survives being read twice, which is the reason it is timed rather than consume-once', () => {
    // One setViewState fires both file-open and active-leaf-change. A flag
    // cleared by the first read would be gone before the second arrived, and
    // the second would convert the leaf straight back.
    suppressAutoOpenOnce('Eating/Meals/Penne alla Norma.md', 1000);
    expect(isAutoOpenSuppressed('Eating/Meals/Penne alla Norma.md')).toBe(true);
    expect(isAutoOpenSuppressed('Eating/Meals/Penne alla Norma.md')).toBe(true);
  });

  it('suppresses only the path it was given', () => {
    suppressAutoOpenOnce('Eating/Meals/Penne alla Norma.md', 1000);
    expect(isAutoOpenSuppressed('Eating/Meals/Risotto.md')).toBe(false);
  });
});

describe('view types', () => {
  it('are all namespaced to the plugin', () => {
    // These strings are written into the user's workspace.json, so they are
    // vault data rather than internal naming. Renaming one turns every open
    // tab of that type into an unresolvable view on next launch.
    const values = Object.values(viewTypes);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) expect(value.startsWith('culitrail-')).toBe(true);
  });

  it('are all distinct', () => {
    const values = Object.values(viewTypes);
    expect(new Set(values).size).toBe(values.length);
  });
});
