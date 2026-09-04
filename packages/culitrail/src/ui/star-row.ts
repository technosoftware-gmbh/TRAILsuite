/**
 * A one-to-five star row that renders and reports, and has no opinion about
 * where the value lives.
 *
 * Two things carry a rating, and each stores it somewhere different: an entry
 * inside a meal plan note, and the dialog that records one. Both are the same
 * question, how this helping was, asked at different moments. Persistence
 * belongs to the caller, through `onChange`, and only the drawing lives here.
 *
 * A meal note used to carry a rating of its own as well. It was removed: how
 * good a dish is on average is a worse question than how it was the time you
 * ate it, and the second one is answered on the plan.
 */

export const STAR_COUNT = 5;

const FILLED = '★';
const EMPTY = '☆';

export interface StarRowOptions {
  /** False makes the row read-only: no clicking, no hover preview, not focusable. */
  interactive?: boolean;
  /** Highlights up to the star under the pointer. Only meaningful when interactive. */
  hoverPreview?: boolean;
  /**
   * Called with the new value. Clicking the star that is currently the top of
   * the rating clears it and reports 0, which is the only way to un-rate
   * something without editing frontmatter by hand.
   */
  onChange?: (value: number) => void;
}

export function renderStarRow(
  container: HTMLElement,
  value: number,
  options: StarRowOptions = {}
): void {
  const interactive = options.interactive ?? true;
  const hoverPreview = options.hoverPreview ?? false;

  let current = clampRating(value);
  const row = container.createDiv({ cls: 'culi-star-rating' });
  row.toggleClass('culi-star-rating-readonly', !interactive);

  const stars: HTMLElement[] = [];
  const paint = (upTo: number) => {
    stars.forEach((star, index) => {
      star.textContent = index < upTo ? FILLED : EMPTY;
      star.toggleClass('culi-star-active', index < upTo);
    });
  };

  for (let position = 1; position <= STAR_COUNT; position++) {
    const attr = interactive ? { role: 'button', tabindex: '0' } : {};
    const star = row.createSpan({ cls: 'culi-star', attr });
    stars.push(star);

    if (!interactive) continue;

    star.addEventListener('click', () => {
      current = position === current ? 0 : position;
      paint(current);
      options.onChange?.(current);
    });

    if (hoverPreview) {
      star.addEventListener('mouseenter', () => paint(position));
      row.addEventListener('mouseleave', () => paint(current));
    }
  }

  paint(current);
}

/** A rating as a whole number of stars in range, whatever a note actually said. */
export function clampRating(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(STAR_COUNT, Math.max(0, Math.round(value)));
}
