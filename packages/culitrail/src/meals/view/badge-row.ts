/**
 * The meal header's badges and tag row, as DOM.
 *
 * Every decision about *what* a badge says was already made in
 * `view-model/badge-values.ts`, and every decision about *where* it goes in
 * `view-model/badge-display.ts`. Both are testable without a window. This file
 * only turns a planned row into elements, so the gallery card and the meal
 * header can render the same configuration at two different sizes without
 * either one re-deciding anything.
 *
 * Badges render as two things. Categorical ones stay pills; figures become
 * columns in a stat strip. Which is which is the split, not a judgement made
 * here.
 */
import { setIcon } from 'obsidian';
import type { BadgeColor, CULItrailSettings, CustomBadge } from '../../settings/types';
import { renderStatStrip } from '../../ui/stat-strip';
import { badgeCells, planBadges, type SplitBadgeRow } from '../view-model/badge-display';

/**
 * The colour one value wears.
 *
 * Per-value first, the badge's own colour behind it. Case-insensitive, so a
 * vault that writes `Vegan` and one that writes `vegan` configure once.
 */
function colorFor(badge: CustomBadge, value: string): BadgeColor {
  const map = badge.valueColors;
  if (!map || !value) return badge.color;

  const wanted = value.trim().toLowerCase();
  for (const [key, color] of Object.entries(map)) {
    if (key.trim().toLowerCase() === wanted) return color;
  }
  return badge.color;
}

function renderChip(row: HTMLElement, badge: CustomBadge, label: string, value: string): void {
  const chip = row.createSpan({ cls: ['culi-badge', `culi-badge-${colorFor(badge, value)}`] });

  if (badge.icon) setIcon(chip.createSpan({ cls: 'culi-badge-icon' }), badge.icon);
  if (!badge.hideLabel && label) chip.createSpan({ cls: 'culi-badge-label', text: label });

  // A valueless chip is not a bug: a boolean badge such as Favorite renders
  // as its icon and label alone, and hanging an empty span off it would
  // leave a stray gap inside the pill.
  if (!value) return;

  if (badge.prefix) chip.createSpan({ cls: 'culi-badge-prefix', text: badge.prefix });
  chip.createSpan({ cls: 'culi-badge-value', text: value });
  if (badge.suffix) chip.createSpan({ cls: 'culi-badge-suffix', text: badge.suffix });
}

/**
 * Renders the categorical badges as a row of pills, or nothing at all.
 *
 * Nothing at all matters, and it is the common case for a bare meal: an empty
 * row still occupies vertical space above the title of every note that states no
 * metadata.
 */
export function renderBadgeChips(container: HTMLElement, split: SplitBadgeRow): void {
  if (split.chips.length === 0) return;

  const row = container.createDiv({ cls: 'culi-badge-row' });

  for (const entry of split.chips) {
    if (entry.type === 'separator') {
      row.createSpan({ cls: 'culi-badge-separator' });
    } else if (entry.type === 'newline') {
      // A `<br>` is ignored inside a flex container. A full-width, zero-height
      // element is what actually forces the wrap.
      row.createDiv({ cls: 'culi-badge-newline' });
    } else {
      for (const value of entry.values) renderChip(row, entry.badge, entry.label, value);
    }
  }
}

/**
 * Renders the figure badges as a strip of columns.
 *
 * `plain`, not `boxed`: this sits in the meal header under the title, where a
 * bordered box would read as a second card inside the one it is already in. The
 * boxed variant is for a strip that is the whole width of a phone.
 */
export function renderBadgeFigures(container: HTMLElement, split: SplitBadgeRow): void {
  renderStatStrip(container, badgeCells(split.cells), { cls: 'culi-badge-strip' });
}

/**
 * Both halves, chips above figures.
 *
 * For a caller that wants the badges in one place. The meal header does not:
 * it puts the chips directly under the title and the figures below the stars, so
 * it plans once with `planBadges()` and calls the two above itself.
 */
export function renderBadgeRow(
  container: HTMLElement,
  frontmatter: Record<string, unknown>,
  settings: CULItrailSettings,
  skip?: (badge: CustomBadge) => boolean
): void {
  const split = planBadges(frontmatter, settings, skip);
  renderBadgeChips(container, split);
  renderBadgeFigures(container, split);
}

/**
 * Renders the note's tags under the badge row.
 *
 * These are frontmatter tags only, the same ones the gallery filters and the
 * suggester matches on. Obsidian's own note header also shows tags written
 * into the prose, and deliberately not following it here is what keeps the
 * header honest: a tag shown on a meal is a tag that can be searched for.
 */
export function renderTagRow(
  container: HTMLElement,
  tags: string[],
  settings: CULItrailSettings
): void {
  if (!settings.showTagsInHeader || tags.length === 0) return;

  const row = container.createDiv({ cls: 'culi-tag-row' });
  for (const tag of tags) {
    const segment = settings.showFullTagPath ? tag : (tag.split('/').pop() ?? tag);
    row.createSpan({
      cls: 'culi-tag',
      text: settings.prefixTagsWithHash ? `#${segment}` : segment,
    });
  }
}
