/**
 * What the packet says about 100 g, as a card in the meal view.
 *
 * A second nutrition surface, not a replacement for the first. The strip at the
 * top of a meal is four per-serving figures a shop would print on a product
 * card; this is the declaration table off the back of the box, and it is here
 * because until now there was nowhere in the view it could be read at all. The
 * figures lived in two body sections that were never rendered, so the only way
 * to see them was to open the note as raw Markdown, and the words beside them
 * were English in every vault.
 *
 * Built like the reheating section, which is the closest thing to it: a
 * `culi-section` card with its own header and icon, rendered by a layout rather
 * than by the view, and flattened on mobile where the card is inside a tab
 * panel that is already a frame.
 *
 * **Label and value are siblings in one two-column grid**, not a wrapper per
 * row. Same reason as the stat strip: the columns are shared, so a label that
 * wraps to two lines does not step its figure out of the column, and a long
 * German nutrient name wraps rather than pushing the figures off the card.
 */
import { setIcon } from 'obsidian';
import type { MealNutritionPer100g } from 'trail-core';
import { t } from '../../lang/I18nManager';
import { nutritionBreakdown } from '../view-model/nutrition-breakdown';

export function renderBreakdownSection(
  container: HTMLElement,
  per100g: MealNutritionPer100g
): void {
  const rows = nutritionBreakdown(per100g);
  // A meal that states nothing per 100 g gets no card. An empty frame headed
  // "Nutrition per 100 g" is a promise of figures that are not there, and until
  // the vault migration runs there are three kinds of note in the wild: one
  // with the properties, one with the old sections, and one with neither.
  if (rows.length === 0) return;

  const section = container.createDiv({ cls: ['culi-section', 'culi-breakdown-section'] });

  const header = section.createDiv({ cls: 'culi-section-header' });
  // `clipboard-list` reads as a declaration table and has been in Lucide since
  // long before the version Obsidian pins, which is the rule the reheating
  // section's `flame` follows: an icon `setIcon` cannot find renders as an
  // empty span, and that has already shipped in this plugin twice.
  setIcon(header.createSpan({ cls: 'culi-section-icon' }), 'clipboard-list');
  // The title carries the basis, which is the load-bearing half of it. Figures
  // with nothing saying whether they are a plate, a tray or 100 g is the exact
  // failure the header strip's caption exists to prevent.
  header.createSpan({ cls: 'culi-section-title', text: t('meals.breakdown.title') });

  const table = section.createDiv({ cls: 'culi-breakdown-table' });
  for (const row of rows) {
    // The rule goes on both halves of the row rather than on a wrapper, for the
    // same reason the stat strip's group rule does: a row is two grid items and
    // not a box.
    const group = row.groupStart ? ['culi-breakdown-group-start'] : [];
    table.createSpan({ cls: ['culi-breakdown-label', ...group], text: row.label });
    table.createSpan({ cls: ['culi-breakdown-value', ...group], text: row.value });
  }
}
