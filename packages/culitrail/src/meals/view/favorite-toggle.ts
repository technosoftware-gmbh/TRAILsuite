/**
 * The heart in the meal header.
 *
 * Writes to the configured favorite property, and **deletes** it rather than
 * writing `false`. A meal that was never a favorite and one that was
 * un-favorited are the same thing, and a stored `false` would leave every
 * meal somebody ever clicked carrying a property the others do not have.
 */
import { App, setIcon, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { stampModified } from 'trail-core';
import type { CULItrailSettings } from '../../settings/types';

async function persistFavorite(
  app: App,
  file: TFile,
  settings: CULItrailSettings,
  value: boolean
): Promise<void> {
  await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
    if (value) frontmatter[settings.favoriteProperty] = true;
    else delete frontmatter[settings.favoriteProperty];
    stampModified(frontmatter, settings);
  });
}

export function renderFavoriteToggle(
  container: HTMLElement,
  app: App,
  file: TFile,
  favorite: boolean,
  settings: CULItrailSettings
): void {
  let active = favorite;

  const button = container.createEl('button', {
    cls: 'culi-action-btn',
    attr: { 'aria-pressed': String(active), 'aria-label': t('meals.header.toggleFavorite') },
  });
  button.toggleClass('culi-favorite-active', active);
  setIcon(button.createSpan(), 'heart');

  button.addEventListener('click', () => {
    active = !active;
    // The button updates itself rather than waiting for the re-render the
    // frontmatter write will trigger. A heart that fills a moment after the
    // click reads as a missed tap.
    button.setAttribute('aria-pressed', String(active));
    button.toggleClass('culi-favorite-active', active);
    void persistFavorite(app, file, settings, active);
  });
}
