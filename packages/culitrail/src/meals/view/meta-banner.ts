/**
 * The band under the meal title: the servings it states, and the header
 * actions.
 *
 * Controls, in other words. The figures are in the header strip above it, next
 * to the meal's name, because on a real library that band was the only place
 * four nutrition figures appeared while the strip beside the title had one
 * column. See `view-model/header-strip.ts`.
 *
 * Nothing here writes to the note except the buttons that say they do, which
 * is why opening a meal and closing it again leaves the note untouched.
 */
import { App, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import type { CULItrailSettings } from '../../settings/types';
import type { MealMeta } from '../types';
import { renderFavoriteToggle } from './favorite-toggle';
import { renderMarkEatenButton } from './mark-eaten-button';
import { renderPlanButton } from './plan-button';
import { renderEditButton } from './edit-button';

function renderServingsCell(cells: HTMLElement, meta: MealMeta): void {
  const servings = meta.servings;
  if (servings === null) return;

  const cell = cells.createDiv({ cls: 'culi-banner-cell culi-servings-cell' });
  cell.createSpan({ cls: 'culi-servings-label', text: t('meals.header.serves') });
  cell.createSpan({
    cls: 'culi-servings-value',
    text: Number.isInteger(servings) ? String(servings) : servings.toFixed(2).replace(/\.?0+$/, ''),
  });
}

export function renderMetaBanner(
  container: HTMLElement,
  app: App,
  file: TFile,
  meta: MealMeta,
  settings: CULItrailSettings,
  actions: MetaBannerActions
): void {
  const banner = container.createDiv({ cls: 'culi-meta-banner' });

  const cells = banner.createDiv({ cls: 'culi-banner-cells' });
  renderServingsCell(cells, meta);

  // Order is deliberate and matches the order the actions are reached for:
  // marking a favorite, recording that it was eaten, planning one, then
  // editing the note.
  const row = banner.createDiv({ cls: 'culi-header-actions' });
  renderFavoriteToggle(row, app, file, meta.favorite, settings);
  renderMarkEatenButton(row, file, settings.eatingHistoryEnabled, actions.markEaten);
  renderPlanButton(row, file, actions.plannedThisWeek, actions.planMeal, actions.openPlan);
  renderEditButton(row, file, actions.editMeal);
}

export interface MetaBannerActions {
  planMeal: (file: TFile) => void;
  markEaten: (file: TFile) => void;
  editMeal: (file: TFile) => void;
  /** Opens the meal-plan view, for a meal that is already on it. */
  openPlan: () => void;
  /** Whether this meal is on the plan for the week being viewed. Drives the button's state. */
  plannedThisWeek: boolean;
}
