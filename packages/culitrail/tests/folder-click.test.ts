/**
 * Clicking the meal folder in the file explorer.
 *
 * The blank-folder case is the reason this is tested rather than inlined: the
 * explorer's own root element carries an empty path, so a rule that let a
 * blank setting match would open the gallery on every click in the tree.
 */
import { describe, expect, it } from 'vitest';
import {
  galleryFolderForClick,
  shouldOpenGalleryForFolder,
  type FolderClickScope,
} from '../src/meals/lifecycle/folder-click';

const scope = (overrides: Partial<FolderClickScope> = {}): FolderClickScope => ({
  enabled: true,
  includeSubfolders: false,
  mealFolders: ['Eating/Meals'],
  ...overrides,
});

describe('shouldOpenGalleryForFolder', () => {
  it('opens on the meal folder itself', () => {
    expect(shouldOpenGalleryForFolder('Eating/Meals', scope())).toBe(true);
  });

  it('ignores a subfolder unless the setting says otherwise', () => {
    expect(shouldOpenGalleryForFolder('Eating/Meals/Baking', scope())).toBe(false);
    expect(
      shouldOpenGalleryForFolder('Eating/Meals/Baking', scope({ includeSubfolders: true }))
    ).toBe(true);
  });

  it('does not treat a sibling with a shared prefix as a subfolder', () => {
    expect(shouldOpenGalleryForFolder('Eating/MealsOld', scope({ includeSubfolders: true }))).toBe(
      false
    );
  });

  it('covers the additional meal folders too', () => {
    const wide = scope({ mealFolders: ['Eating/Meals', 'Archive/Old Meals'] });
    expect(shouldOpenGalleryForFolder('Archive/Old Meals', wide)).toBe(true);
  });

  it('never fires when the feature is off', () => {
    expect(shouldOpenGalleryForFolder('Eating/Meals', scope({ enabled: false }))).toBe(false);
  });

  it('never fires for a blank folder on either side', () => {
    // The explorer's vault-root row has an empty path, and an unconfigured
    // setting must not claim it.
    expect(shouldOpenGalleryForFolder('', scope())).toBe(false);
    expect(shouldOpenGalleryForFolder('Eating', scope({ mealFolders: ['', '  '] }))).toBe(false);
  });

  it('ignores stray slashes on the configured folder', () => {
    expect(
      shouldOpenGalleryForFolder('Eating/Meals', scope({ mealFolders: ['/Eating/Meals/'] }))
    ).toBe(true);
  });
});

describe('galleryFolderForClick', () => {
  it('clears the filter for a meal root', () => {
    // Filtering to the root would look like it did nothing, and would
    // actually hide anything in additionalMealFolders.
    expect(galleryFolderForClick('Eating/Meals', scope())).toBeNull();
  });

  it('narrows to the subfolder that was clicked', () => {
    expect(galleryFolderForClick('Eating/Meals/Baking', scope({ includeSubfolders: true }))).toBe(
      'Eating/Meals/Baking'
    );
  });

  it('is undefined, meaning do nothing, for a folder that is not a meal folder', () => {
    // Distinct from null, which means open unfiltered.
    expect(galleryFolderForClick('Travel/Trips', scope())).toBeUndefined();
  });
});
