/**
 * Pure, presentation-only 1-5 star row. Renders the stars and reports clicks
 * through a callback; has no opinion about where the underlying value lives
 * or how it gets persisted.
 *
 * Keeping persistence out of here is the point: a rating is not always a
 * top-level frontmatter value that could simply be written back with
 * app.fileManager.processFrontMatter, so every caller supplies its own
 * write path through onChange -- or omits it entirely for a read-only row.
 */
export const STAR_COUNT = 5;
const STAR_FILLED = '★';
const STAR_EMPTY = '☆';

export interface StarRowOptions {
  // When false, the row is read-only: no click-to-rate, no hover preview,
  // stars are not focusable.
  interactive?: boolean;
  // Highlight-on-hover preview. Only meaningful when interactive.
  hoverPreview?: boolean;
  // Called with the new value whenever the user picks a star. Clicking the
  // currently-active top star clears the rating (reports 0). Required when
  // interactive is true; ignored otherwise.
  onChange?: (value: number) => void;
}

/** Renders a star row for `value` (clamped 0-STAR_COUNT) into `container`. */
export function renderStarRow(
  container: HTMLElement,
  value: number,
  options: StarRowOptions = {}
): void {
  const interactive = options.interactive ?? true;
  const hoverPreview = options.hoverPreview ?? false;

  let current = Math.min(STAR_COUNT, Math.max(0, Math.round(value)));
  const row = container.createDiv({ cls: 'apt-star-rating' });
  row.toggleClass('apt-star-rating-readonly', !interactive);
  const stars: HTMLElement[] = [];

  function applyDisplay(highlight: number): void {
    stars.forEach((s, i) => {
      s.textContent = i < highlight ? STAR_FILLED : STAR_EMPTY;
      s.toggleClass('apt-star-active', i < highlight);
    });
  }

  for (let i = 1; i <= STAR_COUNT; i++) {
    const attr: Record<string, string> = interactive ? { role: 'button', tabindex: '0' } : {};
    const star = row.createSpan({ cls: 'apt-star', attr });
    stars.push(star);

    if (!interactive) continue;

    star.addEventListener('click', () => {
      const next = i === current ? 0 : i;
      current = next;
      applyDisplay(current);
      options.onChange?.(current);
    });

    if (hoverPreview) {
      star.addEventListener('mouseenter', () => applyDisplay(i));
      row.addEventListener('mouseleave', () => applyDisplay(current));
    }
  }

  applyDisplay(current);
}
