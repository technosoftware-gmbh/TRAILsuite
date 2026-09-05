/**
 * Records one box against a purchase.
 *
 * **It offers what is outstanding, not what was ordered.** With the second box
 * open on the table, the lines that already came are noise: ticking through
 * seven to find the three that are new is the work this exists to remove. A
 * purchase with nothing outstanding says so and offers no form.
 *
 * Every line starts ticked, because the common case by a distance is the last
 * box, and untick-what-is-missing is fewer taps than tick-what-arrived on
 * almost every delivery. The exception -- the first of three boxes -- costs a
 * few unticks, which is the right way round for the trade.
 *
 * Nothing is recomputed and nothing is overwritten: the consignment is appended
 * to whatever the note already records. See `expense/purchase-delivery.ts` in
 * trail-core for why the status is not written alongside it.
 */
import { Notice, TFile } from 'obsidian';
import { Setting } from 'obsidian';
import { localDateISO, outstandingLines, type PurchaseRecord } from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import { recordPurchaseDelivery } from '../../finance/edit-money';
import { day, money } from '../kit/format';
import { FormModal } from './form-modal';
import type { EditMoneyDeps } from './edit-money-modals';

export class RecordDeliveryModal extends FormModal {
  /** Named for the day rather than `date`, which is FormModal's own field helper. */
  private arrivedOn: string | null = localDateISO(new Date());
  /** Named for the paper rather than `note`, which is FormModal's own hint helper. */
  private courierNote = '';
  /** Keyed by the line's name, which is what a consignment records. */
  private readonly taking = new Map<string, boolean>();

  constructor(
    private readonly deps: EditMoneyDeps,
    private readonly purchase: PurchaseRecord<TFile>
  ) {
    super(deps.app);
    for (const line of this.outstanding()) this.taking.set(line.name, true);
  }

  private outstanding(): { name: string; quantity: number }[] {
    return outstandingLines(this.purchase.items, this.purchase.deliveries);
  }

  protected heading(): string {
    return `${t('finance.recordDelivery')}: ${this.purchase.title}`;
  }

  protected override blocker(): string | null {
    const chosen = [...this.taking.values()].some(Boolean);
    return chosen ? null : t('finance.deliveryNothingChosen');
  }

  protected fields(container: HTMLElement): void {
    const outstanding = this.outstanding();
    if (outstanding.length === 0) {
      this.hint(container, t('finance.deliveryNothingOutstanding'));
      return;
    }

    this.date(
      container,
      t('finance.deliveryArrivedOn'),
      () => this.arrivedOn,
      (value) => (this.arrivedOn = value)
    );

    for (const line of outstanding) {
      // The price is the one thing that says which line this is when two are
      // near-identically named, which a Sparpaket and its smaller sibling are.
      const priced = this.purchase.items.find((item) => item.name === line.name);
      const label = line.quantity > 1 ? `${line.name} (${line.quantity})` : line.name;

      new Setting(container)
        .setName(label)
        .setDesc(
          priced?.price === null || priced === undefined
            ? ''
            : money(priced.price, this.purchase.currency)
        )
        .addToggle((input) =>
          input.setValue(this.taking.get(line.name) ?? true).onChange((value) => {
            this.taking.set(line.name, value);
            this.rerender();
          })
        );
    }

    this.text(
      container,
      t('finance.deliveryNote'),
      () => this.courierNote,
      (value) => (this.courierNote = value)
    );

    if (this.purchase.deliveries.length > 0) {
      this.hint(
        container,
        t('finance.deliveryAlready', {
          count: String(this.purchase.deliveries.length),
          last: day(this.purchase.deliveries[this.purchase.deliveries.length - 1].date),
        })
      );
    }
  }

  protected async submit(): Promise<void> {
    const items = this.outstanding()
      .filter((line) => this.taking.get(line.name) ?? true)
      .map((line) => ({ name: line.name, quantity: line.quantity }));

    await recordPurchaseDelivery(
      this.deps.app,
      this.deps.getSettings(),
      this.purchase.file,
      this.purchase.deliveries,
      { date: this.arrivedOn, items, note: this.courierNote.trim() || null }
    );

    new Notice(t('notices.noteUpdated', { title: this.purchase.title }));
    this.deps.onSaved();
  }
}
