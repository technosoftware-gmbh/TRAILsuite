/**
 * Renders a single entity card: an image with a bottom title overlay, an
 * optional 3-dot actions menu, an optional read-only star row, and a small
 * icon-led meta row. Both the dashboard sections and the gallery render
 * through this one function on the shared `apt-gallery-card*` classes, so a
 * card for the same entity looks identical on either surface.
 *
 * The meta row is passed in by the caller rather than derived here: what is
 * worth showing differs per entity type (see ui/dashboard/
 * travel-entity-meta.ts), and keeping that out of the card leaves this file
 * with no knowledge of the Travel model at all.
 *
 * The star row is deliberately read-only (`interactive: false`): callers
 * already hold a resolved numeric rating from the read-time model
 * (vault/types.ts), so there is no frontmatter/property-name lookup left
 * for this component to do, and nothing to write back.
 */
import { App, Menu, setIcon, TFile } from 'obsidian';
import { resolveImagePath, usableImageValue } from './image-resolve';
import { renderStarRow } from './star-rating';
import { t } from '../../lang/I18nManager';
import { frontmatterOf } from '../../shared/vault-host';

export interface EntityCardMetaItem {
  icon: string;
  text: string;
}

export interface EntityCardActions {
  openEntity: (file: TFile) => void;
  // Optional, and no caller passes it today: travel entities are meant to
  // stay reusable across trips rather than moving through an
  // Active/Archive lifecycle. When it is omitted the 3-dot menu is skipped
  // entirely, rather than shown with a single always-disabled item.
  archiveEntity?: (file: TFile) => void;
  /**
   * Extra 3-dot menu entries, appended after Archive. Trip cards are the
   * one entity with an edit surface -- every other entity is
   * create-then-hand-edit, while a trip gets built up over time. Kept as an
   * open list rather than an `editEntity` field so a future third kind of
   * action doesn't need another optional field here.
   */
  menuItems?: { label: string; icon: string; onClick: (file: TFile) => void }[];
}

/**
 * The picture a card shows, from the note's frontmatter.
 *
 * Synchronous and frontmatter-only: an entity note carries its picture as a
 * plain value -- vault path, URL or wikilink, all handled by
 * `image-resolve.ts` -- so there is no lazy scan of the body to fall back on
 * and nothing here needs to be async.
 *
 * **The key is a setting now.** It was the literal `image`, which made it the
 * one vault-facing name in this plugin that a vault could not rename, and the
 * reason a trip's picture could only ever be typed in by hand. `key` is passed
 * in rather than read from settings here so this stays App-and-settings-light;
 * the caller already has them.
 */
export function getEntityImageSrc(app: App, file: TFile, key: string): string | null {
  const raw = frontmatterOf(app, file)?.[key.trim() || 'image'];
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const usable = usableImageValue(app, raw.trim());
  return usable ? resolveImagePath(app, usable) : null;
}

function hasMenu(actions: EntityCardActions): boolean {
  return actions.archiveEntity !== undefined || (actions.menuItems?.length ?? 0) > 0;
}

function openActionsMenu(evt: MouseEvent, file: TFile, actions: EntityCardActions): void {
  if (!hasMenu(actions)) return;
  const menu = new Menu();
  const archiveEntity = actions.archiveEntity;
  if (archiveEntity) {
    menu.addItem((item) =>
      item
        .setTitle(t('dashboard.archive'))
        .setIcon('archive')
        .onClick(() => void archiveEntity(file))
    );
  }
  for (const entry of actions.menuItems ?? []) {
    menu.addItem((item) =>
      item
        .setTitle(entry.label)
        .setIcon(entry.icon)
        .onClick(() => entry.onClick(file))
    );
  }
  menu.showAtMouseEvent(evt);
}

function renderMetaRow(container: HTMLElement, items: EntityCardMetaItem[]): void {
  if (items.length === 0) return;
  const row = container.createDiv({ cls: 'apt-gallery-card-meta-row' });
  for (const { icon, text } of items) {
    const el = row.createSpan({ cls: 'apt-gallery-card-meta-item' });
    setIcon(el.createSpan({ cls: 'apt-gallery-card-meta-icon' }), icon);
    el.createSpan({ text });
  }
}

/**
 * What a card needs beyond the note itself.
 *
 * An object rather than three more positional arguments. The signature had
 * grown a trailing optional already, and a sixth and seventh position is where
 * a call site starts passing `null, null, undefined` and nobody can read it.
 */
export interface EntityCardExtras {
  /**
   * The frontmatter key holding the picture, from settings.
   *
   * Required rather than defaulted to `image`: a default here would quietly
   * reinstate the hardcoded key this parameter exists to remove.
   */
  imageKey: string;
  /**
   * Read-only 1-5 stars, per travel-module-plan.md §6. Most cards have none:
   * null, 0 and unset all mean "draw no rating row" rather than an empty one.
   */
  rating?: number | null;
  /** The line under the title. Drawn only when the note carries one. */
  subtitle?: string | null;
}

export function renderEntityCard(
  container: HTMLElement,
  app: App,
  file: TFile,
  metaItems: EntityCardMetaItem[],
  actions: EntityCardActions,
  extras: EntityCardExtras
): void {
  const { imageKey, rating = null, subtitle = null } = extras;
  const card = container.createDiv({
    cls: 'apt-gallery-card',
    attr: { role: 'button', tabindex: '0' },
  });

  const imageSlot = card.createDiv({ cls: 'apt-gallery-card-image' });
  const src = getEntityImageSrc(app, file, imageKey);
  imageSlot.toggleClass('apt-gallery-card-image--empty', !src);
  if (src) {
    const img = imageSlot.createEl('img', { attr: { src, loading: 'lazy' } });
    imageSlot.prepend(img);
    img.onerror = () => {
      img.remove();
      imageSlot.addClass('apt-gallery-card-image--empty');
    };
  }

  if (hasMenu(actions)) {
    const menuBtn = imageSlot.createDiv({
      cls: 'apt-gallery-card-menu-btn',
      attr: { role: 'button', 'aria-label': t('dashboard.entityActions'), tabindex: '0' },
    });
    setIcon(menuBtn, 'more-vertical');
    menuBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      openActionsMenu(evt, file, actions);
    });
  }

  const titleOverlay = imageSlot.createDiv({ cls: 'apt-gallery-card-title-overlay' });
  titleOverlay.createDiv({ cls: 'apt-gallery-card-title', text: file.basename });
  // Under the name, in the overlay rather than in the meta row below: it says
  // what the thing is, which belongs with what it is called.
  if (subtitle) {
    titleOverlay.createDiv({ cls: 'apt-gallery-card-subtitle', text: subtitle });
  }

  const info = card.createDiv({ cls: 'apt-gallery-card-info' });
  if (rating && rating > 0) {
    renderStarRow(info, rating, { interactive: false });
  }
  renderMetaRow(info, metaItems);

  const open = (): void => actions.openEntity(file);
  card.addEventListener('click', open);
  card.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault();
      open();
    }
  });
}
