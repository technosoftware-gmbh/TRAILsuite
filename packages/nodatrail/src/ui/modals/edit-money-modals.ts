/**
 * The creation forms, over notes that already exist.
 *
 * A money note gets corrected: a figure read wrong off a PDF, an area decided
 * later, a document filed after the note was made, a policy replaced at renewal.
 * Obsidian's own property editor can change most of it, and the things it
 * cannot are the ones these exist for: a company chosen from the ones that
 * exist, and a document filed beside the note rather than typed as a path.
 *
 * Each is the creation form with the title turned off and the submit rerouted,
 * rather than a second copy of the same dozen fields that drifts from the first
 * one the day either is touched.
 *
 * **The title is not offered.** Renaming is Obsidian's operation and it has
 * links to keep in step; a finance dialog that quietly renamed files would be
 * one nobody trusts with a folder. Which is also why a note opened here counts
 * as titled by hand: it is called what it is called, whatever the derivation
 * would say about it now.
 */
import { Notice, TFile } from 'obsidian';
import type { App } from 'obsidian';
import { type BillRecord, type PurchaseRecord, type RecurringRecord } from 'trail-core';
import { t } from '../../lang/I18nManager';
import type { NODAtrailSettings } from '../../settings/types';
import { writeBillEdits, writePurchaseEdits, writeRecurringEdits } from '../../finance/edit-money';
import { fileDocumentChoices } from '../../finance/file-document';
import { dateOf } from '../../finance/paths';
import { NewBillModal, NewPurchaseModal, NewRecurringModal } from './new-finance-modals';
import { RecordDeliveryModal } from './record-delivery-modal';

export interface EditMoneyDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  now: () => Date;
  onSaved: () => void;
}

/** The four things every one of these does the same way. */
function creationDeps(deps: EditMoneyDeps) {
  return {
    app: deps.app,
    getSettings: deps.getSettings,
    now: deps.now,
    onCreated: () => deps.onSaved(),
  };
}

export class EditBillModal extends NewBillModal {
  constructor(
    private readonly editDeps: EditMoneyDeps,
    private readonly bill: BillRecord<TFile>
  ) {
    super(creationDeps(editDeps));
    this.typedTitle = bill.title;
    this.account = bill.account;
    this.lines = bill.lines;
    this.companyTitle = bill.companyTitle ?? '';
    this.areaTitle = bill.areaTitle ?? '';
    this.category = bill.category ?? '';
    this.amount = bill.amount;
    this.currency = bill.currency ?? this.currency;
    this.issueDate = bill.issueDate;
    this.dueDate = bill.dueDate;
    this.reference = bill.reference ?? '';
    this.recurringTitle = bill.recurringTitle ?? '';
    this.documentChoices = bill.documentPaths.map((path) => ({ path, outside: null }));
    this.direction = bill.direction;
  }

  protected override heading(): string {
    return `${t('finance.bills')}: ${this.bill.title}`;
  }

  protected override offersTitle(): boolean {
    return false;
  }

  protected override async submit(): Promise<void> {
    const settings = this.editDeps.getSettings();
    const documentPaths = await fileDocumentChoices(
      this.editDeps.app,
      settings,
      'bill',
      dateOf(this.issueDate ?? this.dueDate),
      this.documentChoices
    );

    await writeBillEdits(this.editDeps.app, settings, this.bill.file, {
      companyTitle: this.companyTitle || null,
      areaTitle: this.areaTitle || null,
      category: this.category || null,
      amount: this.amount,
      currency: this.currency,
      issueDate: this.issueDate,
      dueDate: this.dueDate,
      reference: this.reference.trim() || null,
      documentPaths,
      direction: this.direction,
      account: this.account,
      lines: this.lines,
      recurringTitle: this.recurringTitle || null,
    });

    new Notice(t('notices.noteUpdated', { title: this.bill.title }));
    this.editDeps.onSaved();
  }
}

