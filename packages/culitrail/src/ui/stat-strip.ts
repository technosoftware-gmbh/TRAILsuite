/**
 * A row of figures: a small uppercase label with its value under it, one
 * column per figure.
 *
 * This shape was written four separate times before it was extracted, in three
 * different DOMs: the meal header's nutrition grid, the mobile times row, and
 * the mobile Info tab's nutrition strip. The fourth is the badge row, which
 * still renders as pills and is what this exists to be pointed at next.
 *
 * A cell holds exactly one label and one value. That is the whole contract, and
 * it is what decides which badges can become cells at all: see
 * `meals/view-model/badge-display.ts`.
 */

/** One column. Both halves are already-resolved display text. */
export interface StatCell {
  label: string;
  value: string;
  /**
   * Marks this column as the first of a new group, drawn with a rule before it.
   *
   * The meal header puts two kinds of figure in one strip: nutrition, which a
   * caption describes, and times, which it does not. The rule is what stops the
   * caption reading as if it covered the whole row.
   */
  groupStart?: boolean;
}

/**
 * `plain` is bare columns sized to their content, for a strip sitting inside a
 * wider band that provides its own spacing. `boxed` is the bordered, equal-width,
 * centred form a phone uses, where the strip is the whole width of the view.
 *
 * A list rather than a bare union type, because the class name is built from it
 * at runtime and `tests/stylesheet.test.ts` cannot see a name it never reads as a
 * literal. The test imports this, so a third variant added without a rule for it
 * fails there rather than rendering unstyled.
 */
export const STAT_STRIP_VARIANTS = ['plain', 'boxed'] as const;

export type StatStripVariant = (typeof STAT_STRIP_VARIANTS)[number];

export interface StatStripOptions {
  variant?: StatStripVariant;
  /**
   * What the figures are figures *of*. Rendered as a sibling under the strip,
   * never inside it: it describes the row rather than any one column, and a
   * caption inside the grid would be placed as a cell.
   */
  caption?: string;
  /**
   * Where the caption goes. `tooltip` puts it on the strip's `title` instead of
   * rendering a line under it, for a gallery card: a card has no room for a
   * second line of small print, and dropping the caption entirely would leave
   * "615" with nothing saying whether that is a plate or a tray, which is the
   * failure `nutrition-row.ts` exists to prevent.
   */
  captionAs?: 'text' | 'tooltip';
  /** An extra class on the strip, for a caller that needs to position it. */
  cls?: string;
}

/**
 * Renders the strip, or nothing at all when there are no cells.
 *
 * Nothing at all matters: an empty bordered box on a phone reads as a thing
 * that failed to load, and an empty grid still takes vertical space above
 * whatever follows it.
 */
export function renderStatStrip(
  container: HTMLElement,
  cells: StatCell[],
  options: StatStripOptions = {}
): void {
  if (cells.length === 0) return;

  const variant = options.variant ?? 'plain';
  const classes = ['culi-stat-strip', `culi-stat-strip--${variant}`];
  if (options.cls) classes.push(options.cls);

  const strip = container.createDiv({ cls: classes });

  // Label and value are siblings in one grid rather than a wrapper element per
  // cell, and that is load-bearing. The grid's two rows are shared by every
  // column, so a label that wraps to two lines pushes *every* value down
  // together and the figures stay on one line across the strip. With a wrapper
  // per cell they would step. German is why this is not hypothetical:
  // `Kohlenhydrate` wraps in a column that fits `Carbs`.
  for (const cell of cells) {
    // The group rule is applied to both halves of the column rather than to a
    // wrapper, for the same reason the boxed variant's dividers are: a column is
    // two grid items and not a box.
    const group = cell.groupStart ? ['culi-stat-group-start'] : [];
    strip.createSpan({ cls: ['culi-stat-label', ...group], text: cell.label });
    strip.createSpan({ cls: ['culi-stat-value', ...group], text: cell.value });
  }

  if (!options.caption) return;

  if (options.captionAs === 'tooltip') strip.setAttr('title', options.caption);
  else container.createDiv({ cls: 'culi-stat-caption', text: options.caption });
}
