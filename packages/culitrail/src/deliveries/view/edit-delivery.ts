/**
 * Opening the delivery editor, and writing back what it returns.
 *
 * Its own file for the reason `orders/view/edit-delivery`'s neighbour has one:
 * two surfaces open the same dialog, and a second copy of the save path is a
 * second chance for the two to drift.
 */
import { App, Notice, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import type { OrderRecord } from '../../orders/types';
import type { CULItrailSettings } from '../../settings/types';
import { readDeliveries } from '../read-deliveries';
import type { DeliveryRecord } from '../types';
import { createDeliveryNote, updateDeliveryNote } from '../write-delivery';
import { DeliveryModal } from './delivery-modal';

export interface DeliveryEditorOptions {
  /** The delivery being corrected, or null for a new one. */
  existing?: DeliveryRecord | null;
  /** Ticked when the dialog opens. Used when recording a delivery from an order. */
  forOrder?: OrderRecord | null;
}

export function openDeliveryEditor(
  app: App,
  settings: CULItrailSettings,
  orders: readonly OrderRecord[],
  onSaved: () => void,
  options: DeliveryEditorOptions = {}
): void {
  const existing = options.existing ?? null;
  const deliveries = readDeliveries(app, settings);

  const modal = new DeliveryModal(app, settings, existing, orders, deliveries, (content) => {
    const write: Promise<TFile | null> = existing
      ? updateDeliveryNote(app, settings, existing.file, content)
      : createDeliveryNote(app, settings, content);

    void write
      .then((file) => {
        if (!file) new Notice(t('deliveries.couldNotCreate'));
        onSaved();
      })
      .catch(() => new Notice(t('deliveries.couldNotCreate')));
  });

  modal.open();
  // After open, because the dialog fills its own list of outstanding dishes as
  // part of ticking the order, and that list is built in `renderBody`.
  if (options.forOrder) modal.tickOrder(options.forOrder);
}
