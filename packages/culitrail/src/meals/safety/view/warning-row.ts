/**
 * The allergen banner above a meal.
 *
 * Compact and unalarming by design. It is a match over somebody else's
 * declared list, so it is wrong sometimes; a row that shouted would be turned
 * off after the second false positive and would then be missing on the day it
 * mattered.
 */
import { setIcon } from 'obsidian';
import { t } from '../../../lang/I18nManager';
import type { MealWarning } from '../warnings';

export function renderWarnings(container: HTMLElement, warnings: MealWarning[]): void {
  for (const warning of warnings) {
    const row = container.createDiv({ cls: 'culi-allergen-warning' });
    setIcon(row.createSpan(), 'alert-triangle');
    row.createSpan({
      text: t('safety.allergen').replace('{allergens}', warning.matched.join(', ')),
    });
  }
}
