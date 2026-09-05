/**
 * The orders view: what was bought, narrowed and sorted the way the gallery's
 * meals are.
 *
 * A list rather than a grid, because an order is read as a row of facts
 * (when, from whom, how much) with the picks underneath, and there is no
 * picture to hang a card on.
 *
 * The toolbar is the gallery's arrangement rather than a second one: an order
 * list and a meal library are both "everything of one kind, narrowed", and the
 * state it leaves behind is persisted for the same reason the gallery's is.
 * The deliveries underneath are deliberately **not** filtered with it: they
 * answer "has the box been logged", which is a question about all of them.
 *
 * The compact card here and the full invoice in `order-note-view.ts` are
 * deliberately two different documents: one is a row in a list of everything
 * bought, the other is one order read end to end. They agree about the money
 * because both go through `trail-core`'s `order/total.ts`, which is the whole
 * reason that module exists.
 */
import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import type { OrdersSavedState } from '../../settings/types';
import { readDeliveries } from '../../deliveries/read-deliveries';
import type { DeliveryRecord } from '../../deliveries/types';
import { openDeliveryEditor } from '../../deliveries/view/edit-delivery';
import { orderTotal } from '../view-model/order-total';
import { t } from '../../lang/I18nManager';
import { formatIsoDate } from '../../meals/view-model/format-date';
import { ORDERS_VIEW_TYPE } from '../../meals/view-types';
import { readOrders } from '../read-orders';
import type { OrderRecord } from '../types';
import { allPersonTitles, openOrderEditor } from './edit-order';
import { renderOrdersToolbar } from './toolbar';
import { TOOLBAR_SEARCH_SELECTOR } from '../../ui/toolbar';
import { deliveredOrderTitles, filterOrders } from '../view-model/orders-filter';
import { sortOrders } from '../view-model/orders-sort';
import type { OrderViewDeps } from './deps';
import { selectionTitles } from '@technosoftware/trail-core';

