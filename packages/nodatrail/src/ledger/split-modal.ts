/**
 * Filling in what a batched payment line actually covered.
 *
 * The bank says one debit of 3518.96 and "Anzahl Buchungen: 10". What those ten
 * were is not in the file, so this asks. It refuses to save until the legs add
 * up to the total, because a split that does not sum is a wrong figure heading
 * for a balance where it is far harder to find.
 *
 * **A leg can name the invoice it pays.** One payment in a batch is usually a
 * bill the vault already holds, and picking it fills in the account and the
 * figure and marks the invoice paid when the import is written. Without that
 * the leg lands on the right account, the invoice stays open, and settling it
 * afterwards posts the same money a second time -- which is the kind of error
 * that shows up as a balance nobody can explain three months later.
 */
import { App, ButtonComponent, Modal, Setting, setIcon } from 'obsidian';
import {
  accountLabel,
  matchOrdersForLines,
  roundCents,
  type Account,
  type OrderForMatching,
} from 'trail-core';
import { t } from '../lang/I18nManager';
import { money } from '../ui/kit/format';
import type { SplitLeg } from './import-write';

/** An invoice a leg can be said to pay. */
export interface SplitBillChoice {
  title: string;
  /** How it reads in the dropdown: the figure, then who sent it. */
  label: string;
  amount: number;
  /** Where it is booked, or null when nobody has said. */
  account: number | null;
}

export interface SplitOptions {
  total: number;
  accounts: readonly Account[];
  legs: readonly SplitLeg[];
  label: string;
  /**
   * The outstanding invoices, when this split is dividing a bank row.
   *
   * Absent when it is dividing an invoice of its own across accounts: an
   * invoice does not pay other invoices, and offering the list there would be
   * offering an answer to a question nobody asked.
   */
  bills?: readonly SplitBillChoice[];
  /**
   * The order notes another plugin keeps, when the vault has any.
   *
   * A card statement bills a merchant's orders one line each, naming the number
   * the merchant issued. The vault already holds what each of those cost, so
   * the figures can be confirmed rather than retyped.
   */
  orders?: readonly OrderForMatching[];
}

export class SplitLegsModal extends Modal {
  private legs: SplitLeg[];

  constructor(
    app: App,
    private readonly options: SplitOptions,
    private readonly onSave: (legs: SplitLeg[]) => void
  ) {
    super(app);
    this.legs = options.legs.map((leg) => ({ ...leg }));
    if (this.legs.length === 0) this.addBlankLegs();
  }

  /**
   * Starts with as many rows as the bank said there were payments.
   *
   * The count is the one thing the file does tell us about a batch, and typing
   * it out again would be asking somebody to re-enter what is on screen.
   */
  private addBlankLegs(): void {
    // No account, rather than the first one in the chart. A new row that
    // arrives already pointing at 1000 Haushaltskasse is a wrong account
    // waiting for somebody to not notice it, and the whole reason to split a
    // payment is that the accounts matter.
    this.legs.push({ account: 0, amount: 0, text: '' });
  }

  override onOpen(): void {
    this.render();
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    // Its own class so the three controls on a leg can wrap instead of running
    // off the side of a dialog that is already nested inside another one.
    contentEl.addClass('nod-split');
    // Wider than a default modal: four columns of controls do not fit one.
    this.modalEl.addClass('nod-split-modal');
    contentEl.createEl('h2', { text: t('ledger.splitOf', { label: this.options.label }) });

    this.renderOrderRow(contentEl);

    for (let index = 0; index < this.legs.length; index += 1) {
      this.renderLeg(contentEl, index);
    }

    new Setting(contentEl).addButton((button) => {
      button.setButtonText(t('ledger.addLeg')).onClick(() => {
        this.addBlankLegs();
        this.render();
      });
    });

    this.renderTotals(contentEl);
  }

