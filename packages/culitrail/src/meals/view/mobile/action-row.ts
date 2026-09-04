/**
 * The mobile action row.
 *
 * The same buttons the desktop banner carries, in the same order, as one row
 * of large tap targets. A phone is where a meal is most likely to be marked
 * eaten, so this is the last row that should be missing the button for it.
 */
import { App, TFile } from 'obsidian';
import type { CULItrailSettings } from '../../../settings/types';
import type { MealMeta } from '../../types';
import { renderFavoriteToggle } from '../favorite-toggle';
import { renderPlanButton } from '../plan-button';
import { renderMarkEatenButton } from '../mark-eaten-button';
import { renderEditButton } from '../edit-button';
import type { MetaBannerActions } from '../meta-banner';

export function renderMobileActionRow(
  container: HTMLElement,
  app: App,
  file: TFile,
  meta: MealMeta,
  settings: CULItrailSettings,
  actions: MetaBannerActions
): void {
  const row = container.createDiv({ cls: 'culi-mobile-actions-row' });
  const buttons = row.createDiv({ cls: 'culi-mobile-actions' });

  renderFavoriteToggle(buttons, app, file, meta.favorite, settings);
  renderMarkEatenButton(buttons, file, settings.eatingHistoryEnabled, actions.markEaten);
  renderPlanButton(buttons, file, actions.plannedThisWeek, actions.planMeal, actions.openPlan);
  renderEditButton(buttons, file, actions.editMeal);
}
