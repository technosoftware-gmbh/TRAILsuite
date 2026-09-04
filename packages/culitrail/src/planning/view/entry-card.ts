/**
 * One meal, as a card in the week grid.
 *
 * A meal entry and a plain named meal are the same card with a different
 * picture: one shows the meal's photo and opens it, the other shows an
 * icon. Keeping them one function is what stops the two drifting apart.
 */
import { App, Menu, setIcon, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { MEAL_SLOT_KEYS, mealSlotLabel } from '../../lang/vocabulary';
import { resolveImagePath, usableImageValue } from '../../ui/images';
import { renderStarRow } from '../../ui/star-row';
import { frontmatterOf } from '../../shared/vault-scan';
import type { CULItrailSettings, MealPlanEntry } from '../../settings/types';
import { frontmatterImageValue } from '../../meals/view-model/hero-image';
import { makeDraggable } from './drag';

export interface EntryCardActions {
  openMeal: (path: string) => void;
  remove: (id: string) => void;
  setSlot: (id: string, slot: string | undefined) => void;
  setRating: (id: string, rating: number | undefined) => void;
  setLeftovers: (id: string, isLeftovers: boolean) => void;
  setEaten: (id: string, eaten: boolean) => void;
}

/** The meal's picture, from frontmatter only. A card is small and a body read per card is not worth it. */
function thumbnailSrc(app: App, mealPath: string, settings: CULItrailSettings): string | null {
  const file = app.vault.getFileByPath(mealPath);
  if (!(file instanceof TFile)) return null;

  const value = usableImageValue(
    app,
    frontmatterImageValue(frontmatterOf(app, file) ?? {}, settings)
  );
  return value ? resolveImagePath(app, value) : null;
}

function openMenu(event: MouseEvent, entry: MealPlanEntry, actions: EntryCardActions): void {
  const menu = new Menu();

  for (const slot of MEAL_SLOT_KEYS) {
    menu.addItem((item) =>
      item
        .setTitle(mealSlotLabel(slot))
        .setChecked(entry.meal === slot)
        // Clicking the slot it already has clears it, which is the only way
        // back to "no particular meal" without editing the note.
        .onClick(() => actions.setSlot(entry.id, entry.meal === slot ? undefined : slot))
    );
  }

  menu.addSeparator();

  // The checkbox in the note, reachable from the card. Ticking it here is the
  // same edit as ticking it in Obsidian, and the note is what both agree on.
  menu.addItem((item) =>
    item
      .setTitle(t('planning.card.eaten'))
      .setIcon('check')
      .setChecked(Boolean(entry.eaten))
      .onClick(() => actions.setEaten(entry.id, !entry.eaten))
  );

  menu.addItem((item) =>
    item
      .setTitle(t('planning.card.leftovers'))
      .setIcon('utensils-crossed')
      .setChecked(Boolean(entry.isLeftovers))
      .onClick(() => actions.setLeftovers(entry.id, !entry.isLeftovers))
  );

  menu.addItem((item) =>
    item
      .setTitle(t('planning.card.remove'))
      .setIcon('trash-2')
      .onClick(() => actions.remove(entry.id))
  );

  menu.showAtMouseEvent(event);
}

export function renderEntryCard(
  container: HTMLElement,
  app: App,
  entry: MealPlanEntry,
  settings: CULItrailSettings,
  actions: EntryCardActions
): void {
  const card = container.createDiv({ cls: 'culi-mpv-card' });
  card.toggleClass('culi-mpv-card--leftovers', Boolean(entry.isLeftovers));
  makeDraggable(card, entry.id);

  const thumb = card.createDiv({ cls: 'culi-mpv-card-thumb' });
  const src = entry.mealPath ? thumbnailSrc(app, entry.mealPath, settings) : null;
  if (src) {
    const image = thumb.createEl('img', { attr: { src, loading: 'lazy', draggable: 'false' } });
    image.onerror = () => {
      image.remove();
      thumb.addClass('culi-mpv-card-thumb--empty');
      setIcon(thumb, 'utensils');
    };
  } else {
    thumb.addClass('culi-mpv-card-thumb--empty');
    setIcon(thumb, entry.isLeftovers ? 'utensils-crossed' : 'utensils');
  }

  const body = card.createDiv({ cls: 'culi-mpv-card-body' });

  const title = entry.mealPath
    ? (entry.mealPath.split('/').pop()?.replace(/\.md$/i, '') ?? entry.mealPath)
    : (entry.label ?? t('planning.card.untitledMeal'));
  body.createDiv({ cls: 'culi-mpv-card-name', text: title });

  // One row for both labels, and the row exists whether either label does. Two
  // reasons, and each on its own would be enough: stacked, a card carrying a slot
  // *and* a leftovers marker stood a line taller than its neighbours, and on a
  // narrow column the second label wrapped below the first, so the same card
  // changed height with the pane width. A row that is always present makes every
  // card the same height no matter which labels it happens to carry.
  const tags = body.createDiv({ cls: 'culi-mpv-card-tags' });

  // The translated slot name, from the stable key stored on the entry.
  if (entry.meal) tags.createSpan({ cls: 'culi-mpv-card-meal', text: mealSlotLabel(entry.meal) });

  if (entry.isLeftovers) {
    // The label, not the card modifier above: they had the same class, so the
    // label inherited the card's dashed border and never picked up the muted
    // styling written for it.
    tags.createSpan({ cls: 'culi-mpv-card-leftovers-badge', text: t('planning.card.leftovers') });
  }

  // How this cook turned out, which is a different thing from how good the
  // meal is in general. Zero clears it.
  renderStarRow(body, entry.rating ?? 0, {
    onChange: (value) => actions.setRating(entry.id, value === 0 ? undefined : value),
  });

  // Two buttons rather than one overflow menu. Removing a card and changing its
  // slot are the two things done to a plan repeatedly while filling a week in,
  // and putting either behind a menu makes that two clicks each. The menu stays
  // for leftovers and for the slot list, which are neither frequent nor
  // expressible as an icon.
  const buttons = card.createDiv({ cls: 'culi-mpv-card-actions' });

  const slotButton = buttons.createEl('button', {
    cls: 'culi-mpv-card-action-btn',
    attr: { 'aria-label': t('planning.card.actions') },
  });
  setIcon(slotButton.createSpan({ cls: 'culi-icon-slot' }), 'more-vertical');
  slotButton.addEventListener('click', (event) => {
    // Otherwise the card's own click handler opens the meal behind the menu.
    event.stopPropagation();
    openMenu(event, entry, actions);
  });

  const removeButton = buttons.createEl('button', {
    cls: ['culi-mpv-card-action-btn', 'culi-mpv-card-action-btn--danger'],
    attr: { 'aria-label': t('planning.card.remove') },
  });
  setIcon(removeButton.createSpan({ cls: 'culi-icon-slot' }), 'trash-2');
  removeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    actions.remove(entry.id);
  });

  if (entry.mealPath) {
    card.addEventListener('click', () => actions.openMeal(entry.mealPath));
  }
}