  /**
   * What the order notes have to say about the legs as they stand.
   *
   * A button rather than something that happens while somebody types: this
   * redraws the dialog, and a form that redraws on every keystroke takes the
   * cursor with it.
   *
   * **It fills a blank and never overwrites a figure.** A leg with an amount
   * already on it is what a person read off the statement, and the statement is
   * what was actually charged. Where the two differ the difference is shown and
   * the leg is left alone, because a refund and a typo look identical from here
   * and only one of them should be quietly corrected -- neither, as it turns
   * out.
   *
   * **The account is copied from a sibling leg, never from a setting.** Which
   * expense account a merchant's orders belong to is a judgement, and one
   * setting for all of them would be wrong the first time a second merchant
   * appears. So somebody names the account on one Tomtasty leg and the rest of
   * the Tomtasty legs in the same split take it: the answer is learnt from the
   * split, applies only to that merchant, and needs nothing configured.
   */
  private renderOrderRow(parent: HTMLElement): void {
    const orders = this.options.orders;
    if (!orders || orders.length === 0) return;

    const found = matchOrdersForLines(this.legs, orders);
    if (found.length === 0) return;

    const line = parent.createDiv({ cls: 'nod-ledger-picker' });
    const named = this.accountsByCompany(found);
    const blanks = found.filter(
      ({ line: leg, match }) =>
        (leg.amount === 0 && match.order.price !== null) ||
        (leg.account <= 0 && named.has(match.order.companyTitle ?? ''))
    );
    const differing = found.filter(({ match }) => (match.difference ?? 0) !== 0);

    line.createSpan({
      cls: 'nod-ledger-hint',
      text: t('ledger.ordersFound', { count: String(found.length) }),
    });

    if (blanks.length > 0) {
      const button = line.createEl('button', {
        text: t('ledger.fillFromOrders', { count: String(blanks.length) }),
      });
      button.addEventListener('click', () => {
        for (const { line: leg, match } of found) {
          if (leg.amount === 0 && match.order.price !== null) leg.amount = match.order.price;
          const account = named.get(match.order.companyTitle ?? '');
          if (leg.account <= 0 && account) leg.account = account;
        }
        this.render();
      });
    }

    for (const { line: leg, match } of differing) {
      parent.createDiv({
        cls: 'nod-import-warn',
        text: t('ledger.orderDiffers', {
          order: match.order.title,
          charged: money(leg.amount, null),
          ordered: money(match.order.price ?? 0, null),
        }),
      });
    }
  }

  /**
   * The account each merchant's legs are already being booked to, in this split.
   *
   * First one wins, which is the reading that lets somebody correct a mistake
   * by fixing the topmost leg and pressing the button again.
   */
  private accountsByCompany(
    found: readonly { line: SplitLeg; match: { order: OrderForMatching } }[]
  ): Map<string, number> {
    const named = new Map<string, number>();
    for (const { line: leg, match } of found) {
      const company = match.order.companyTitle ?? '';
      if (leg.account > 0 && !named.has(company)) named.set(company, leg.account);
    }
    return named;
  }

  /**
   * One leg: account, amount, what for, and a way to drop it.
   *
   * Built as a grid row rather than from Obsidian's `Setting`, which lays a
   * label column beside its controls and lets them wrap wherever they run out
   * of room. With three controls to a leg that produced rows that wrapped in
   * different places depending on how long the account name was, so nothing
   * lined up down the dialog. A grid gives every leg the same four columns.
   */
  private renderLeg(parent: HTMLElement, index: number): void {
    const leg = this.legs[index];
    if (!leg) return;

    const line = parent.createDiv({ cls: 'nod-split-leg' });
    if (this.options.bills) line.addClass('nod-split-leg-bills');

    this.renderBillPicker(line, leg);

    const account = line.createEl('select', { cls: 'nod-split-account' });
    account.createEl('option', { value: '', text: t('ledger.chooseAccount') }).selected =
      leg.account === 0;
    for (const option of this.options.accounts) {
      account.createEl('option', {
        value: String(option.number),
        text: accountLabel(option),
      }).selected = option.number === leg.account;
    }
    account.addEventListener('change', () => {
      leg.account = Number(account.value) || 0;
      this.renderTotalsOnly();
    });

    // Right aligned and only as wide as a household figure needs. Money reads
    // down a column by its last digit, not its first.
    const amount = line.createEl('input', { cls: 'nod-split-amount' });
    amount.type = 'text';
    amount.inputMode = 'decimal';
    amount.placeholder = t('finance.amount');
    amount.value = leg.amount ? String(leg.amount) : '';
    amount.addEventListener('input', () => {
      leg.amount = roundCents(Number(amount.value.replace(',', '.')) || 0);
      // An invoice is settled in full or not by this. Typing a figure that is
      // not the invoice's takes the claim back rather than marking a bill paid
      // for the wrong money.
      if (leg.settles && !this.matchesBill(leg)) {
        leg.settles = null;
        this.render();
        return;
      }
      this.renderTotalsOnly();
    });

    const text = line.createEl('input', { cls: 'nod-split-text' });
    text.type = 'text';
    text.placeholder = t('ledger.legText');
    text.value = leg.text;
    text.addEventListener('input', () => {
      leg.text = text.value;
    });

    const remove = line.createEl('button', { cls: 'nod-split-remove' });
    setIcon(remove.createSpan({ cls: 'nod-icon' }), 'trash');
    remove.setAttribute('aria-label', t('common.remove'));
    remove.addEventListener('click', () => {
      this.legs.splice(index, 1);
      this.render();
    });
  }

