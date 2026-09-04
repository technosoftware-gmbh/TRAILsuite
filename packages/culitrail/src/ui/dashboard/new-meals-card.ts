/**
 * The newest meals, as a scrolling strip of gallery cards.
 *
 * The gallery's own card renderer rather than a smaller bespoke one: it already
 * knows how to show a meal, and a second card component would be a second
 * place for a meal to look different. The pictures are the point of this card
 * and the main reason the dashboard reads as a dashboard rather than as a list
 * of headings.
 *
 * Doubles as the empty-vault state. A vault with no meals has nothing newest,
 * and "add your first meal" is the only useful thing this slot could say.
 */
import { App } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { frontmatterImageSrc, runLazyImagePass } from '../../meals/gallery/card-images';
import { renderGalleryCard, type GalleryCardHandle } from '../../meals/gallery/gallery-card';
import type { GalleryEntry } from '../../meals/view-model/gallery-entry';
import { defaultMealImageValue } from '../../meals/view-model/hero-image';
import { frontmatterOf } from '../../shared/vault-scan';
import { resolveImagePath } from '../images';
import { cardHeader, dashboardCard } from './section';
import type { DashboardViewDeps } from './deps';

/**
 * Six, not four.
 *
 * The strip had a span-4 orders card beside it and now has the row to itself.
 * Six fills that width at the card size the gallery already uses, rather than
 * four cards and a gap where the orders were.
 */
const STRIP_LIMIT = 6;

export function renderNewMealsCard(
  grid: HTMLElement,
  app: App,
  deps: DashboardViewDeps,
  entries: GalleryEntry[],
  isStale: () => boolean
): void {
  const settings = deps.getSettings();

  if (entries.length === 0) {
    const empty = dashboardCard(grid, 12, ['culi-dashboard-empty-vault-cta']);
    // Writing the first one down, with fetching it beside rather than instead:
    // an empty vault is exactly where somebody typing out a family meal was
    // sent to a URL box and had nowhere else to go.
    const button = empty.createEl('button', {
      cls: 'culi-dashboard-empty-cta-btn',
      text: t('dashboard.library.addFirstMeal'),
    });
    button.addEventListener('click', () => deps.newMeal());

    return;
  }

  const card = dashboardCard(grid, 12, ['culi-dashboard-new-meals']);
  cardHeader(card, {
    label: t('dashboard.newMeals.title'),
    action: { label: t('dashboard.library.browse'), onClick: () => deps.openGallery() },
  });

  const newest = [...entries].sort((a, b) => b.createdAt - a.createdAt).slice(0, STRIP_LIMIT);

  const strip = card.createDiv({ cls: 'culi-dashboard-new-meals-strip' });
  const awaitingImage: GalleryCardHandle[] = [];

  for (const entry of newest) {
    const frontmatter = frontmatterOf(app, entry.file) ?? {};
    const handle = renderGalleryCard(
      strip,
      app,
      entry,
      frontmatter,
      settings,
      (file) => deps.openMeal(file.path),
      {
        planMeal: (file) => deps.planMeal(file),
      }
    );

    const src = frontmatterImageSrc(app, entry, frontmatter, settings);
    if (src) handle.setImage(src);
    else awaitingImage.push(handle);
  }

  if (awaitingImage.length === 0) return;

  // The same lazy pass the gallery runs, so a meal whose picture is in its
  // body rather than its frontmatter still shows one here. Cancelled through
  // `isStale` because a re-render replaces the cards this would be writing into.
  const defaultValue = defaultMealImageValue(settings);
  const fallback = defaultValue ? resolveImagePath(app, defaultValue) : null;

  void runLazyImagePass(
    app,
    awaitingImage.map((handle) => handle.file),
    settings,
    (file, src) => {
      awaitingImage.find((handle) => handle.file.path === file.path)?.setImage(src ?? fallback);
    },
    isStale
  );
}
