/**
 * A delivery note rendered as a document.
 *
 * The order view's twin, down to the `TextFileView` base and the two pencils.
 * A delivery note keeps everything it knows in frontmatter, so Obsidian's own
 * rendering of one is a blank page under a properties block; this is what the
 * note actually says.
 *
 * Nothing is written into the note to make it work, and `this.data` is never
 * written back, so every delivery already on disk renders untouched and stays
 * editable.
 */
import { Menu, TextFileView, TFile, WorkspaceLeaf } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { frontmatterOf } from '../../shared/vault-scan';
import { DELIVERY_NOTE_VIEW_TYPE } from '../../meals/view-types';
import { renderInvoice } from '@technosoftware/trail-core/obsidian';
import { parseDelivery } from '@technosoftware/trail-core';
import { readOrders } from '../../orders/read-orders';
import { allPersonTitles } from '../../orders/view/edit-order';
import type { OrderRecord } from '../../orders/types';
import { deliveryProperties } from '../read-deliveries';
import { deliveryNote, type SettledOrder } from '../delivery-note-model';
import type { DeliveryRecord } from '../types';
import { openDeliveryEditor } from './edit-delivery';
import type { DeliveryNoteViewDeps } from './deps';

export class DeliveryNoteView extends TextFileView {
  private unsubscribe: (() => void) | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly deps: DeliveryNoteViewDeps
  ) {
    super(leaf);
    this.navigation = true;
  }

  getViewType(): string {
    return DELIVERY_NOTE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.file?.basename ?? t('deliveries.title');
  }

  getIcon(): string {
    return 'package';
  }

  getViewData(): string {
    return this.data;
  }

  setViewData(data: string, _clear: boolean): void {
    this.data = data;
    this.render();
  }

  clear(): void {
    this.data = '';
    this.contentEl.empty();
  }

  onOpen(): Promise<void> {
    // The same pair the order view carries. The square pencil opens the staged
    // editor, which writes only on Save; the plain one hands over the raw note.
    this.addAction('square-pen', t('deliveries.edit'), () => this.edit());
    this.addAction('pencil', t('meals.view.editAsMarkdown'), () => {
      if (this.file) this.deps.editAsMarkdown(this.leaf, this.file);
    });

    // The editor writes frontmatter and this view is a rendering of exactly
    // that, so it has to catch up with what it just wrote.
    this.registerEvent(
      this.app.metadataCache.on('changed', (file: TFile) => {
        if (file.path === this.file?.path) this.render();
      })
    );

    this.unsubscribe = this.deps.subscribeToChanges(() => this.render());
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    return Promise.resolve();
  }

  onPaneMenu(menu: Menu, source: string): void {
    if (source === 'more-options' && this.file) {
      const file = this.file;
      menu.addItem((item) =>
        item
          .setTitle(t('deliveries.edit'))
          .setIcon('square-pen')
          .onClick(() => this.edit())
      );
      menu.addItem((item) =>
        item
          .setTitle(t('meals.view.editAsMarkdown'))
          .setIcon('pencil')
          .onClick(() => this.deps.editAsMarkdown(this.leaf, file))
      );
      menu.addSeparator();
    }
    super.onPaneMenu(menu, source);
  }

  /**
   * The delivery this tab is showing.
   *
   * Read out of the metadata cache rather than parsed from `this.data`, so it
   * is the same frontmatter every other reader in the plugin sees.
   */
  private readDelivery(): DeliveryRecord | null {
    if (!this.file) return null;

    return {
      file: this.file,
      title: this.file.basename,
      ...parseDelivery({
        stem: this.file.basename,
        frontmatter: frontmatterOf(this.app, this.file) ?? {},
        properties: deliveryProperties(this.deps.getSettings()),
      }),
    };
  }

  private orders(): OrderRecord[] {
    const settings = this.deps.getSettings();
    return readOrders(this.app, settings, allPersonTitles(this.app, settings));
  }

  /**
   * The orders this delivery names, in the order it names them.
   *
   * A title the vault has no note for still comes back, with no supplier behind
   * it: the delivery says it settles that order, and quietly dropping the row
   * would hide a broken link rather than show it.
   */
  private settled(delivery: DeliveryRecord, orders: readonly OrderRecord[]): SettledOrder[] {
    const byTitle = new Map(orders.map((order) => [order.title.trim().toLowerCase(), order]));

    return delivery.orderTitles.map((title) => ({
      title,
      companyTitle: byTitle.get(title.trim().toLowerCase())?.companyTitle ?? null,
    }));
  }

  private edit(): void {
    const delivery = this.readDelivery();
    if (!delivery) return;

    openDeliveryEditor(this.app, this.deps.getSettings(), this.orders(), () => this.render(), {
      existing: delivery,
    });
  }

  private render(): void {
    this.contentEl.empty();
    const delivery = this.readDelivery();
    if (!delivery) return;

    this.contentEl.addClass('culi-document-note-view');
    renderInvoice(
      this.contentEl,
      deliveryNote(delivery, this.settled(delivery, this.orders())),
      (title) => this.deps.openByTitle(title, delivery.file.path)
    );
  }
}
