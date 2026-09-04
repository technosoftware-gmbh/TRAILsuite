/**
 * What the gallery needs from the plugin around it.
 *
 * Same arrangement as the meal view's own deps, and the same rule: nothing
 * is stubbed in advance. The card's actions menu carries only what the
 * planning area actually implements today, rather than a menu of items that
 * do nothing.
 */
import type { TFile } from 'obsidian';
import type { CULItrailSettings, GallerySavedState } from '../../settings/types';

export interface GalleryViewDeps {
  getSettings: () => CULItrailSettings;
  /** Persists the toolbar's state. Separate from a general save so the view cannot write anything else. */
  saveGalleryState: (state: GallerySavedState) => Promise<void>;
  /** Re-renders every open gallery. Returns its own unsubscribe. */
  subscribeToChanges: (onChange: () => void) => () => void;
  openMeal: (file: TFile) => void;
  /**
   * Puts a meal on the meal plan from the card's actions menu.
   *
   * The same callback the meal view uses: the week and the person belong to
   * the planning area, and the gallery has no business resolving either.
   */
  planMeal: (file: TFile) => void;
  /**
   * Writes a new meal note and opens the editor on it.
   *
   * The gallery carries this because it is where a library is browsed, and
   * adding to one is what somebody does while looking at what is already
   * there. It used to be a button on the dashboard, one screen away from the
   * shelf it fills.
   */
  newMeal: () => void;
}
