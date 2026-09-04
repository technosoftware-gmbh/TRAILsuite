/**
 * The gallery's filtering and ordering.
 *
 * Both are plain functions over entries read once, which is what makes them
 * testable at all: the inherited versions re-read and re-parse a note's
 * frontmatter inside every comparator call.
 */
import { describe, expect, it } from 'vitest';
import { mergeSettings } from '../src/settings/validate';
import { GallerySavedState } from '../src/settings/types';
import { readMealMeta } from '../src/meals/parser/meal-meta';
import { matchingAllergens } from '../src/meals/view-model/allergens';
import { neverEaten, type GalleryEntry } from '../src/meals/view-model/gallery-entry';
import {
  distinctDiets,
  distinctFolders,
  distinctTags,
  hasActiveFilters,
  matchesGalleryFilters,
} from '../src/meals/view-model/gallery-filter';
import { sortGalleryEntries } from '../src/meals/view-model/gallery-sort';

const settings = mergeSettings({});

interface EntryOptions {
  title?: string;
  folder?: string;
  tags?: string[];
  createdAt?: number;
  modifiedAt?: number;
  frontmatter?: Record<string, unknown>;
  hasReheating?: boolean;
}

function entry(options: EntryOptions = {}): GalleryEntry {
  return {
    // The tests never touch the file, only what was read off it.
    file: {
      path: `${options.folder ?? ''}/${options.title ?? 'Meal'}.md`,
    } as GalleryEntry['file'],
    title: options.title ?? 'Meal',
    supplier: null,
    folder: options.folder ?? '',
    tags: options.tags ?? [],
    meta: readMealMeta(options.frontmatter ?? {}, settings),
    createdAt: options.createdAt ?? 0,
    modifiedAt: options.modifiedAt ?? 0,
    hasReheating: options.hasReheating ?? false,
  };
}

const noFilters: GallerySavedState = {
  sortField: 'title',
  sortDirection: 'asc',
  folder: null,
  favoriteOnly: false,
  tag: null,
  diet: null,
  neverEaten: false,
  excludeAllergens: false,
  search: '',
};

const state = (overrides: Partial<GallerySavedState> = {}): GallerySavedState => ({
  ...noFilters,
  ...overrides,
});

describe('matchingAllergens', () => {
  it('matches in both directions, because the two lists are written by different people', () => {
    // The meal says "tree nuts", the reader wrote "nuts". Over-warning is
    // by far the safer failure here.
    expect(matchingAllergens(['tree nuts'], ['nuts'])).toEqual(['tree nuts']);
    expect(matchingAllergens(['nuts'], ['tree nuts'])).toEqual(['nuts']);
  });

  it('ignores case and surrounding space', () => {
    expect(matchingAllergens([' Gluten '], ['gluten'])).toEqual([' Gluten ']);
  });

  it('is empty when the reader lists nothing', () => {
    expect(matchingAllergens(['gluten', 'dairy'], [])).toEqual([]);
  });

  it('does not match on an empty entry in either list', () => {
    expect(matchingAllergens(['gluten'], ['  '])).toEqual([]);
    expect(matchingAllergens([''], ['gluten'])).toEqual([]);
  });
});

describe('neverEaten', () => {
  it('treats a missing count and a count of zero as the same thing', () => {
    // A meal nobody has eaten usually carries no eaten-count property at
    // all, so a plain `=== 0` misses precisely the meals this finds.
    expect(neverEaten(readMealMeta({}, settings))).toBe(true);
    expect(neverEaten(readMealMeta({ eatenCount: 0 }, settings))).toBe(true);
    expect(neverEaten(readMealMeta({ eatenCount: 3 }, settings))).toBe(false);
  });
});

