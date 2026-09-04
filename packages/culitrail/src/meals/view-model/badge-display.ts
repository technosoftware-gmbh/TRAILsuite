/**
 * Whether a planned badge renders as a strip cell or as a chip.
 *
 * The rule is structural rather than a preference, which is why it is derived
 * here instead of being a setting somebody has to get right. A strip cell is one
 * label over one value in a fixed column, aligned with its neighbours. A badge
 * that resolved to no value at all (a boolean such as Favorite, which renders as
 * its icon and label alone) would be a label over a blank; a badge that resolved
 * to several would either overflow its column or silently show the first of them.
 *
 * **A list-valued badge is a chip whatever one note happened to list.** That is
 * the part worth reading twice, because deciding it from the resolved values
 * alone looked cleaner and was wrong: `diet` ships `splitArray: true`, so a
 * meal naming two diets made it a chip and a meal naming one made it a cell,
 * and the badge moved between the title and the strip from meal to meal. The
 * same judgement the eating-history chip already follows, for the same reason: a
 * thing that appears somewhere different depending on the note makes a header
 * unpredictable. `splitArray` is a declaration about the property rather than an
 * observation about one note, so it is the stable thing to key on.
 *
 * That is also why "the diet badge belongs under the title" needs no special
 * case: diet declares itself a list, so the rule already puts it in the chip row.
 *
 * App-free.
 */
import type { BadgeDisplay, CULItrailSettings, CustomBadge } from '../../settings/types';
import type { StatCell } from '../../ui/stat-strip';
import { planBadgeRow, trimLayoutOnly, type PlannedBadge } from './badge-values';
import type { EatingEntry } from '../types';

/**
 * The label a cell would use, which is not always the badge's label.
 *
 * `hideLabel` is what a badge sets to render as its icon and value alone. A cell
 * has no icon and its label is the column heading, so hiding it leaves a figure
 * floating over blank space with nothing to say what it is.
 */
function cellLabel(entry: PlannedBadge): string {
  return entry.badge.hideLabel ? '' : entry.label;
}

/**
 * Where one entry goes.
 *
 * A separator and a newline are chips: both are layout for a wrapping flex row,
 * and a strip has fixed columns with nothing to separate or wrap.
 */
export function badgeDisplay(entry: PlannedBadge): BadgeDisplay {
  if (entry.type !== 'badge') return 'chip';

  // An explicit choice wins. A single-valued badge somebody wants as a chip is
  // a legitimate preference; the reverse is not offered, because the cases below
  // cannot be rendered as a cell however firmly they are asked to.
  if (entry.badge.display === 'chip') return 'chip';

  // Declared a list, so it stays a chip on every meal, including one that
  // happens to name a single value.
  if (entry.badge.splitArray) return 'chip';

  // No column heading, so nothing to put the figure under.
  if (!cellLabel(entry)) return 'chip';

  const [value, ...rest] = entry.values;
  if (rest.length > 0) return 'chip';
  // `['']` rather than `[]` is how a true boolean arrives from the planner: the
  // badge renders, but it has no figure to put under a label.
  return value ? 'cell' : 'chip';
}

export interface SplitBadgeRow {
  chips: PlannedBadge[];
  cells: PlannedBadge[];
}

/**
 * Splits a planned row into the chip row and the strip, keeping each half in the
 * order it was configured in.
 *
 * Configured order is preserved rather than sorted, because the badge list *is*
 * the header's layout: somebody who dragged Total above Prep meant it, and a
 * split that reordered within a half would undo that silently.
 *
 * The chip half is trimmed again after the split. `planBadgeRow` already drops a
 * separator stranded by a badge whose property was absent, but the split strands
 * them a second way: a divider configured between Prep and Total, both of which
 * become cells, is left alone in the chip row with nothing on either side of it.
 * Same repair, so the same function does it rather than a second copy that could
 * disagree.
 */
export function splitBadgeRow(planned: PlannedBadge[]): SplitBadgeRow {
  const chips: PlannedBadge[] = [];
  const cells: PlannedBadge[] = [];

  for (const entry of planned) {
    if (badgeDisplay(entry) === 'cell') cells.push(entry);
    else chips.push(entry);
  }

  const trimmed = trimLayoutOnly(chips);
  // Layout-only entries are all that is left when every real chip became a cell.
  const hasChip = trimmed.some((entry) => entry.type === 'badge');

  return { chips: hasChip ? trimmed : [], cells };
}

/**
 * Plans the row and splits it, in one pass.
 *
 * One pass matters rather than being tidy: `planBadgeRow` takes the current time,
 * which the cook-streak badge counts weeks against. Planning twice to render the
 * two halves would take it twice, and a header could in principle show a streak
 * in one half computed against a different instant from the other.
 */
export function planBadges(
  frontmatter: Record<string, unknown>,
  settings: CULItrailSettings,
  skip?: (badge: CustomBadge) => boolean,
  now: Date = new Date(),
  /** This meal's cooks, for the streak badge. Absent falls back to frontmatter. */
  cooks?: EatingEntry[]
): SplitBadgeRow {
  return splitBadgeRow(planBadgeRow(frontmatter, settings, skip, now, cooks));
}

/**
 * The strip's cells.
 *
 * `prefix` and `suffix` are folded into the value here. In a chip they are their
 * own muted spans beside it; a cell is one label over one figure, so a badge
 * configured with "approx." and "kcal" reads as one figure rather than gaining
 * two more elements the grid would have to place.
 */
export function badgeCells(entries: PlannedBadge[]): StatCell[] {
  return entries.map((entry) => ({
    label: cellLabel(entry),
    value: [entry.badge.prefix, entry.values[0], entry.badge.suffix].filter(Boolean).join(' '),
  }));
}
