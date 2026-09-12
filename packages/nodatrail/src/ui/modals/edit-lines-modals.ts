/**
 * The two editors for the two properties Obsidian's property editor cannot
 * edit: a purchase's `items` and a budget's `lines`.
 *
 * Both work on a copy and write on save, so cancelling means what it says. Both
 * write one property and leave everything else on the note untouched.
 *
 * The purchase editor shows what the lines add up to as it goes, beside the
 * total the note states. It does not correct either: the stated figure is what
 * was charged, and which of the two is wrong is not something a dialog can
 * know. Seeing them disagree is the point.
 */
import { App, Modal, Setting, TFile } from 'obsidian';
import {
  BUDGET_RHYTHMS,
  accountLabel,
  adjustedTotal,
  budgetYear,
  linesSubtotal,
  statedDisagreesWithComputed,
  type AccountBudgetLine,
  type AccountBudgetRecord,
  type ExpenseLine,
  type PurchaseRecord,
} from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import type { NODAtrailSettings } from '../../settings/types';
import { readAccounts } from '../../ledger/read-ledger';
import { writeBudgetLines, writePurchaseItems } from '../../finance/edit-finance';
import { listEditor } from '../kit/list-editor';
import { money } from '../kit/format';

export interface EditDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  onSaved: () => void;
}

/** A number typed into a field, or null. Blank clears rather than reading as zero. */
function numberField(
  setting: Setting,
  placeholder: string,
  get: () => number | null,
  set: (value: number | null) => void,
  onInput: () => void
): void {
  setting.addText((input) => {
    input.inputEl.type = 'number';
    input.inputEl.addClass('nod-list-number');
    input.setPlaceholder(placeholder);
    input.setValue(get() === null ? '' : String(get()));
    input.onChange((raw) => {
      const trimmed = raw.trim();
      const parsed = Number(trimmed);
      set(trimmed === '' || !Number.isFinite(parsed) ? null : parsed);
      onInput();
    });
  });
}

export class EditPurchaseItemsModal extends Modal {
  private readonly items: ExpenseLine[];
  private summary!: HTMLElement;

  constructor(
    private readonly deps: EditDeps,
    private readonly purchase: PurchaseRecord<TFile>
  ) {
    super(deps.app);
    // A copy, so closing without saving changes nothing.
    this.items = purchase.items.map((item) => ({ ...item }));
  }

  onOpen(): void {
    this.contentEl.addClass('nod-form');
    this.setTitle(`${t('finance.items')}: ${this.purchase.title}`);

    const list = this.contentEl.createDiv();
    this.summary = this.contentEl.createDiv({ cls: 'nod-settings-note' });

    listEditor<ExpenseLine>(list, {
      rows: this.items,
      blank: () => ({ name: '', price: null, quantity: 1, discount: null, note: null }),
      addLabel: t('common.add'),
      emptyLabel: t('finance.noPurchases'),
      onChange: () => this.renderSummary(),
      renderRow: (item, cell) => {
        const setting = new Setting(cell);
        setting.settingEl.addClass('nod-list-setting');

        setting.addText((input) => {
          input.setPlaceholder(t('finance.itemName'));
          input.setValue(item.name);
          input.onChange((value) => (item.name = value));
        });
        numberField(
          setting,
          t('finance.price'),
          () => item.price,
          (v) => (item.price = v),
          () => this.renderSummary()
        );
        numberField(
          setting,
          t('finance.quantity'),
          () => item.quantity,
          (v) => (item.quantity = Math.max(1, Math.round(v ?? 1))),
          () => this.renderSummary()
        );
        numberField(
          setting,
          t('finance.discount'),
          () => item.discount,
          (v) => (item.discount = v),
          () => this.renderSummary()
        );
      },
    });

    this.renderSummary();

    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText(t('common.cancel')).onClick(() => this.close()))
      .addButton((button) =>
        button
          .setButtonText(t('common.save'))
          .setCta()
          .onClick(() => void this.save())
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }

  /**
   * The subtotal, the computed total and the stated one, side by side.
   *
   * Shown rather than reconciled. A line with no price contributes nothing and
   * the subtotal stays null rather than becoming zero, so a purchase nobody has
   * priced reads as unpriced instead of free.
   */
  private renderSummary(): void {
    const named = this.items.filter((item) => item.name.trim() !== '');
    const subtotal = linesSubtotal(named);
    const computed = adjustedTotal(subtotal, this.purchase.discount, this.purchase.shipping);
    const currency = this.purchase.currency;

    const parts = [
      `${t('finance.subtotal')} ${money(subtotal, currency)}`,
      `${t('finance.computed')} ${money(computed, currency)}`,
      `${t('finance.stated')} ${money(this.purchase.amount, currency)}`,
    ];
    if (statedDisagreesWithComputed(this.purchase.amount, computed)) {
      parts.push(t('finance.totalsDisagree'));
    }

    this.summary.setText(parts.join('   '));
  }

