/**
 * The words of the credit line under a printed sheet, with or without a name.
 *
 * Every sheet in the suite ends the same way: which sheet, who made it, when,
 * with which plugin, and technosoftware.com as a link whose text is the
 * address (trail-core's `sheetCreditHtml` adds that part). The name is the
 * `exportAuthor` setting, and a blank one leaves "by" out rather than printing
 * an empty name.
 *
 * The two wordings arrive as closures so each call site spells its own
 * translation keys out literally, which is what `translation-keys.test.ts`
 * reads.
 */
import type { APERtrailSettings } from '../settings/types';

export function sheetCredit(
  settings: Pick<APERtrailSettings, 'exportAuthor'>,
  named: (author: string) => string,
  anonymous: () => string
): string {
  const author = settings.exportAuthor.trim();
  return author ? named(author) : anonymous();
}
