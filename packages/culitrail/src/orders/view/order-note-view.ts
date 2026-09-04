/**
 * An order note rendered as an invoice.
 *
 * A `TextFileView` for the same reason the meal view is one: Obsidian then
 * hands it the file's text and treats the tab as the file itself, so
 * navigation, the file menu and the tab title all behave the way they do for a
 * Markdown note. It never writes `this.data` back, which is what makes it a
 * safe read-only presentation of a note that stays editable.
 *
 * Nothing is written into the note to make this work, so every order already on
 * disk renders untouched.
 */
import { Menu, TextFileView, TFile, WorkspaceLeaf } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { frontmatterOf } from '../../shared/vault-scan';
import { ORDER_NOTE_VIEW_TYPE } from '../../meals/view-types';
import { renderInvoice } from 'trail-core/obsidian';
import { orderInvoice } from '../invoice-model';
import { parseOrder } from 'trail-core';
import { orderProperties } from '../read-orders';
import type { OrderRecord } from '../types';
import type { OrderNoteViewDeps } from './deps';
import { allPersonTitles, openOrderEditor } from './edit-order';

export class OrderNoteView extends TextFileView {
  private unsubscribe: (() => void) | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly deps: OrderNoteViewDeps
  ) {
    super(leaf);
    this.navigation = true;
  }

  getViewType(): string {
    return ORDER_NOTE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.file?.basename ?? t('orders.title');
  }

  getIcon(): string {
    return 'receipt';
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
    // Two pencils, the same pair the meal view carries. The square one opens
    // the staged editor, which writes only on Save; the plain one hands over
    // the raw note.
    this.addAction('square-pen', t('orders.editOrder'), () => this.edit());
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
          .setTitle(t('orders.editOrder'))
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
   * The order this tab is showing.
   *
   * Read out of the metadata cache rather than parsed from `this.data`, so it
   * is the same frontmatter every other reader in the plugin sees. The person
   * list is every configured person, which only pre-v2 notes need: they name
   * nobody themselves.
   */
  private readOrder(): OrderRecord | null {
    if (!this.file) return null;
    const settings = this.deps.getSettings();

    return {
      file: this.file,
      title: this.file.basename,
      ...parseOrder({
        stem: this.file.basename,
        frontmatter: frontmatterOf(this.app, this.file) ?? {},
        properties: orderProperties(settings),
        legacyPrefix: settings.orderSelectionPropertyPrefix,
        personTitles: allPersonTitles(this.app, settings),
      }),
    };
  }

  private edit(): void {
    const order = this.readOrder();
    if (!order) return;
    openOrderEditor(this.app, this.deps.getSettings(), order, () => this.render());
  }

  private render(): void {
    this.contentEl.empty();
    const order = this.readOrder();
    if (!order) return;

    this.contentEl.addClass('culi-document-note-view');
    renderInvoice(this.contentEl, orderInvoice(order, this.deps.getSettings()), (title) =>
      this.deps.openByTitle(title, order.file.path)
    );
  }
}