describe('matchesGalleryFilters', () => {
  it('passes everything when nothing is set', () => {
    expect(matchesGalleryFilters(entry(), noFilters, settings)).toBe(true);
  });

  it('searches the title, ignoring case and surrounding space', () => {
    const risotto = entry({ title: 'Mushroom Risotto' });
    expect(matchesGalleryFilters(risotto, state({ search: '  RISOTTO ' }), settings)).toBe(true);
    expect(matchesGalleryFilters(risotto, state({ search: 'lasagne' }), settings)).toBe(false);
  });

  it('matches a folder and its subfolders', () => {
    const nested = entry({ folder: 'Eating/Meals/Italian' });
    expect(matchesGalleryFilters(nested, state({ folder: 'Eating/Meals' }), settings)).toBe(true);
    expect(matchesGalleryFilters(nested, state({ folder: 'Eating/Orders' }), settings)).toBe(false);
  });

  it('does not let a folder name match a longer sibling', () => {
    // `Meals` must not claim `MealsArchive`.
    const sibling = entry({ folder: 'Eating/MealsArchive' });
    expect(matchesGalleryFilters(sibling, state({ folder: 'Eating/Meals' }), settings)).toBe(false);
  });

  it('matches a parent tag against its nested children', () => {
    const tagged = entry({ tags: ['Cuisine/Italian'] });
    expect(matchesGalleryFilters(tagged, state({ tag: 'Cuisine' }), settings)).toBe(true);
    expect(matchesGalleryFilters(tagged, state({ tag: 'Cuisine/Italian' }), settings)).toBe(true);
    expect(matchesGalleryFilters(tagged, state({ tag: 'Italian' }), settings)).toBe(false);
  });

  it('filters favorites', () => {
    expect(
      matchesGalleryFilters(
        entry({ frontmatter: { favorite: true } }),
        state({ favoriteOnly: true }),
        settings
      )
    ).toBe(true);
    expect(matchesGalleryFilters(entry(), state({ favoriteOnly: true }), settings)).toBe(false);
  });

  it('narrows to one diet, whatever case the note wrote it in', () => {
    const vegan = entry({ frontmatter: { diet: 'Vegan' } });
    expect(matchesGalleryFilters(vegan, state({ diet: 'Vegan' }), settings)).toBe(true);
    expect(matchesGalleryFilters(vegan, state({ diet: 'vegan' }), settings)).toBe(true);
    expect(matchesGalleryFilters(vegan, state({ diet: 'Fleisch' }), settings)).toBe(false);
    // A meal declaring none is not every diet, it is no diet.
    expect(matchesGalleryFilters(entry(), state({ diet: 'Vegan' }), settings)).toBe(false);
  });

  it('matches one value of a meal declaring several', () => {
    const both = entry({ frontmatter: { diet: ['Vegetarisch', 'Glutenfrei'] } });
    expect(matchesGalleryFilters(both, state({ diet: 'Glutenfrei' }), settings)).toBe(true);
  });

  it('finds meals nobody has eaten', () => {
    expect(matchesGalleryFilters(entry(), state({ neverEaten: true }), settings)).toBe(true);
    expect(
      matchesGalleryFilters(
        entry({ frontmatter: { eatenCount: 2 } }),
        state({ neverEaten: true }),
        settings
      )
    ).toBe(false);
  });

  it('excludes a meal carrying one of the reader allergens', () => {
    const mine = mergeSettings({ myAllergens: ['nuts'] });
    const nutty = entry({ frontmatter: { allergens: ['tree nuts', 'dairy'] } });
    expect(matchesGalleryFilters(nutty, state({ excludeAllergens: true }), mine)).toBe(false);
    expect(matchesGalleryFilters(entry(), state({ excludeAllergens: true }), mine)).toBe(true);
  });

  it('ands every filter together', () => {
    const target = entry({ title: 'Risotto', folder: 'Meals', frontmatter: { favorite: true } });
    expect(
      matchesGalleryFilters(
        target,
        state({ search: 'risotto', folder: 'Meals', favoriteOnly: true }),
        settings
      )
    ).toBe(true);
    expect(
      matchesGalleryFilters(
        target,
        state({ search: 'risotto', folder: 'Orders', favoriteOnly: true }),
        settings
      )
    ).toBe(false);
  });
});

describe('hasActiveFilters', () => {
  it('does not count search, which has its own visible field', () => {
    expect(hasActiveFilters(state({ search: 'risotto' }))).toBe(false);
    expect(hasActiveFilters(state({ favoriteOnly: true }))).toBe(true);
    expect(hasActiveFilters(noFilters)).toBe(false);
  });
});

