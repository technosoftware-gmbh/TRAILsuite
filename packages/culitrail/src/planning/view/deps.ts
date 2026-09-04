/**
 * What the meal-plan view needs from the plugin around it.
 *
 * The view owns no state of its own beyond what is on screen. Which week and
 * which person are being browsed live in settings, because they should survive
 * closing the tab, and both are read through callbacks so the view never holds
 * a stale copy.
 */
import type { TFile, WorkspaceLeaf } from 'obsidian';
import type { CULItrailSettings } from '../../settings/types';

export interface MealPlanViewDeps {
  getSettings: () => CULItrailSettings;
  saveSettings: () => Promise<void>;
  /** Re-renders every open planning view. Returns its own unsubscribe. */
  subscribeToChanges: (onChange: () => void) => () => void;
  /** Reconciles the browsed week's notes into state. Run on open and on week or person change. */
  syncWeek: (week: string) => Promise<void>;
  openMeal: (path: string) => void;
  /** Opens the browsed week's own note as Markdown. */
  openWeekNote: (week: string, person: string) => void;
}

/**
 * What a plan note rendered as its week needs.
 *
 * The browsing view's deps minus the two it has no use for, plus the escape
 * hatch: this one replaces Obsidian's own rendering of a note and therefore
 * has to be able to give it back.
 */
export interface PlanNoteViewDeps {
  getSettings: () => CULItrailSettings;
  saveSettings: () => Promise<void>;
  subscribeToChanges: (onChange: () => void) => () => void;
  syncWeek: (week: string) => Promise<void>;
  openMeal: (path: string) => void;
  /**
   * Turns this leaf back into plain Markdown, suppressing the auto-open that
   * would otherwise convert it straight back.
   */
  editAsMarkdown: (leaf: WorkspaceLeaf, file: TFile) => void;
}
