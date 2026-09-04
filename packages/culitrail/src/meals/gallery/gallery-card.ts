/**
 * One card in the grid: a picture with the title over it, then four fixed rows
 * saying what the dish is, what is in it, what it costs, and what has happened
 * to it.
 *
 * The three rows are fixed rather than conditional because a card is a grid item
 * stretched to its row's height: one taller card makes every card beside it
 * taller. `view-model/card-face.ts` composes them and records the counts that
 * decided which rows earn a place.
 *
 * Nothing here mutates a meal. The card opens it.
 */
import { App, Menu, setIcon, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import type { CULItrailSettings, CustomBadge } from '../../settings/types';
import { renderStatStrip } from '../../ui/stat-strip';
import { renderBadgeChips } from '../view/badge-row';
import { renderPriceLine } from '../view/price-line';
import { planBadges } from '../view-model/badge-display';
import { cardFace } from '../view-model/card-face';
import { type GalleryEntry } from '../view-model/gallery-entry';

export interface GalleryCardHandle {
  file: TFile;
  /** Swaps the picture in once the lazy pass has found one, or clears it. */
  setImage: (src: string | null) => void;
}

/**
 * Which badges a card does not show.
 *
 * A card is small. The layout elements mean nothing without a full row to space
 * out, and the time and cook figures have their own strip at the bottom of the
 * card, so a built-in repeating one of them would say the same thing twice. A
 * badge somebody added themselves is always kept: they added it because they want
 * to see it.
 */
function skipOnCard(badge: CustomBadge, settings: CULItrailSettings): boolean {
  const type = badge.type ?? 'badge';
  if (type !== 'badge') return true;
  if (!badge.builtin) return false;
  return badge.property !== settings.dietProperty && badge.property !== 'diet';
}

/**
 * The card's overflow menu.
 *
 * Separate from the card's own click, which opens the meal, so the one action
 * somebody wants from a grid of cards does not require opening each one first.
 */
function openActionsMenu(event: MouseEvent, file: TFile, actions: GalleryCardActions): void {
  const menu = new Menu();
  menu.addItem((item) =>
    item
      .setTitle(t('meals.gallery.card.addToMealPlan'))
      .setIcon('calendar-plus')
      .onClick(() => actions.planMeal(file))
  );
  menu.showAtMouseEvent(event);
}

/**
 * What a card can do besides open its meal.
 *
 * An object rather than more positional callbacks: the card is rendered from
 * two places and the list only grows, so a caller passing them in the wrong
 * order is a bug the compiler would not catch.
 */
export interface GalleryCardActions {
  planMeal: (file: TFile) => void;
}

export function renderGalleryCard(
  grid: HTMLElement,
  app: App,
  entry: GalleryEntry,
  frontmatter: Record<string, unknown>,
  settings: CULItrailSettings,
  onOpen: (file: TFile) => void,
  actions: GalleryCardActions
): GalleryCardHandle {
  const card = grid.createDiv({
    cls: 'culi-gallery-card',
    attr: { role: 'button', tabindex: '0' },
  });

  const imageSlot = card.createDiv({ cls: 'culi-gallery-card-image' });
  let image: HTMLImageElement | null = null;

  function setImage(src: string | null): void {
    // Only the picture is replaced. The slot also holds the title overlay and
    // the favorite mark, which have to survive a lazy image arriving.
    image?.remove();
    image = null;
    imageSlot.toggleClass('culi-gallery-card-image--empty', !src);
    if (!src) return;

    image = imageSlot.createEl('img', { attr: { src, loading: 'lazy' } });
    imageSlot.prepend(image);
    image.onerror = () => {
      image?.remove();
      image = null;
      imageSlot.addClass('culi-gallery-card-image--empty');
    };
  }

  setImage(null);

  if (entry.meta.favorite) {
    setIcon(imageSlot.createDiv({ cls: 'culi-gallery-card-favorite' }), 'heart');
  }

  const menuButton = imageSlot.createEl('button', {
    cls: 'culi-gallery-card-menu-btn',
    attr: { 'aria-label': t('meals.gallery.card.actions') },
  });
  setIcon(menuButton.createSpan({ cls: 'culi-icon-slot' }), 'more-vertical');
  menuButton.addEventListener('click', (event) => {
    // Otherwise the click reaches the card and opens the meal behind the menu
    // that just opened.
    event.stopPropagation();
    openActionsMenu(event, entry.file, actions);
  });

  const overlay = imageSlot.createDiv({ cls: 'culi-gallery-card-title-overlay' });
  overlay.createDiv({ cls: 'culi-gallery-card-title', text: entry.title });

  const info = card.createDiv({ cls: 'culi-gallery-card-info' });
  const face = cardFace(entry, settings);

  // Four rows, in the order a product card states a dish. Each is always created,
  // so a card with nothing to say in one of them is still the same height as its
  // neighbours.
  const chips = info.createDiv({ cls: 'culi-gallery-card-chips' });
  renderBadgeChips(
    chips,
    // The entry's own log, so the streak on a card and the streak on the
    // meal view are computed from one source.
    planBadges(
      frontmatter,
      settings,
      (badge) => skipOnCard(badge, settings),
      new Date(),
      entry.meta.eatingHistory
    )
  );

  renderStatStrip(info, face.nutrition, {
    variant: 'plain',
    cls: 'culi-gallery-card-nutrition',
    caption: face.nutritionCaption ?? undefined,
    captionAs: 'tooltip',
  });

  // Between the two strips, which is where the product card this was modelled on
  // puts it: what is in the dish, what it costs, then what has happened to it.
  renderPriceLine(info, face.price, 'culi-gallery-card-price');

  renderStatStrip(info, face.info, { variant: 'plain', cls: 'culi-gallery-card-info-strip' });

  const open = () => onOpen(entry.file);
  card.addEventListener('click', open);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  });

  return { file: entry.file, setImage };
}