describe('what the dropdowns offer', () => {
  const entries = [
    entry({ folder: 'B', tags: ['dinner', 'quick'] }),
    entry({ folder: 'A', tags: ['dinner'] }),
    entry({ folder: '', tags: [] }),
  ];

  it('lists each folder once, sorted, and skips the vault root', () => {
    expect(distinctFolders(entries)).toEqual(['A', 'B']);
  });

  it('lists each tag once, sorted', () => {
    expect(distinctTags(entries)).toEqual(['dinner', 'quick']);
  });

  it('lists the diets the library actually declares, sorted', () => {
    // Read off the library rather than from a fixed list: `diet` is a free
    // vocabulary, and the values this vault uses are not another one's.
    const meals = [
      entry({ frontmatter: { diet: 'Vegan' } }),
      entry({ frontmatter: { diet: 'Fleisch' } }),
      entry({ frontmatter: { diet: 'Vegan' } }),
      entry({ frontmatter: {} }),
    ];
    expect(distinctDiets(meals)).toEqual(['Fleisch', 'Vegan']);
  });

  it('offers nothing when nothing declares one, so the dropdown is not rendered', () => {
    expect(distinctDiets([entry()])).toEqual([]);
  });
});

describe('sortGalleryEntries', () => {
  const titles = (entries: GalleryEntry[]) => entries.map((item) => item.title);

  it('sorts by title in both directions', () => {
    const entries = [entry({ title: 'B' }), entry({ title: 'A' }), entry({ title: 'C' })];
    expect(titles(sortGalleryEntries(entries, 'title', 'asc', settings))).toEqual(['A', 'B', 'C']);
    expect(titles(sortGalleryEntries(entries, 'title', 'desc', settings))).toEqual(['C', 'B', 'A']);
  });

  it('does not mutate the list it was given', () => {
    const entries = [entry({ title: 'B' }), entry({ title: 'A' })];
    sortGalleryEntries(entries, 'title', 'asc', settings);
    expect(titles(entries)).toEqual(['B', 'A']);
  });

  it('falls back to title on a tie, so the grid does not reshuffle every render', () => {
    const entries = [
      entry({ title: 'B', frontmatter: { eatenCount: 5 } }),
      entry({ title: 'A', frontmatter: { eatenCount: 5 } }),
    ];
    expect(titles(sortGalleryEntries(entries, 'times-eaten', 'desc', settings))).toEqual([
      'A',
      'B',
    ]);
  });

  it('treats a meal nobody has eaten as zero rather than dropping it', () => {
    const entries = [
      entry({ title: 'Eaten', frontmatter: { eatenCount: 3 } }),
      entry({ title: 'Un' }),
    ];
    expect(titles(sortGalleryEntries(entries, 'times-eaten', 'desc', settings))).toEqual([
      'Eaten',
      'Un',
    ]);
  });

  it('sorts by the dates the vault holds', () => {
    const entries = [
      entry({ title: 'Old', createdAt: 1, modifiedAt: 9 }),
      entry({ title: 'New', createdAt: 9, modifiedAt: 1 }),
    ];
    expect(titles(sortGalleryEntries(entries, 'date-added', 'desc', settings))).toEqual([
      'New',
      'Old',
    ]);
    expect(titles(sortGalleryEntries(entries, 'date-modified', 'desc', settings))).toEqual([
      'Old',
      'New',
    ]);
  });

  it('sorts never-eaten meals last in both directions', () => {
    // A meal with no date belongs at neither end of a range of dates, and
    // reversing the sort to find the one eaten longest ago should not fill
    // the top of the grid with meals that were never eaten at all.
    const history = mergeSettings({ eatingHistoryEnabled: true });
    const entries = [
      entry({ title: 'Never' }),
      entry({ title: 'Recent', frontmatter: { lastEaten: '2026-07-01' } }),
      entry({ title: 'Older', frontmatter: { lastEaten: '2026-01-01' } }),
    ];
    expect(titles(sortGalleryEntries(entries, 'last-eaten', 'desc', history))).toEqual([
      'Recent',
      'Older',
      'Never',
    ]);
    expect(titles(sortGalleryEntries(entries, 'last-eaten', 'asc', history))).toEqual([
      'Older',
      'Recent',
      'Never',
    ]);
  });

  it('falls back to date-added when eating history is off', () => {
    // Otherwise the field is empty on every meal and the grid appears to
    // ignore the sort entirely.
    const off = mergeSettings({ eatingHistoryEnabled: false });
    const entries = [entry({ title: 'Old', createdAt: 1 }), entry({ title: 'New', createdAt: 9 })];
    expect(titles(sortGalleryEntries(entries, 'last-eaten', 'desc', off))).toEqual(['New', 'Old']);
  });
});
