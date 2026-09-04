/**
 * Which layout renders a meal, and how a layout id turns into a renderer.
 *
 * The choice is kept apart from the renderers so that adding a width-based or
 * per-meal rule later touches one function rather than every layout module.
 */
import { Platform } from 'obsidian';
import { renderDesktopClassicLayout } from './desktop-classic';
import { renderMobileTabsLayout } from './mobile-tabs';
import type { MealLayoutId, MealLayoutRenderer } from './types';

const LAYOUTS: Record<MealLayoutId, MealLayoutRenderer> = {
  'mobile-tabs': renderMobileTabsLayout,
  'desktop-classic': renderDesktopClassicLayout,
};

/**
 * The layout a reader should get, given the platform and the setting.
 *
 * Mobile is not a setting. The tabbed layout is not a narrower version of a
 * desktop one, it is a different arrangement for a different way of holding
 * the device, so offering the desktop layouts on a phone would only offer a
 * worse experience.
 */
export function resolveMealLayoutId(): MealLayoutId {
  return Platform.isMobile ? 'mobile-tabs' : 'desktop-classic';
}

/**
 * The renderer for a layout id.
 *
 * Falls back to the desktop layout rather than throwing, because the id can
 * come from a hand-edited `data.json` and a meal that renders in the wrong
 * arrangement beats a meal that does not render.
 */
export function getMealLayoutRenderer(id: string): MealLayoutRenderer {
  return LAYOUTS[id as MealLayoutId] ?? LAYOUTS['desktop-classic'];
}