  private async save(): Promise<void> {
    // A row somebody added and never named is dropped rather than written: a
    // line with no name is a line no view could show and no total could
    // attribute.
    const named = this.items.filter((item) => item.name.trim() !== '');

    await writePurchaseItems(this.deps.app, this.deps.getSettings(), this.purchase.file, named);
    this.deps.onSaved();
    this.close();
  }
}

/**
 * The lines of a budget, keyed to accounts.
 *
 * A line is an account, what one occurrence costs, and how often it falls. The
 * twelve monthly figures are derived from those three, which is what keeps a
 * year of a household to about fifty numbers instead of six hundred.
 *
 * **The yearly total is shown as you type**, because that is the figure
 * somebody is actually deciding: a monthly amount and an annual one look alike
 * on the row and differ twelvefold in the year.
 */
export class EditBudgetLinesModal extends Modal {
  private readonly lines: AccountBudgetLine[];
  private summary!: HTMLElement;

  constructor(
    private readonly deps: EditDeps,
    private readonly budget: AccountBudgetRecord<TFile>
  ) {
    super(deps.app);
    this.lines = budget.lines.map((line) => ({ ...line, overrides: { ...line.overrides } }));
  }

  onOpen(): void {
    this.contentEl.addClass('nod-form');
    this.setTitle(`${t('finance.budget')}: ${this.budget.title}`);

    const settings = this.deps.getSettings();
    // Only the accounts a budget can be about. Budgeting a bank balance is not
    // a thing anybody means, and offering it invites a line that can never be
    // measured.
    const accounts = readAccounts(this.deps.app, settings)
      .map((record) => record.account)
      .filter((account) => account.kind === 'expense' || account.kind === 'income');

    const list = this.contentEl.createDiv();
    this.summary = this.contentEl.createDiv({ cls: 'nod-settings-note' });

    listEditor<AccountBudgetLine>(list, {
      rows: this.lines,
      blank: () => ({
        account: accounts[0]?.number ?? 0,
        amount: 0,
        rhythm: 'monthly',
        startMonth: null,
        note: '',
        overrides: {},
      }),
      addLabel: t('common.add'),
      emptyLabel: t('dashboard.noBudget'),
      onChange: () => this.renderSummary(),
      renderRow: (line, cell) => {
        const setting = new Setting(cell);
        setting.settingEl.addClass('nod-list-setting');

        setting.addDropdown((dropdown) => {
          for (const account of accounts) {
            dropdown.addOption(String(account.number), accountLabel(account));
          }
          dropdown.setValue(String(line.account));
          dropdown.onChange((value) => (line.account = Number(value)));
        });
        numberField(
          setting,
          t('finance.amount'),
          () => line.amount,
          (v) => (line.amount = v ?? 0),
          () => this.renderSummary()
        );
        setting.addDropdown((dropdown) => {
          for (const rhythm of BUDGET_RHYTHMS) {
            dropdown.addOption(rhythm, t(`cadence.${rhythm}`));
          }
          dropdown.setValue(line.rhythm);
          dropdown.onChange((value) => {
            line.rhythm = value as AccountBudgetLine['rhythm'];
            this.renderSummary();
          });
        });
        numberField(
          setting,
          t('period.month'),
          () => line.startMonth,
          (v) => (line.startMonth = v),
          () => this.renderSummary()
        );
      },
    });

    this.renderSummary();

    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText(t('common.cancel')).onClick(() => this.close()))
      .addButton((button) =>
        button
          .setButtonText(t('common.save'))
          .setCta()
          .onClick(() => void this.save())
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderSummary(): void {
    const year = budgetYear(this.lines);
    this.summary.setText(
      `${t('finance.planned')} ${money(year.total, this.budget.currency)} / ${t('period.year')}`
    );
  }

  private async save(): Promise<void> {
    // A line planning nothing on an account is dropped: it can never be
    // measured against anything and is only ever a row somebody abandoned.
    const meaningful = this.lines.filter((line) => line.account > 0);

    await writeBudgetLines(this.deps.app, this.deps.getSettings(), this.budget.file, meaningful);
    this.deps.onSaved();
    this.close();
  }
}
