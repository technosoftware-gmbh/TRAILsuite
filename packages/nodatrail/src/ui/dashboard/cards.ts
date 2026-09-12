/**
 * The dashboard's grid, and the picture card the PARA strips are made of.
 *
 * NODAtrail's other four views are lists, and a list is the right shape for
 * money. Areas, goals and projects are not money: there are a handful of them,
 * they are the things somebody has chosen to care about, and a picture is how a
 * person recognises one at a glance. So this is the one surface in the plugin
 * built from cards, and it is kept in its own module rather than added to
 * `kit/elements.ts`, which is deliberately small.
 *
 * **The column arithmetic lives here and nowhere else.** A span written as a
 * class at a call site is a span that cannot be changed later without finding
 * every one of them.
 *
 * **A card is one fixed size and its height does not depend on what is in it.**
 * A card is a grid item stretched to its row's height, so one short card makes
 * every neighbour grow. Three things together hold the height and none is
 * sufficient alone: the title is clamped *and* pinned to two lines, because
 * `line-clamp` caps the maximum while a fixed height also lifts the minimum;
 * the meta line is always rendered, empty if it has nothing to say; and a
 * `min-height` on the body carries a card that has neither. The sum is written
 * out in `styles.css` beside the rule. Adding a row means adding to that sum.
 */
import { setIcon } from 'obsidian';
import { t } from '../../lang/I18nManager';

/**
 * The spans this grid offers.
 *
 * Four, eight and twelve of twelve. Not every divisor: a set of three widths is
 * one somebody can hold in their head, and a sixth of a row is a card too
 * narrow for a title and a picture both.
 */
export type CardSpan = 4 | 8 | 12;

/** The twelve-column grid the whole dashboard sits in. */
export function dashboardGrid(parent: HTMLElement): HTMLElement {
  return parent.createDiv({ cls: 'nod-dashboard-grid' });
}

/**
 * The span classes, written out rather than built from the number.
 *
 * `nod-dashboard-span-${span}` would be shorter and would defeat
 * `tests/stylesheet.test.ts`, which reads quoted class names out of the source:
 * a name assembled at runtime is invisible to it, so every span rule would look
 * like a rule nothing sets. Spelled out, a span added without a rule fails the
 * build, which is the whole point of that test.
 */
const SPAN_CLASS: Record<CardSpan, string> = {
  4: 'nod-dashboard-span-4',
  8: 'nod-dashboard-span-8',
  12: 'nod-dashboard-span-12',
};

/** A bordered panel occupying `span` of the twelve columns. */
export function dashboardCard(grid: HTMLElement, span: CardSpan, extra?: string[]): HTMLElement {
  return grid.createDiv({ cls: ['nod-dashboard-card', SPAN_CLASS[span], ...(extra ?? [])] });
}

/**
 * A bare cell of the grid, for a track that holds more than one thing.
 *
 * Cards nested inside get their own column back, so they stack down the cell
 * rather than each claiming a track of the outer grid.
 */
export function dashboardColumn(grid: HTMLElement, span: CardSpan, extra?: string[]): HTMLElement {
  return grid.createDiv({ cls: [SPAN_CLASS[span], ...(extra ?? [])] });
}

/**
 * A card's header: its name, then whatever the caller appends.
 *
 * Returns the header rather than the title, because everything after the title
 * is an action or a link the caller decides on. **The title is the element that
 * gives way when the card is narrow** -- it truncates while the controls keep
 * their width, because what would otherwise be pushed off the edge is a button
 * nobody can then see is missing.
 */
export function cardHeader(card: HTMLElement, title: string): HTMLElement {
  const header = card.createDiv({ cls: 'nod-dashboard-card-header' });
  header.createDiv({ cls: 'nod-dashboard-card-label', text: title });
  return header;
}

/** A button in a card's header. Labelled, because a card header has room to say what it does. */
export function headerButton(
  parent: HTMLElement,
  label: string,
  icon: string,
  onClick: () => void
): HTMLElement {
  const button = parent.createEl('button', { cls: 'nod-dashboard-header-btn' });
  setIcon(button.createSpan({ cls: 'nod-icon' }), icon);
  button.createSpan({ text: label });
  button.addEventListener('click', () => onClick());
  return button;
}

/**
 * The horizontal run of cards inside a card.
 *
 * **Scrolls sideways rather than wrapping**, so a strip is always exactly one
 * row tall whatever it holds and whatever the window is doing. A wrapping strip
 * changes the height of the whole dashboard when a note is added, which moves
 * everything below it under a finger that is already on the way down.
 */