  /**
   * The invoice this leg pays, if any.
   *
   * Choosing one fills in the account and the figure, because the invoice
   * knows both and retyping them is how they come to disagree.
   */
  private renderBillPicker(line: HTMLElement, leg: SplitLeg): void {
    const bills = this.options.bills;
    if (!bills) return;

    const picker = line.createEl('select', { cls: 'nod-split-bill' });
    picker.createEl('option', { value: '', text: t('ledger.noInvoice') }).selected = !leg.settles;
    for (const bill of bills) {
      // An invoice already claimed by another leg is not offered twice.
      const takenElsewhere = this.legs.some(
        (other) => other !== leg && other.settles === bill.title
      );
      if (takenElsewhere) continue;
      picker.createEl('option', { value: bill.title, text: bill.label }).selected =
        leg.settles === bill.title;
    }

    picker.addEventListener('change', () => {
      const chosen = bills.find((bill) => bill.title === picker.value);
      leg.settles = chosen?.title ?? null;
      if (chosen) {
        leg.amount = chosen.amount;
        if (chosen.account !== null) leg.account = chosen.account;
        if (!leg.text.trim()) leg.text = chosen.label;
      }
      this.render();
    });
  }

  /** True when the leg still carries the figure the invoice it names asks for. */
  private matchesBill(leg: SplitLeg): boolean {
    const bill = this.options.bills?.find((entry) => entry.title === leg.settles);
    return bill ? roundCents(bill.amount) === roundCents(leg.amount) : true;
  }

  private totals: HTMLElement | null = null;
  private saveButton: ButtonComponent | null = null;

  private renderTotals(parent: HTMLElement): void {
    this.totals = parent.createDiv({ cls: 'nod-split-totals' });

    new Setting(parent).addButton((button) => {
      this.saveButton = button;
      button
        .setButtonText(t('common.save'))
        .setCta()
        .onClick(() => {
          if (!this.canSave()) return;
          this.onSave(this.filled());
          this.close();
        });
    });

    // After the button exists, because this is what disables it.
    this.renderTotalsOnly();
  }

  private renderTotalsOnly(): void {
    const totals = this.totals;
    if (!totals) return;
    totals.empty();

    const sum = roundCents(this.legs.reduce((running, leg) => running + leg.amount, 0));
    const difference = this.difference();

    totals.createSpan({
      text: t('ledger.splitTotals', {
        entered: money(sum, null),
        total: money(this.options.total, null),
      }),
    });
    if (difference !== 0) {
      totals.createSpan({
        cls: 'nod-import-warn',
        text: t('ledger.splitDifference', { difference: money(difference, null) }),
      });
    }

    // A leg with a figure and no account would post money to nowhere, so it
    // holds the save just as a difference does, and says which it is.
    if (this.unnamed() > 0) {
      totals.createSpan({ cls: 'nod-import-warn', text: t('ledger.legNeedsAccount') });
    }

    // Disabled rather than silently refusing. A save button that looks ready
    // and does nothing is the one thing worse than a save button that says no.
    this.saveButton?.setDisabled(!this.canSave());
  }

  /** The legs worth keeping: an empty row somebody added and left is not one. */
  private filled(): SplitLeg[] {
    return this.legs.filter((leg) => leg.amount !== 0);
  }

  /** How many legs carry a figure but no account. */
  private unnamed(): number {
    return this.filled().filter((leg) => leg.account <= 0).length;
  }

  private canSave(): boolean {
    return this.difference() === 0 && this.unnamed() === 0 && this.filled().length > 0;
  }

  private difference(): number {
    const sum = roundCents(this.legs.reduce((running, leg) => running + leg.amount, 0));
    return roundCents(this.options.total - sum);
  }
}
