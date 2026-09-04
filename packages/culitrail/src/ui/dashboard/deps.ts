/**
 * What the dashboard is allowed to see.
 *
 * The widest dependency surface in the plugin, because the dashboard is the one
 * view that spans every area. It is still a fixed list of callbacks rather
 * than the plugin object: the dashboard can open a gallery, it cannot decide how
 * a gallery opens.
 */
import type { TFile } from 'obsidian';
import type { CULItrailSettings, DashboardActivityRangeWeeks } from '../../settings/types';

export interface DashboardViewDeps {
  getSettings: () => CULItrailSettings;
  saveSettings: () => Promise<void>;
  subscribeToChanges: (onChange: () => void) => () => void;
  /** Reconciles a week's meal-plan notes into state before the plan is read. */
  syncWeek: (week: string) => Promise<void>;

  openGallery: () => void;
  openMealPlan: () => void;
  openOrders: () => void;
  openMeal: (path: string) => void;

  /**
   * Writing the first meal down, from the empty-vault card and nowhere else.
   *
   * The top bar used to carry this. It navigates now: a library is added to
   * from the gallery, which is where somebody is already looking at what they
   * have. An empty vault has no gallery worth sending anybody to, which is the
   * one case that still needs this.
   */
  newMeal: () => void;

  /** Picks a meal, or names one, and asks which day it goes on. */
  planAnyMeal: () => void;

  /**
   * Hands a query to the gallery's own filter state and opens it.
   *
   * A hand-off rather than a search implemented here, so one set of rules
   * decides what a search matches.
   */
  searchMeals: (query: string) => void;

  /** Puts a meal on the plan, from a card's actions menu. */
  planMeal: (file: TFile) => void;

  /** Which week the plan card is browsing. */
  setViewedMealPlanWeek: (week: string) => void;

  /** Persists the activity chart's range and repaints. */
  setActivityRange: (weeks: DashboardActivityRangeWeeks) => void;
}
