/**
 * The dashboard's building blocks: a card, its header, and the small pieces
 * every card uses to say it has nothing to show.
 *
 * The dashboard is a twelve-column grid of bordered cards rather than a stack
 * of headings, because the point of the view is that one glance answers
 * several questions at once, and a vertical list makes that a scroll instead.
 * The span helpers are the only place column arithmetic lives.
 *
 * Deliberately not the collapsible disclosure card the meal view uses. A
 * dashboard panel that can be folded shut is a dashboard that can be
 * configured into showing nothing.
 */

export type CardSpan = 4 | 8 | 12;

/** The grid every card sits in. One per render. */
export function dashboardGrid(container: HTMLElement): HTMLElement {
  return container.createDiv({ cls: 'culi-dashboard-grid' });
}

export function dashboardCard(grid: HTMLElement, span: CardSpan, extra?: string[]): HTMLElement {
  return grid.createDiv({
    cls: ['culi-dashboard-card', `culi-dashboard-span-${span}`, ...(extra ?? [])],
  });
}

/**
 * A bare grid cell, for a column that holds more than one card.
 *
 * The grocery and orders cards share one span-4 column. Left to the grid's own
 * auto-flow they land in separate cells, and since neither fills the column on
 * its own, orders ends up beside grocery rather than under it.
 */
export function dashboardColumn(grid: HTMLElement, span: CardSpan, extra?: string[]): HTMLElement {
  return grid.createDiv({ cls: [`culi-dashboard-span-${span}`, ...(extra ?? [])] });
}

export interface CardHeaderOptions {
  label: string;
  /** A link out to the view that owns this card's data, shown beside the label. */
  action?: { label: string; onClick: () => void };
}

/**
 * A card's header row.
 *
 * Returns the row so a caller can add a week nav or a select to it, which is
 * why this takes the label rather than being called after one is written.
 */
export function cardHeader(card: HTMLElement, options: CardHeaderOptions): HTMLElement {
  const header = card.createDiv({ cls: 'culi-dashboard-card-header' });
  header.createDiv({ cls: 'culi-dashboard-card-label', text: options.label });

  if (options.action) {
    const button = header.createEl('button', {
      cls: 'culi-dashboard-footer-btn',
      text: options.action.label,
    });
    button.addEventListener('click', options.action.onClick);
  }

  return header;
}

/** A label with no header row around it, for a card whose whole body is one thing. */
export function cardLabel(card: HTMLElement, text: string): void {
  card.createDiv({ cls: 'culi-dashboard-card-label', text });
}

/** The full-width link at the foot of a card. */
export function footerButton(card: HTMLElement, label: string, onClick: () => void): void {
  const button = card.createEl('button', { cls: 'culi-dashboard-footer-btn', text: label });
  button.addEventListener('click', onClick);
}

/**
 * A link in a card's header row, for a card with more than one of them.
 *
 * The same chip as a footer link, and deliberately the same class, so a card that
 * moves an action from the foot to the header keeps its wording, its colour and
 * its behaviour. The stylesheet gives the header variant a little padding and a
 * hover background on top of that: at the foot of a card a link is alone on its
 * line, while in a header it sits between a select and the week nav, where a
 * target exactly as tall as its own text is hard to hit and hard to tell apart
 * from the link beside it.
 *
 * `cardHeader`'s own `action` covers the single-action case; this is for adding a
 * second, or for adding one after a week nav is already in the row.
 */
export function headerButton(header: HTMLElement, label: string, onClick: () => void): void {
  const button = header.createEl('button', { cls: 'culi-dashboard-footer-btn', text: label });
  button.addEventListener('click', onClick);
}

/** The line a card shows instead of its content when there is nothing to show. */
export function renderEmpty(container: HTMLElement, text: string): void {
  container.createDiv({ cls: 'culi-dashboard-empty-text', text });
}

/**
 * An empty state with a way out of it.
 *
 * For the two cases where the reader can do something about being empty:
 * an unplanned week, and a vault with no meals yet. Everywhere else a plain
 * line is honest and a button would be noise.
 *
 */
export function renderEmptyCta(
  container: HTMLElement,
  text: string,
  action: { label: string; onClick: () => void }
): void {
  const cta = container.createDiv({ cls: 'culi-dashboard-empty-cta' });
  cta.createSpan({ cls: 'culi-dashboard-empty-text', text });
  const button = cta.createEl('button', {
    cls: 'culi-dashboard-empty-cta-btn',
    text: action.label,
  });
  button.addEventListener('click', action.onClick);
}
