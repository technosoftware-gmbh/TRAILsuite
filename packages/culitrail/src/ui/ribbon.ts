/**
 * The ribbon icons.
 *
 * **Every icon is built once, at load, and shown or hidden by CSS class.**
 * Obsidian's ribbon does not reliably drop an icon once added: it keeps its
 * own record of registered actions and can redraw a "removed" one on the next
 * layout. Building them all and toggling visibility is the only arrangement
 * that survives a settings change without either losing an icon or gaining a
 * duplicate.
 */
import { Plugin } from 'obsidian';
import { t } from '../lang/I18nManager';
import type { CULItrailSettings } from '../settings/types';

export interface RibbonActions {
  openDashboard: () => void;
  openGallery: () => void;
  openMealPlan: () => void;
}

interface RibbonIcon {
  el: HTMLElement;
  /** Whether this icon should be visible under the current settings. */
  wanted: (settings: CULItrailSettings) => boolean;
}

export class Ribbon {
  private readonly icons: RibbonIcon[] = [];

  constructor(plugin: Plugin, actions: RibbonActions) {
    // The dashboard replaces the others rather than joining them: it is a way
    // into all of them, and showing three icons that lead to one screen and
    // its panels is three icons too many.
    this.add(
      plugin,
      'chef-hat',
      t('dashboard.title'),
      actions.openDashboard,
      (settings) => settings.enableDashboard
    );
    this.add(
      plugin,
      'library',
      t('meals.gallery.title'),
      actions.openGallery,
      (settings) => !settings.enableDashboard
    );
    this.add(
      plugin,
      'calendar-days',
      t('planning.mealPlan.title'),
      actions.openMealPlan,
      (settings) => !settings.enableDashboard
    );
  }

  private add(
    plugin: Plugin,
    icon: string,
    label: string,
    onClick: () => void,
    wanted: (settings: CULItrailSettings) => boolean
  ): void {
    this.icons.push({ el: plugin.addRibbonIcon(icon, label, onClick), wanted });
  }

  /** Shows the icons the current settings ask for. Called at load and after a settings change. */
  update(settings: CULItrailSettings): void {
    for (const icon of this.icons) {
      icon.el.toggleClass('culi-hidden', !settings.showRibbonIcons || !icon.wanted(settings));
    }
  }
}
