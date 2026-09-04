/**
 * Opening the order editor, and writing back what it returns.
 *
 * Extracted because two surfaces open the same dialog on the same terms: the
 * orders dashboard and an order note rendered as an invoice. A second copy of
 * the save path would be a second chance to forget which people have to be
 * passed in for an unchecked pick to actually be removed.
 */
import { App, Notice, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { readPersons } from '../../crm/read-crm';
import type { CULItrailSettings } from '../../settings/types';
import type { OrderRecord } from '../types';
import { createOrderNote, updateOrderNote } from '../write-order';
import { OrderModal } from './order-modal';

/**
 * Every configured person, not the eligible subset.
 *
 * Only pre-v2 notes use this, and one of those may name somebody who has since
 * fallen out of the eligibility filter. Narrowing here would make their picks
 * vanish from an order that genuinely records them.
 */
export function allPersonTitles(app: App, settings: CULItrailSettings): string[] {
  return readPersons(app, settings).map((person) => person.title);
}

/**
 * The editor, for a new order when `order` is null and for an existing one
 * otherwise.
 *
 * `onSaved` runs after the write, so the surface that opened this can repaint.
 * The write itself is not awaited at the call site: the dialog closes on click
 * rather than sitting open while the note is rewritten.
 */
export function openOrderEditor(
  app: App,
  settings: CULItrailSettings,
  order: OrderRecord | null,
  onSaved: () => void
): void {
  new OrderModal(app, settings, order, (draft, knownPersons) => {
    const write: Promise<TFile | null> = order
      ? updateOrderNote(
          app,
          settings,
          order.file,
          draft.orderDate,
          draft,
          // Every person the editor offered, plus everyone a pre-v2 note could
          // name, so unchecking somebody actually removes their old property
          // rather than leaving it behind.
          [...new Set([...knownPersons, ...allPersonTitles(app, settings)])]
        )
      : createOrderNote(app, settings, draft);

    void write
      .then((file) => {
        if (!file) new Notice(t('orders.couldNotCreate'));
        onSaved();
      })
      .catch(() => new Notice(t('orders.couldNotCreate')));
  }).open();
}
