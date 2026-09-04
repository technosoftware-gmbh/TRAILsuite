/**
 * What a gallery card shows below its picture: three rows, always the same three.
 *
 * A card in a grid is stretched to its row's height, so one tall card makes every
 * card beside it tall and leaves the others with a gap. The fix is that the rows
 * are fixed rather than conditional, and which rows those are was decided by
 * counting the library rather than by taste:
 *
 * | on a card    | notes stating it |
 * | ------------ | ---------------- |
 * | diet         | 124 / 126        |
 * | nutrition    | 124 / 126        |
 * | eaten count | 124 / 126        |
 * | a rating     | **3 / 126**      |
 *
 * So the chip row, the nutrition strip and the info strip are always present and
 * cost nothing on almost every card, while the stars are on 2% of the library and
 * would have meant reserving a blank row on 123 cards to keep 3 from stretching
 * their row. They render over the picture instead, where they cost no height at
 * all.
 *
 * **The per-100 g breakdown is deliberately not here**, and the reason is that row
 * arithmetic rather than a view about what matters. A breakdown is a variable
 * number of rows: eight on this vault's meals, up to thirty-five for a label that
 * declares the lot. A fixed row cannot hold a variable table, and both ways around
 * that fail the way the stars did. Abbreviating it to two or three figures would
 * mean choosing which nutrients a card is about, which is a judgement no note made;
 * showing it in full would make one card as tall as its whole row. The four columns
 * already here are per serving, so a second nutrition row would also put two bases
 * beside each other on a 200px card with room for one caption. The meal view is one
 * tap away and shows the whole table with its basis on the heading.
 *
 * App-free.
 */
import { t } from '../../lang/I18nManager';
import type { CULItrailSettings } from '../../settings/types';
import type { StatCell } from '../../ui/stat-strip';
import { formatIsoDateShort } from './format-date';
import { currencyFor } from './currency';
import { formatPrice } from './format-price';
import { neverEaten, type GalleryEntry } from './gallery-entry';
import { ABSENT_FIGURE, nutritionRow } from './nutrition-row';

export interface CardFace {
  /** What one portion costs, already formatted, or null when the note states none. */
  price: string | null;
  /** The four nutrition columns, abbreviated. Empty when the note states none. */
  nutrition: StatCell[];
  /** What those figures are figures of, for a tooltip rather than a visible caption. */
  nutritionCaption: string | null;
  /** Total time, times eaten and last made. */
  info: StatCell[];
}

/**
 * The info strip: two columns, always the same two.
 *
 * **Total time is deliberately not here, and that is a measured decision rather
 * than an oversight.** A card is about 200px wide, which its strip splits into
 * columns of roughly 85px at two and 55px at three. `1 h 10 min` needs 65px and
 * `06/08/2026` needs 75px, so three columns rendered both with an ellipsis
 * through the middle. Time is also the least earned of the three: 14 of 126 notes
 * state one, against 124 for the cook count and last-made. Two columns that can
 * be read beat three that cannot, and the meal view shows the time in full one
 * tap away.
 *
 * Both columns are always present. A meal nobody has eaten still has a cook
 * count, and it is a dash rather than a zero, because zero is a figure somebody
 * recorded and a dash is the absence of one.
 */
function infoCells(entry: GalleryEntry): StatCell[] {
  return [
    {
      label: t('meals.gallery.card.eatenLabel'),
      value: neverEaten(entry.meta) ? ABSENT_FIGURE : String(entry.meta.eatenCount ?? 0),
    },
    {
      label: t('meals.gallery.card.lastEatenLabel'),
      value: entry.meta.lastEaten ? formatIsoDateShort(entry.meta.lastEaten) : ABSENT_FIGURE,
    },
  ];
}

export function cardFace(entry: GalleryEntry, settings: CULItrailSettings): CardFace {
  const nutrition = nutritionRow(entry.meta, settings, { short: true });

  return {
    price: formatPrice(
      entry.meta.price,
      currencyFor(entry.meta, entry.supplier?.terms ?? null, settings)
    ),
    nutrition: (nutrition?.cells ?? []).map((cell) => ({
      label: cell.label,
      value: cell.text,
    })),
    nutritionCaption: nutrition?.caption ?? null,
    info: infoCells(entry),
  };
}
