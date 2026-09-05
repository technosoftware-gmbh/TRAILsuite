/**
 * Recording what arrived.
 *
 * One modal for a new delivery and for correcting an old one, the way the order
 * editor is one modal for both.
 *
 * The list of dishes is filled by ticking the orders the box settles, and what
 * gets filled in is what those orders are still waiting for rather than
 * everything they asked for. **Ticking adds; unticking takes nothing back
 * away.** By the time somebody unticks, the list may have been corrected by
 * hand, and a dialog that silently undid those corrections would be worse than
 * one that leaves a row to delete.
 */
import { App, Setting, setIcon } from 'obsidian';
import { localDateISO } from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import { formatIsoDate } from '../../meals/view-model/format-date';
import type { OrderRecord } from '../../orders/types';
import type { CULItrailSettings } from '../../settings/types';
import { addFooterButtons, BaseModal } from '../../ui/base-modal';
import { readNotesOfType } from '../../vault/read-notes';
import type { DeliveryContent } from '@technosoftware/trail-core';
import { outstandingItems } from '@technosoftware/trail-core';
import type { DeliveryItem, DeliveryRecord } from '../types';

/** How many recent orders the dialog offers to link. */
const ORDERS_OFFERED = 12;

export class DeliveryModal extends BaseModal {
  private readonly draft: DeliveryContent;
  private readonly meals: string[];
  private itemsSection: HTMLElement | null = null;
  /** The order checkboxes by title, so `tickOrder` can tick one from outside. */
  private readonly orderBoxes = new Map<string, HTMLInputElement>();

  constructor(
    app: App,
    settings: CULItrailSettings,
    /** The delivery being corrected, or null when this is a new one. */
    private readonly existing: DeliveryRecord | null,
    /** Every order, newest first. Only the most recent are offered. */
    private readonly orders: readonly OrderRecord[],
    /** Every delivery already recorded, for working out what is outstanding. */
    private readonly deliveries: readonly DeliveryRecord[],
    private readonly onSave: (content: DeliveryContent) => void
  ) {
    super(app);

    this.meals = readNotesOfType(app, settings, 'meal').map((note) => note.title);
    this.draft = existing
      ? {
          deliveryDate: existing.deliveryDate ?? localDateISO(),
          orderTitles: [...existing.orderTitles],
          // Copied rather than shared, so cancelling leaves the note as it was.
          items: existing.items.map((item) => ({ ...item })),
        }
      : { deliveryDate: localDateISO(), orderTitles: [], items: [] };
  }

  getTitle(): string {
    return this.existing ? t('deliveries.edit') : t('deliveries.new');
  }

  getIcon(): string {
    return 'package';
  }

  renderBody(body: HTMLElement): void {
    new Setting(body).setName(t('deliveries.date')).addText((text) => {
      text.inputEl.type = 'date';
      text.setValue(this.draft.deliveryDate ?? localDateISO());
      text.onChange((value) => (this.draft.deliveryDate = value || null));
    });

    this.renderOrders(body);

    this.itemsSection = body.createDiv({ cls: 'culi-delivery-items' });
    this.paintItems();
  }

