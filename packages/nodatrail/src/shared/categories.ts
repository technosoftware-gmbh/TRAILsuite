/**
 * Expense categories: the configured list, and the label for one.
 *
 * A category is an **id** written into a note, never a translated word. The
 * label is looked up on the way to the screen, and **an id the table does not
 * know is shown exactly as written**, which is what lets a vault invent `pets`
 * and get `pets` on screen rather than a blank.
 *
 * That is `meal/nutrients.ts`'s rule, applied here for the same reason: the
 * shipped vocabulary is a default, not a boundary.
 */
import { t } from '../lang/I18nManager';
import { splitList } from '../settings/defaults';

export function configuredCategories(setting: string): string[] {
  return splitList(setting);
}

export function categoryLabel(id: string | null): string {
  const trimmed = id?.trim();
  if (!trimmed) return '';

  const label = t(`categories.${trimmed}`);
  // `t()` hands back the key path when nothing matches, which is what tells an
  // unknown id from a translated one.
  return label === `categories.${trimmed}` ? trimmed : label;
}