export class EditPurchaseModal extends NewPurchaseModal {
  constructor(
    private readonly editDeps: EditMoneyDeps,
    private readonly purchase: PurchaseRecord<TFile>
  ) {
    super(creationDeps(editDeps));
    this.typedTitle = purchase.title;
    this.companyTitle = purchase.companyTitle ?? '';
    this.areaTitle = purchase.areaTitle ?? '';
    this.category = purchase.category ?? '';
    this.amount = purchase.amount;
    this.currency = purchase.currency ?? this.currency;
    this.orderDate = purchase.date;
    this.status = purchase.status;
    this.reference = purchase.reference;
    this.documentChoices = purchase.documentPaths.map((path) => ({ path, outside: null }));
  }

  protected override heading(): string {
    return `${t('finance.purchases')}: ${this.purchase.title}`;
  }

  protected override offersTitle(): boolean {
    return false;
  }

  /**
   * Recording a box is its own dialog rather than a section here.
   *
   * This form edits what the purchase IS; a consignment is something that
   * happened to it, and it happens on a different day from the one the purchase
   * was entered on. A list of tick boxes for the second parcel inside the form
   * that also renames the vendor would make the common reason for opening this
   * modal -- fixing a typo -- a longer screen for everybody.
   */
  protected override extraButtons(): {
    label: string;
    warning: boolean;
    run: () => Promise<void>;
  }[] {
    // Nothing to tick against a purchase whose lines nobody typed, and a dialog
    // offering an empty list is worse than a button that is not there.
    if (this.purchase.items.length === 0) return [];

    return [
      {
        label: t('finance.recordDelivery'),
        warning: false,
        run: async () => {
          new RecordDeliveryModal(this.editDeps, this.purchase).open();
        },
      },
    ];
  }

  protected override async submit(): Promise<void> {
    const settings = this.editDeps.getSettings();
    const documentPaths = await fileDocumentChoices(
      this.editDeps.app,
      settings,
      'purchase',
      dateOf(this.orderDate),
      this.documentChoices
    );

    // The lines are not touched. They have an editor of their own, and a form
    // that rewrote them from fields it never showed would lose them.
    await writePurchaseEdits(this.editDeps.app, settings, this.purchase.file, {
      companyTitle: this.companyTitle || null,
      areaTitle: this.areaTitle || null,
      category: this.category || null,
      amount: this.amount,
      currency: this.currency,
      date: this.orderDate,
      status: this.status,
      reference: this.reference.trim(),
      documentPaths,
    });

    new Notice(t('notices.noteUpdated', { title: this.purchase.title }));
    this.editDeps.onSaved();
  }
}

export class EditRecurringModal extends NewRecurringModal {
  constructor(
    private readonly editDeps: EditMoneyDeps,
    private readonly recurring: RecurringRecord<TFile>
  ) {
    super(creationDeps(editDeps));
    this.typedTitle = recurring.title;
    this.companyTitle = recurring.companyTitle ?? '';
    this.areaTitle = recurring.areaTitle ?? '';
    this.category = recurring.category ?? '';
    this.amount = recurring.amount;
    this.currency = recurring.currency ?? this.currency;
    this.cadence = recurring.cadence;
    this.interval = recurring.interval;
    this.startDate = recurring.startDate;
    this.endDate = recurring.endDate;
    this.status = recurring.status;
    this.reference = recurring.reference ?? '';
    this.account = recurring.account;
    this.documentChoices = recurring.documentPaths.map((path) => ({ path, outside: null }));
  }

  protected override heading(): string {
    return `${t('finance.recurring')}: ${this.recurring.title}`;
  }

  protected override offersTitle(): boolean {
    return false;
  }

  protected override async submit(): Promise<void> {
    const settings = this.editDeps.getSettings();
    const documentPaths = await fileDocumentChoices(
      this.editDeps.app,
      settings,
      'recurring',
      dateOf(this.startDate),
      this.documentChoices
    );

    await writeRecurringEdits(this.editDeps.app, settings, this.recurring.file, {
      companyTitle: this.companyTitle || null,
      areaTitle: this.areaTitle || null,
      category: this.category || null,
      amount: this.amount,
      currency: this.currency,
      cadence: this.cadence,
      interval: Math.max(1, Math.round(this.interval)),
      startDate: this.startDate,
      endDate: this.endDate,
      status: this.status,
      reference: this.reference.trim() || null,
      documentPaths,
      account: this.account,
    });

    new Notice(t('notices.noteUpdated', { title: this.recurring.title }));
    this.editDeps.onSaved();
  }
}
