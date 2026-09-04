/**
 * The card at the top of the mobile meal view: the photo, beside when the meal
 * was last eaten.
 *
 * A phone shows one column, so the picture has to earn its width. Putting the
 * fact somebody checks first next to it means the header is one screenful
 * rather than a photo they have to scroll past.
 */
import { App } from 'obsidian';
import { t } from '../../../lang/I18nManager';
import { renderImageCard } from '../../../ui/images';
import { formatIsoDate } from '../../view-model/format-date';
import type { MealMeta } from '../../types';

/** Shown when a meal has never been eaten, so the row keeps its place. */
const NEVER = '–';

export function renderMobileMealCard(
  container: HTMLElement,
  app: App,
  meta: MealMeta,
  imageValue: string | null
): void {
  const card = container.createDiv({ cls: 'culi-mobile-native-card' });
  if (imageValue) renderImageCard(card, app, imageValue);

  const column = card.createDiv({ cls: 'culi-mobile-native-meta' });

  const lastEaten = column.createDiv({ cls: 'culi-mobile-native-group' });
  lastEaten.createDiv({ cls: 'culi-label-caps', text: t('meals.mobile.lastEaten') });
  lastEaten.createDiv({
    cls: 'culi-mobile-native-value',
    text: meta.lastEaten ? formatIsoDate(meta.lastEaten) : NEVER,
  });
}