export function cardStrip(parent: HTMLElement): HTMLElement {
  return parent.createDiv({ cls: 'nod-dashboard-strip' });
}

export interface HeroCardOptions {
  title: string;
  /** Already resolved to a `src`, or null when there is nothing to draw. */
  image: string | null;
  /** Drawn on the placeholder panel when there is no image. A Lucide name. */
  fallbackIcon: string;
  /**
   * What the note said, when it named a picture that could not be shown.
   *
   * **A note with no picture and a note whose picture is missing used to draw
   * the same panel**, so a broken `image:` was indistinguishable from an empty
   * one and the only way to tell was to run the health check. Reported from a
   * real vault, where an attachment that had not finished syncing looked exactly
   * like a project nobody had chosen a picture for.
   *
   * Left undefined for a note that names none, which is not a fault and must
   * not be dressed as one.
   */
  missingImage?: string;
  /**
   * The one line under the title.
   *
   * Always rendered, empty string included: an optional line that appears only
   * sometimes is a card that is two heights.
   */
  meta: string;
  /** Marks the card as the one currently narrowing everything below it. */
  selected?: boolean;
  onClick: () => void;
  /** The pencil in the corner. Omitted where there is nothing to edit. */
  onEdit?: { label: string; run: () => void };
}

/**
 * One picture card.
 *
 * The whole card is the click target rather than the title, because a card is
 * a thing rather than a line of text with a link in it, and a target the size
 * of a word is one nobody hits on a tablet.
 */
export function heroCard(strip: HTMLElement, options: HeroCardOptions): HTMLElement {
  const card = strip.createDiv({ cls: 'nod-dashboard-hero' });
  card.toggleClass('nod-dashboard-hero-selected', options.selected === true);
  card.setAttr('role', 'button');
  card.setAttr('tabindex', '0');

  const slot = card.createDiv({ cls: 'nod-dashboard-hero-image' });
  if (options.image) {
    const image = slot.createEl('img', { attr: { src: options.image, alt: '', loading: 'lazy' } });
    // A path can resolve to a file that will not decode: a half-synced
    // attachment from iCloud is the usual one. Falling back to the placeholder
    // keeps the card its own size instead of collapsing the strip around a
    // broken-image glyph -- and it falls back to the *missing* panel, because
    // a picture that was named and did not arrive is the same fact whether the
    // path was wrong or the bytes were late.
    image.addEventListener('error', () => {
      image.remove();
      missing(slot, options.missingImage ?? '');
    });
  } else if (options.missingImage !== undefined) {
    missing(slot, options.missingImage);
  } else {
    placeholder(slot, options.fallbackIcon);
  }

  const body = card.createDiv({ cls: 'nod-dashboard-hero-body' });
  body.createDiv({ cls: 'nod-dashboard-hero-title', text: options.title });
  body.createDiv({ cls: 'nod-dashboard-hero-meta', text: options.meta });

  if (options.onEdit) {
    const button = card.createEl('button', { cls: 'nod-dashboard-hero-edit' });
    button.setAttr('aria-label', options.onEdit.label);
    setIcon(button.createSpan({ cls: 'nod-icon' }), 'pencil');
    button.addEventListener('click', (event) => {
      // Without this the card opens the note underneath the pencil, which is
      // the opposite of what somebody reaching for the pencil wants.
      event.stopPropagation();
      options.onEdit?.run();
    });
  }

  card.addEventListener('click', () => options.onClick());
  card.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    options.onClick();
  });

  return card;
}

/** The panel that stands in for a picture, at the same size the picture would be. */
function placeholder(slot: HTMLElement, icon: string): void {
  const empty = slot.createDiv({ cls: 'nod-dashboard-hero-empty' });
  setIcon(empty.createSpan({ cls: 'nod-icon' }), icon);
}

/**
 * The panel for a picture that was named and cannot be shown.
 *
 * A different glyph from the empty one, and the value the note carries as the
 * tooltip, so the answer to "why is there no picture" is on the card rather
 * than three clicks away in the health check.
 */
function missing(slot: HTMLElement, value: string): void {
  const empty = slot.createDiv({ cls: 'nod-dashboard-hero-empty nod-dashboard-hero-missing' });
  setIcon(empty.createSpan({ cls: 'nod-icon' }), 'image-off');
  empty.setAttr('aria-label', t('para.imageMissing', { value }));
  empty.setAttr('title', t('para.imageMissing', { value }));
}