export class OrdersView extends ItemView {
  private unsubscribe: (() => void) | null = null;
  private state: OrdersSavedState;
  private filterPanelOpen = false;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly deps: OrderViewDeps
  ) {
    super(leaf);
    this.navigation = true;
    // A copy rather than the settings object itself, so a half-typed search
    // cannot reach anything else that reads settings before it is saved.
    this.state = { ...deps.getSettings().ordersSavedState };
  }

  getViewType(): string {
    return ORDERS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return t('orders.title');
  }

  getIcon(): string {
    return 'receipt';
  }

  onOpen(): Promise<void> {
    this.unsubscribe = this.deps.subscribeToChanges(() => this.render());
    this.registerEvent(this.app.metadataCache.on('changed', () => this.render()));
    this.render();
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    return Promise.resolve();
  }

  /** Persists what the toolbar changed, then repaints. */
  private updateState(next: OrdersSavedState): void {
    this.state = next;
    void this.deps.saveOrdersState(next);
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    const focus = this.captureSearchFocus();
    contentEl.empty();
    contentEl.addClass('culi-orders-view');

    const settings = this.deps.getSettings();
    const orders = readOrders(this.app, settings, allPersonTitles(this.app, settings));
    const deliveries = readDeliveries(this.app, settings);

    renderOrdersToolbar(contentEl, {
      orders,
      state: this.state,
      filterPanelOpen: this.filterPanelOpen,
      onChange: (next) => this.updateState(next),
      onToggleFilterPanel: () => {
        this.filterPanelOpen = !this.filterPanelOpen;
        this.render();
      },
      onAddOrder: () => this.openEditor(null),
      onAddDelivery: () => this.openDeliveryEditor(orders),
    });

    this.restoreSearchFocus(focus);

    const shown = sortOrders(
      filterOrders(orders, this.state, deliveredOrderTitles(deliveries)),
      this.state.sortField,
      this.state.sortDirection
    );

    if (shown.length === 0) {
      // Two different problems with two different fixes: one is a folder or a
      // type value, the other is the toolbar.
      contentEl.createDiv({
        cls: 'culi-orders-empty',
        text: orders.length === 0 ? t('orders.empty') : t('orders.emptyNoMatches'),
      });
    } else {
      const list = contentEl.createDiv({ cls: 'culi-orders-list' });
      for (const order of shown) this.renderOrder(list, order, orders);
    }

    // Every delivery, whatever the toolbar says, and passed the unfiltered
    // orders so a box still names the order it settles.
    this.renderDeliveries(contentEl, orders, deliveries);
  }

  /**
   * Remembers where the cursor was in the search field.
   *
   * The toolbar is rebuilt on every render, including the one the debounced
   * search itself triggers, so without this the field loses focus mid-word and
   * the rest of what somebody was typing goes nowhere.
   */
  private captureSearchFocus(): { start: number; end: number } | null {
    const field = this.contentEl.querySelector(TOOLBAR_SEARCH_SELECTOR);
    if (!field?.instanceOf(HTMLInputElement)) return null;
    if (this.contentEl.ownerDocument.activeElement !== field) return null;
    return { start: field.selectionStart ?? 0, end: field.selectionEnd ?? 0 };
  }

  private restoreSearchFocus(focus: { start: number; end: number } | null): void {
    if (!focus) return;
    const field = this.contentEl.querySelector(TOOLBAR_SEARCH_SELECTOR);
    if (!field?.instanceOf(HTMLInputElement)) return;
    field.focus();
    field.setSelectionRange(focus.start, focus.end);
  }

  /**
   * What has actually arrived, under the orders rather than beside them.
   *
   * Second because it is the shorter list and the less-often-read one: an order
   * is written once and consulted for its money, a delivery is glanced at to
   * see whether the box has been logged. Both live in this view because they
   * are two halves of one question and splitting them across two views would
   * make comparing them a navigation exercise.
   */
  private renderDeliveries(
    container: HTMLElement,
    orders: readonly OrderRecord[],
    deliveries: readonly DeliveryRecord[]
  ): void {
    if (deliveries.length === 0) return;

    const section = container.createDiv({ cls: 'culi-deliveries' });
    section.createEl('h3', { cls: 'culi-deliveries-heading', text: t('deliveries.title') });

    for (const delivery of deliveries) this.renderDelivery(section, delivery, orders);
  }

  private renderDelivery(
    container: HTMLElement,
    delivery: DeliveryRecord,
    orders: readonly OrderRecord[]
  ): void {
    const row = container.createDiv({ cls: 'culi-delivery-card' });

    const header = row.createDiv({ cls: 'culi-delivery-card-header' });
    header.createSpan({
      cls: 'culi-delivery-date',
      text: delivery.deliveryDate
        ? formatIsoDate(delivery.deliveryDate)
        : t('orders.related.noDate'),
    });
    header.createSpan({
      cls: 'culi-delivery-count',
      text: t('deliveries.portions', {
        count: String(delivery.items.reduce((sum, item) => sum + item.quantity, 0)),
      }),
    });

    const edit = header.createEl('button', {
      cls: 'culi-order-edit',
      attr: { 'aria-label': t('deliveries.edit') },
    });
    setIcon(edit.createSpan({ cls: 'culi-icon-slot' }), 'pencil');
    edit.addEventListener('click', () => this.openDeliveryEditor(orders, { existing: delivery }));

    if (delivery.items.length === 0) return;

    const dishes = row.createDiv({ cls: 'culi-delivery-card-meals' });
    delivery.items.forEach((item, index) => {
      if (index > 0) dishes.appendText(', ');
      const link = dishes.createEl('a', { text: item.mealTitle });
      link.addEventListener('click', () =>
        this.deps.openByTitle(item.mealTitle, delivery.file.path)
      );
      if (item.quantity > 1) dishes.appendText(` x ${item.quantity}`);
    });
  }

  private openDeliveryEditor(
    orders: readonly OrderRecord[],
    options: { existing?: DeliveryRecord; forOrder?: OrderRecord } = {}
  ): void {
    openDeliveryEditor(this.app, this.deps.getSettings(), orders, () => this.render(), options);
  }

  private renderOrder(
    container: HTMLElement,
    order: OrderRecord,
    orders: readonly OrderRecord[]
  ): void {
    const card = container.createDiv({ cls: 'culi-order' });

    const header = card.createDiv({ cls: 'culi-order-header' });
    header.createSpan({
      cls: 'culi-order-company',
      text: order.companyTitle ?? t('orders.noCompany'),
    });
    if (order.orderNumber) {
      header.createSpan({ cls: 'culi-order-number', text: `#${order.orderNumber}` });
    }

    // A group rather than two buttons in the header row, because the row's own
    // free space would otherwise be split between two `margin-left: auto`
    // buttons and land the first one in the middle of the card, where it reads
    // as belonging to the order number rather than to the actions.
    const actions = header.createDiv({ cls: 'culi-order-actions' });

    // Here rather than only in the toolbar, because "this box is for that
    // order" is the thought somebody is having while looking at the order, and
    // the dialog opens with it already ticked and its outstanding dishes filled
    // in.
    const record = actions.createEl('button', {
      cls: 'culi-order-edit',
      attr: { 'aria-label': t('deliveries.recordForOrder') },
    });
    setIcon(record.createSpan({ cls: 'culi-icon-slot' }), 'package');
    record.addEventListener('click', () => this.openDeliveryEditor(orders, { forOrder: order }));

    const edit = actions.createEl('button', {
      cls: 'culi-order-edit',
      attr: { 'aria-label': t('orders.editOrder') },
    });
    setIcon(edit.createSpan({ cls: 'culi-icon-slot' }), 'pencil');
    edit.addEventListener('click', () => this.openEditor(order));

    const facts = card.createDiv({ cls: 'culi-order-facts' });
    if (order.orderDate) {
      this.renderFact(facts, 'calendar', t('orders.ordered'), formatIsoDate(order.orderDate));
    }
    if (order.deliveryDate) {
      this.renderFact(facts, 'truck', t('orders.delivered'), formatIsoDate(order.deliveryDate));
    }
    // Through `orderTotal` rather than off `order.price`, so the card and the
    // document it opens can never print two different numbers for one order.
    const total = orderTotal(order);
    if (total !== null) {
      const amount = [total.toFixed(2), order.priceCurrency].filter(Boolean).join(' ');
      this.renderFact(facts, 'banknote', t('orders.invoice.total'), amount);
    }
    if (order.discount !== null) {
      this.renderFact(facts, 'tag', t('orders.discount'), order.discount.toFixed(2));
    }
    if (order.shipping !== null) {
      this.renderFact(facts, 'truck', t('orders.shipping'), order.shipping.toFixed(2));
    }

    if (order.selections.length === 0) return;

    const picks = card.createDiv({ cls: 'culi-order-picks' });
    for (const selection of order.selections) {
      const row = picks.createDiv({ cls: 'culi-order-pick' });
      row.createSpan({ cls: 'culi-order-pick-person', text: selection.personTitle });

      const dishes = row.createDiv({ cls: 'culi-order-pick-meals' });
      selectionTitles(selection).forEach((title, index) => {
        if (index > 0) dishes.appendText(', ');
        // Resolved by title, never by path: that is how every wikilink in
        // this plugin is followed, and a meal that has moved still opens.
        const link = dishes.createEl('a', { text: title });
        link.addEventListener('click', () => this.deps.openByTitle(title, order.file.path));
      });
    }
  }

  private renderFact(container: HTMLElement, icon: string, label: string, value: string): void {
    const fact = container.createSpan({ cls: 'culi-order-fact' });
    setIcon(fact.createSpan({ cls: 'culi-order-fact-icon' }), icon);
    fact.createSpan({ cls: 'culi-label-caps', text: label });
    fact.createSpan({ cls: 'culi-order-fact-value', text: value });
  }

  private openEditor(order: OrderRecord | null): void {
    openOrderEditor(this.app, this.deps.getSettings(), order, () => this.render());
  }
}