  /**
   * Which orders this box settles.
   *
   * Several may be ticked, because one box can settle two, and the same order
   * can be ticked on two deliveries a week apart. That pair of cases is the
   * whole reason a delivery is a note of its own.
   */
  private renderOrders(body: HTMLElement): void {
    const section = body.createDiv({ cls: 'culi-delivery-orders' });
    section.createEl('h3', { text: t('deliveries.orders') });

    const offered = this.orders.slice(0, ORDERS_OFFERED);
    if (offered.length === 0) {
      section.createEl('p', { cls: 'culi-delivery-hint', text: t('deliveries.noOrders') });
      return;
    }

    section.createEl('p', { cls: 'culi-delivery-hint', text: t('deliveries.ordersHint') });

    for (const order of offered) {
      const label = section.createEl('label', { cls: 'culi-delivery-order' });
      const checkbox = label.createEl('input', { attr: { type: 'checkbox' } });
      checkbox.checked = this.draft.orderTitles.includes(order.title);
      label.createSpan({ text: this.orderLabel(order) });
      this.orderBoxes.set(order.title, checkbox);

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) this.linkOrder(order);
        else {
          this.draft.orderTitles = this.draft.orderTitles.filter((title) => title !== order.title);
        }
        this.paintItems();
      });
    }
  }

  /**
   * Links an order and fills in what it is still short of.
   *
   * Called when a row is ticked here, and by `tickOrder` when the dialog was
   * opened from an order in the first place.
   */
  private linkOrder(order: OrderRecord): void {
    if (!this.draft.orderTitles.includes(order.title)) {
      this.draft.orderTitles = [...this.draft.orderTitles, order.title];
    }
    this.addOutstanding(order);
  }

  /**
   * Opens with one order already ticked.
   *
   * Public because "record what arrived" is reached from an order as often as
   * from the deliveries list, and arriving with the box empty would make
   * somebody find the order they were just looking at. The order may be older
   * than the dozen this dialog offers, in which case it is linked without a row
   * to tick, which is the correct outcome rather than a missing one.
   */
  tickOrder(order: OrderRecord): void {
    const box = this.orderBoxes.get(order.title);
    if (box) box.checked = true;

    this.linkOrder(order);
    this.paintItems();
  }

  private orderLabel(order: OrderRecord): string {
    const date = order.orderDate ? formatIsoDate(order.orderDate) : t('orders.related.noDate');
    return [date, order.companyTitle, order.orderNumber && `#${order.orderNumber}`]
      .filter(Boolean)
      .join(' · ');
  }

  /**
   * Adds what an order is still short of, merging into rows already listed.
   *
   * The delivery being edited is left out of the subtraction: its own lines are
   * already on screen, and counting them as delivered would make reopening a
   * saved delivery show nothing outstanding and then double the quantities on
   * the next tick.
   */
  private addOutstanding(order: OrderRecord): void {
    const others = this.deliveries.filter(
      (delivery) => delivery.file.path !== this.existing?.file.path
    );

    for (const item of outstandingItems([order], others)) {
      const existing = this.draft.items.find(
        (row) => row.mealTitle.trim().toLowerCase() === item.mealTitle.trim().toLowerCase()
      );
      if (existing) existing.quantity += item.quantity;
      else this.draft.items.push({ ...item });
    }
  }

  private paintItems(): void {
    const section = this.itemsSection;
    if (!section) return;

    section.empty();
    section.createEl('h3', { text: t('deliveries.whatArrived') });

    if (this.draft.items.length === 0) {
      section.createEl('p', { cls: 'culi-delivery-hint', text: t('deliveries.nothingYet') });
    }

    for (const item of this.draft.items) this.renderItemRow(section, item);
    this.renderAddRow(section);
  }

  private renderItemRow(section: HTMLElement, item: DeliveryItem): void {
    const row = section.createDiv({ cls: 'culi-delivery-row' });
    row.createSpan({ cls: 'culi-delivery-meal', text: item.mealTitle });

    const quantity = row.createEl('input', {
      cls: 'culi-delivery-quantity',
      attr: { type: 'number', min: '1', step: '1' },
    });
    quantity.value = String(item.quantity);
    quantity.addEventListener('input', () => {
      const parsed = Math.round(parseFloat(quantity.value));
      // Floored rather than rejected while typing, so clearing the field to
      // retype it does not blank the row out from under the caret.
      item.quantity = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    });

    const remove = row.createEl('button', {
      cls: 'culi-delivery-remove',
      attr: { 'aria-label': t('deliveries.removeItem') },
    });
    setIcon(remove.createSpan({ cls: 'culi-icon-slot' }), 'x');
    remove.addEventListener('click', () => {
      this.draft.items = this.draft.items.filter((row) => row !== item);
      this.paintItems();
    });
  }

  /**
   * Adding a dish nothing ordered.
   *
   * Here because a box can hold a substitution, a sample or a gift, and a
   * delivery that could only list what an order named would have no way to
   * record what actually turned up.
   */
  private renderAddRow(section: HTMLElement): void {
    const row = section.createDiv({ cls: 'culi-delivery-add' });
    const select = row.createEl('select', { cls: 'culi-delivery-select' });
    select.createEl('option', { value: '', text: t('deliveries.addMeal') });
    for (const meal of this.meals) select.createEl('option', { value: meal, text: meal });

    select.addEventListener('change', () => {
      const title = select.value;
      if (!title) return;

      const existing = this.draft.items.find((item) => item.mealTitle === title);
      if (existing) existing.quantity += 1;
      else this.draft.items.push({ mealTitle: title, quantity: 1 });
      this.paintItems();
    });
  }

  renderFooter(footer: HTMLElement): void {
    addFooterButtons(footer, {
      confirmLabel: this.existing ? t('deliveries.save') : t('deliveries.create'),
      onCancel: () => this.close(),
      onConfirm: () => {
        this.onSave(this.draft);
        this.close();
      },
    });
  }
}
