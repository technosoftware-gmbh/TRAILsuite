/**
 * Making a meal note that does not exist yet.
 *
 * Three things decide whether a created note is any use, and all three are
 * silent when they go wrong:
 *
 *   - it carries the configured `type:`, or no reader in the plugin can see it;
 *   - it carries no section headings, because the only body span the editor
 *     writes is the description and its figures go into frontmatter;
 *   - it does not land on a note that is already there.
 *
 * The path search needs an App and the rest does not, so the rest is checked
 * directly and the search against a vault that answers one question.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { App } from 'obsidian';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { replaceDescription } from 'trail-core';
import {
  freeMealPath,
  newMealFrontmatter,
  mealFilenameStem,
} from '../src/meals/editor/create-meal';

/** A vault holding exactly these paths, which is all `freeMealPath` asks about. */
function vaultWith(paths: readonly string[]): App {
  const taken = new Set(paths);
  return {
    vault: { getAbstractFileByPath: (path: string) => (taken.has(path) ? {} : null) },
  } as unknown as App;
}

describe('mealFilenameStem', () => {
  it('keeps the words and the case somebody typed', () => {
    expect(mealFilenameStem('  Grandmother’s Bolognese  ')).toBe('Grandmother’s Bolognese');
  });

  it('takes out what a filename cannot hold, rather than refusing the name', () => {
    // A slash in a title is somebody writing "Pasta / Sugo", not a mistake to
    // be told about, so it becomes a space and the note gets made.
    expect(mealFilenameStem('Pasta / Sugo')).toBe('Pasta Sugo');
    expect(mealFilenameStem('Risotto: the good one')).toBe('Risotto the good one');
  });

  it('is empty when there is nothing usable, which is what the caller refuses on', () => {
    expect(mealFilenameStem('   ')).toBe('');
    expect(mealFilenameStem('///')).toBe('');
  });
});

describe('freeMealPath', () => {
  it('uses the plain name when nothing is in the way', () => {
    expect(freeMealPath(vaultWith([]), 'Eating/Meals', 'Pancakes')).toBe(
      'Eating/Meals/Pancakes.md'
    );
  });

  it('numbers rather than overwriting, because two Pancakes is normal', () => {
    const vault = vaultWith(['Eating/Meals/Pancakes.md']);

    expect(freeMealPath(vault, 'Eating/Meals', 'Pancakes')).toBe('Eating/Meals/Pancakes 2.md');
  });

  it('keeps counting past the second', () => {
    const vault = vaultWith(['Eating/Meals/Pancakes.md', 'Eating/Meals/Pancakes 2.md']);

    expect(freeMealPath(vault, 'Eating/Meals', 'Pancakes')).toBe('Eating/Meals/Pancakes 3.md');
  });
});

describe('a new meal note', () => {
  it(`says what it is, under the vault's own property name`, () => {
    const settings = { ...DEFAULT_SETTINGS, typePropertyName: 'art', mealTypeValue: 'Mahlzeit' };

    expect(newMealFrontmatter(settings).art).toBe('Mahlzeit');
  });

  it('carries a creation stamp and nothing else it has not been told', () => {
    const keys = Object.keys(newMealFrontmatter(DEFAULT_SETTINGS));

    // No servings, no times, no blank placeholders: a property holding nothing
    // says something different from one that was never written.
    expect(keys).toContain(DEFAULT_SETTINGS.typePropertyName);
    expect(keys).toHaveLength(2);
  });

  /**
   * The empty body is the decision, so this is the test that guards it.
   *
   * A new meal gets no headings because it needs none: its figures go into
   * frontmatter, and the only body span the editor writes is the description,
   * which sits above the first heading and needs nothing to anchor on. Seeding
   * `## Nutritional Information (Per 100g)` here would leave one note carrying a
   * section every other meal in the vault is having taken out.
   */
  it('starts with a body the first save can write a description into', () => {
    const bare = `---\ntype: meal\n---\n\n`;

    const saved = replaceDescription(bare, 'mit gebratenen Pilzen');

    expect(saved).toContain('mit gebratenen Pilzen');
    expect(saved).toContain('type: meal');
    // No heading is invented on the way, at any level.
    expect(saved).not.toMatch(/^#+\s/m);
  });
});

/**
 * The buttons somebody actually presses reach manual creation.
 *
 * **A source scan, and it is one because the alternative is not available
 * here.** These tests run in a Node environment against Obsidian's `createEl`
 * and `setIcon`, neither of which exists outside the app, so a toolbar's DOM
 * cannot be rendered in this suite at all. What can be checked is the wiring,
 * and the wiring is precisely what was wrong once: the command existed, the
 * editor existed, and no button reached either, so from inside Obsidian
 * nothing had changed.
 *
 * The button moved from the dashboard to the gallery, which is why this suite
 * names neither: what it pins is that **some** control reaches the editor
 * without a meal already open, in the view where a library is browsed and on
 * the card an empty vault sees.
 */
describe('the UI reaches manual creation', () => {
  const source = (path: string): string => readFileSync(join(__dirname, '..', 'src', path), 'utf8');

  it("sends the gallery toolbar's Add meal button to the editor", () => {
    const toolbar = source('meals/gallery/toolbar.ts');

    expect(toolbar).toContain("t('meals.gallery.addMeal')");
    expect(toolbar).toContain('options.onAddMeal');
    // The view is what turns that callback into the editor, so the wiring is
    // only complete if both halves are there.
    expect(source('meals/gallery/gallery-view.ts')).toContain(
      'onAddMeal: () => this.deps.newMeal()'
    );
  });

  it('offers an empty vault a meal to write', () => {
    const card = source('ui/dashboard/new-meals-card.ts');

    expect(card).toContain('deps.newMeal()');
  });

  it('registers a command that needs no meal already open', () => {
    // `open` is the palette helper for a command that is always available;
    // `onMeal` is the one that requires a meal in front of somebody.
    expect(source('commands.ts')).toContain(
      "open('new-meal', t('commands.newMeal'), actions.newMeal)"
    );
  });
});
