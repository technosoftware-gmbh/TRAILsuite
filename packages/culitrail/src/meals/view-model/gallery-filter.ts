/**
 * The gallery's filters: a fixed set of facets, all of which have to pass.
 *
 * Deliberately not a general "any property, any operator" engine. That is
 * what the suggester's field filters are for, and it is a different job: this
 * is the handful of things somebody standing in a kitchen wants to narrow by,
 * each with a control of its own rather than a query to build.
 *
 * App-free.
 */
import type { CULItrailSettings, GallerySavedState } from '../../settings/types';
import { matchingAllergens } from './allergens';
import { neverEaten, type GalleryEntry } from './gallery-entry';

/** The filter fields, minus search. Used to clear them and to tell whether any is set. */
export const CLEARED_FILTERS: Pick<
  GallerySavedState,
  'folder' | 'tag' | 'diet' | 'favoriteOnly' | 'neverEaten' | 'excludeAllergens'
> = {
  folder: null,
  tag: null,
  diet: null,
  favoriteOnly: false,
  neverEaten: false,
  excludeAllergens: false,
};

/**
 * True when any filter is narrowing the grid.
 *
 * Search is deliberately not counted. It has its own always-visible field, it
 * is obvious when it is set, and "clear filters" leaving somebody's search
 * intact is what they expect.
 */
export function hasActiveFilters(state: GallerySavedState): boolean {
  return (
    state.folder !== null ||
    state.tag !== null ||
    state.diet !== null ||
    state.favoriteOnly ||
    state.neverEaten ||
    state.excludeAllergens
  );
}

/** True when a folder path is the entry's own folder or an ancestor of it. */
function inFolder(entry: GalleryEntry, folder: string): boolean {
  const base = folder.replace(/\/+$/, '');
  return entry.folder === base || entry.folder.startsWith(`${base}/`);
}

/** True when the meal declares this diet. Case-insensitive, since a note is typed by hand. */
function hasDiet(entry: GalleryEntry, wanted: string): boolean {
  const target = wanted.trim().toLowerCase();
  return entry.meta.diet.some((diet) => diet.trim().toLowerCase() === target);
}

/** True when a tag matches, counting a parent tag as matching its nested children. */
function hasTag(entry: GalleryEntry, wanted: string): boolean {
  const target = wanted.trim().toLowerCase();
  return entry.tags.some((tag) => {
    const candidate = tag.trim().toLowerCase();
    return candidate === target || candidate.startsWith(`${target}/`);
  });
}

export function matchesGalleryFilters(
  entry: GalleryEntry,
  state: GallerySavedState,
  settings: CULItrailSettings
): boolean {
  const search = state.search.trim().toLowerCase();
  if (search && !entry.title.toLowerCase().includes(search)) return false;

  if (state.folder && !inFolder(entry, state.folder)) return false;
  if (state.tag && !hasTag(entry, state.tag)) return false;
  if (state.diet && !hasDiet(entry, state.diet)) return false;
  if (state.favoriteOnly && !entry.meta.favorite) return false;
  if (state.neverEaten && !neverEaten(entry.meta)) return false;

  if (
    state.excludeAllergens &&
    matchingAllergens(entry.meta.allergens, settings.myAllergens).length > 0
  ) {
    return false;
  }

  return true;
}

/** The folders the given meals actually live in, sorted for a dropdown. */
export function distinctFolders(entries: GalleryEntry[]): string[] {
  const folders = new Set<string>();
  for (const entry of entries) {
    if (entry.folder) folders.add(entry.folder);
  }
  return [...folders].sort((a, b) => a.localeCompare(b));
}

/**
 * The diets the given meals actually declare, sorted for a dropdown.
 *
 * Read off the library rather than from a fixed list. `diet` is a free
 * vocabulary a vault chooses for itself, and the four values this one uses are
 * not the four another one would.
 */
export function distinctDiets(entries: GalleryEntry[]): string[] {
  const diets = new Set<string>();
  for (const entry of entries) {
    for (const diet of entry.meta.diet) if (diet.trim()) diets.add(diet.trim());
  }
  return [...diets].sort((a, b) => a.localeCompare(b));
}

/** The tags the given meals actually carry, sorted for a dropdown. */
export function distinctTags(entries: GalleryEntry[]): string[] {
  const tags = new Set<string>();
  for (const entry of entries) {
    for (const tag of entry.tags) tags.add(tag);
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}
