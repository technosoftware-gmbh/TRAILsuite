/**
 * The words under every ledger sheet: that the notes are the truth, and who
 * made the page, when, and with what.
 *
 * One function so the five sheets cannot word their credit five ways.
 */
import { t } from '../../lang/I18nManager';
import { day } from '../../ui/kit/format';
import type { NODAtrailSettings } from '../../settings/types';

/** The credit line's words, before the link: with the author when the setting names one. */
export function creditText(settings: NODAtrailSettings, today: string): string {
  const author = settings.exportAuthor.trim();
  const date = day(today);
  return author ? t('sheets.credit', { author, date }) : t('sheets.creditAnonymous', { date });
}
