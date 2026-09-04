/**
 * What the meal view needs from the plugin around it.
 *
 * An interface rather than the plugin class, so a layout can be reasoned
 * about without the whole of CULItrail behind it, and so the seams to the
 * other areas are visible in one place instead of scattered through the
 * render code.
 *
 * It is deliberately small. Every member here exists today; nothing is
 * stubbed in advance, so the compiler names every call site that has to be
 * wired up rather than a stub silently doing nothing at runtime.
 */
import type { TFile, WorkspaceLeaf } from 'obsidian';
import type { CULItrailSettings } from '../../settings/types';

export interface MealViewDeps {
  /** A callback, not a snapshot, so a settings change is picked up on the next render. */
  getSettings: () => CULItrailSettings;
  /** Persists a setting the view itself changed. */
  saveSettings: () => Promise<void>;
  /**
   * Turns this leaf back into plain Markdown, suppressing the auto-open that
   * would otherwise convert it straight back.
   *
   * Takes the leaf rather than looking one up. The view knows which leaf it
   * is in, and guessing with `getMostRecentLeaf()` is unreliable during fast
   * tab sequences.
   */
  editAsMarkdown: (leaf: WorkspaceLeaf, file: TFile) => void;
  /**
   * Puts this meal on the meal plan, asking for a day and a slot first.
   *
   * A callback into the plugin rather than a call into the planning area,
   * because the week and the person are the meal-plan view's, and the meal
   * area has no business resolving either.
   */
  planMeal: (file: TFile) => void;
  /** Opens the staged editor. Separate from `editAsMarkdown`, which opens the raw note. */
  editMeal: (file: TFile) => void;
  /**
   * Records a cook, asking for the date, the person, a rating and a photo first.
   *
   * A callback for the same reason `planMeal` is one: which people the vault
   * offers comes from the CRM area, and where an attachment goes is the vault's
   * own setting.
   */
  markEaten: (file: TFile) => void;
  /** Reveals the meal-plan view. Used by the plan button once a meal is on it. */
  openMealPlan: () => void;
  /** Whether this meal is on the plan for the week the planning area is showing. */
  isPlanned: (file: TFile) => boolean;
  /** Re-renders every open meal view. Returns its own unsubscribe. */
  subscribeToChanges: (onChange: () => void) => () => void;
}
