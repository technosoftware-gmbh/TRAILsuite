/**
 * Marking a bill paid, on a day the reader confirms, from an account they name.
 *
 * A prompt rather than a one-click "paid today", because the day a bill was paid
 * and the day somebody got round to recording it are routinely not the same, and
 * a bill dated wrong lands in the wrong month's budget. The field starts at the
 * due date, which is when a standing order pays and roughly when a person does.
 *
 * **This dialog is for payments no bank statement will ever carry.** Cash, and
 * any account with no export. Where a statement does exist the import is what
 * settles the bill, because it is the thing that knows the payment really
 * happened; see `settle-bill.ts` for the two halves of that.
 *
 * Which is why this writes the journal posting itself. Nothing else is going
 * to, and a bill marked paid that never reached the ledger is a household
 * account that quietly disagrees with itself. Both accounts have to be known
 * before it can, and the dialog says so rather than writing half of it.
 */
import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import {
  accountLabel,
  billPostingLines,
  formatPosting,
  paymentsNearMiss,
  postingsCovering,
  type Account,
  type BillRecord,
  type NearMiss,
  type Posting,
} from 'trail-core';
import { t } from '../../lang/I18nManager';
import { day } from '../kit/format';
import { likelyPaidDate, setBillPaid } from '../../finance/edit-finance';
import { accountChoices, accountValue } from '../../ledger/account-field';
import { readAccounts } from '../../ledger/read-ledger';
import { writePostings } from '../../ledger/import-write';
import { readLedger } from '../../ledger/read-ledger';
import type { NODAtrailSettings } from '../../settings/types';

export interface MarkPaidDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  today: () => Date;
  onSaved: () => void;
}

export class MarkPaidModal extends Modal {
  private paidDate: string;
  /** Where the invoice is booked. Prefilled from the note, and editable when it says nothing. */
  private account: number | null;
  /** Where the money came from. Never guessed: no bill knows which pocket somebody used. */
  private paidFrom: number | null;
  private accounts: Account[] = [];
  /**
   * Everything the ledger already holds.
   *
   * Read so this dialog can tell whether the payment is in there already: a leg
   * of a batched bank row may have posted it, or somebody may have entered it
   * by hand, and writing it again would put one payment in the books twice.
   */
  private posted: Posting[] = [];
  /** The ledger is read once per dialog, not once per redraw. */
  private readTried = false;

  constructor(
    private readonly deps: MarkPaidDeps,
    private readonly bill: BillRecord<TFile>
  ) {
    super(deps.app);
    this.paidDate = bill.paidDate ?? likelyPaidDate(bill, deps.today());
    this.account = bill.account;
    this.paidFrom = bill.paidFrom;
  }

  onOpen(): void {
    this.contentEl.addClass('nod-form');
    this.setTitle(this.bill.title);
    this.accounts = readAccounts(this.deps.app, this.deps.getSettings()).map(
      (record) => record.account
    );
    // Read once. Asynchronous, so the form draws now and the preview corrects
    // itself when the journals are in; redrawing must not read them again, or
    // the dialog would reopen itself forever.
    if (!this.readTried) {
      this.readTried = true;
      void readLedger(this.deps.app, this.deps.getSettings()).then((ledger) => {
        this.posted = [...ledger.postings];
        this.adoptPostedDate();
        this.contentEl.empty();
        this.onOpen();
      });
    }

    new Setting(this.contentEl).setName(t('finance.paidDate')).addText((input) => {
      input.inputEl.type = 'date';
      input.setValue(this.paidDate);
      input.onChange((value) => (this.paidDate = value.trim()));
    });

    // Offered only where there is one account to choose. An invoice that
    // divides has said where it goes already, and a dropdown beside its lines
    // would be a second answer to a question already settled.
    if (this.bill.lines.length === 0) {
      this.accountField(
        t('ledger.bookedTo'),
        () => this.account,
        (value) => (this.account = value)
      );
    }
    this.accountField(
      // Where the money came from, or where it landed. The same field either
      // way; only the word for it changes.
      this.bill.direction === 'outgoing' ? t('ledger.paidInto') : t('ledger.paidFrom'),
      () => this.paidFrom,
      (value) => (this.paidFrom = value)
    );

    // Said plainly rather than by disabling the button: a bill can be marked
    // paid without posting, and somebody should be able to see that is what
    // they are about to do.
    const hint = this.contentEl.createEl('p', { cls: 'nod-form-hint', text: this.preview() });
    hint.toggleClass('nod-form-hint-warn', this.nearMisses().length > 0);

    const buttons = new Setting(this.contentEl);

    // Only offered on a bill that has one, so the button is never a no-op.
    if (this.bill.paidDate) {
      buttons.addButton((button) =>
        button.setButtonText(t('finance.markUnpaid')).onClick(() => void this.write(null))
      );
    }

    buttons
      .addButton((button) => button.setButtonText(t('common.cancel')).onClick(() => this.close()))
      .addButton((button) =>
        button
          .setButtonText(t('common.save'))
          .setCta()
          .onClick(() => void this.write(this.paidDate || null))
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private accountField(
    name: string,
    get: () => number | null,
    set: (value: number | null) => void
  ): void {
    new Setting(this.contentEl).setName(name).addDropdown((dropdown) => {
      for (const [value, label] of accountChoices(this.accounts)) dropdown.addOption(value, label);
      dropdown.setValue(get() === null ? '' : String(get()));
      dropdown.onChange((raw) => {
        set(accountValue(raw));
        // The preview line below depends on both, so it is redrawn rather than
        // left saying something that stopped being true.
        this.contentEl.empty();
        this.onOpen();
      });
    });
  }

  /** What this invoice divides across: its own lines, or the single account. */
  private legs(): { account: number; amount: number; text: string }[] {
    return billPostingLines({ ...this.bill, account: this.account }).map((line) => ({
      account: line.account,
      amount: line.amount,
      text: line.note,
    }));
  }

  /**
   * The posting this payment is, when everything it needs is known.
   *
   * **The debit side is left blank on a split.** The legs fill it, which is the
   * shape `linesFor` writes and the journal parser reads back: a header naming
   * only the account that paid, and one indented leg per account behind it.
   */
  private posting(): Posting | null {
    if (!this.paidDate || this.paidFrom === null) return null;
    if (this.bill.amount === null) return null;
    const legs = this.legs();
    if (legs.length === 0) return null;

    // The two directions are one posting with its sides swapped. An invoice
    // the household owes moves money out of an account and into an expense;
    // one it sent moves money into an account and out of an income account.
    // `increasesOnDebit` is the rule underneath both, and it is already right.
    const outgoing = this.bill.direction === 'outgoing';
    const booked = legs.length > 1 ? null : (legs[0]?.account ?? null);

    return {
      date: this.paidDate,
      debit: outgoing ? this.paidFrom : booked,
      credit: outgoing ? booked : this.paidFrom,
      amount: this.bill.amount,
      currency: this.bill.currency,
      text: this.bill.companyTitle ?? this.bill.title,
      // The invoice note itself, so the journal line points back at the paper.
      reference: this.bill.title,
      counterAmount: null,
      counterCurrency: null,
      line: 0,
      entryLine: 0,
      splitOf: null,
      // No statement row behind it. That is the whole point of this dialog.
      importKey: null,
    };
  }

  /**
   * The lines this would write, shown before it writes them.
   *
   * A split is a header plus its legs, exactly as they will appear in the
   * journal note, because the point of showing it is to be checked against the
   * invoice on the desk.
   */
  /**
   * Takes the paid date from the posting that already records this payment.
   *
   * The field starts at the due date, which is a guess about when a standing
   * order pays. When the ledger already holds the payment it is not a guess at
   * all: the money moved on the day that posting says, and stamping the invoice
   * with the due date instead would put the two a week apart for no reason.
   *
   * Only for an invoice nobody has settled yet, so a date somebody typed is
   * never overwritten.
   */
  private adoptPostedDate(): void {
    if (this.bill.paidDate || this.paidFrom === null) return;

    const [first] = postingsCovering(
      this.posted,
      this.legs(),
      this.paidFrom,
      this.bill.issueDate,
      this.paidDate
    );
    if (first) this.paidDate = first.date;
  }

  /**
   * The postings already in the ledger for this payment, if there are any.
   *
   * Empty when nothing covers it, which is the ordinary case and the one where
   * this dialog writes the posting itself.
   */
  private covered(): Posting[] {
    if (!this.paidDate || this.paidFrom === null) return [];
    return postingsCovering(
      this.posted,
      this.legs(),
      this.paidFrom,
      this.bill.issueDate,
      this.paidDate
    );
  }

  /**
   * Payments that match on the money and disagree on one field.
   *
   * Only asked once nothing covers this bill, because the point of it is that
   * the covering check failed and the reader is one click from a duplicate.
   */
  private nearMisses(): NearMiss[] {
    if (!this.paidDate || this.paidFrom === null) return [];
    return paymentsNearMiss(
      this.posted,
      this.legs(),
      this.paidFrom,
      this.bill.issueDate,
      this.paidDate
    );
  }

  /** The account a posting is booked to, from the payer's side of it. */
  private otherSideOf(posting: Posting): string {
    const other = posting.debit === this.paidFrom ? posting.credit : posting.debit;
    if (other === null) return t('ledger.unassigned');
    const account = this.accounts.find((candidate) => candidate.number === other);
    return account ? accountLabel(account) : String(other);
  }

  /** The bill's own account, said the way the warning says the other one. */
  private expectedSide(): string {
    const [leg] = this.legs();
    if (!leg) return t('ledger.unassigned');
    const account = this.accounts.find((candidate) => candidate.number === leg.account);
    return account ? accountLabel(account) : String(leg.account);
  }

  private nearMissLine(miss: NearMiss): string {
    if (miss.reason === 'account') {
      return t('ledger.nearMissAccount', {
        date: day(miss.posting.date),
        booked: this.otherSideOf(miss.posting),
        expected: this.expectedSide(),
      });
    }
    return t('ledger.nearMissDate', { date: day(miss.posting.date) });
  }

  private preview(): string {
    const posting = this.posting();
    if (!posting) return t('ledger.payNeedsAccounts');

    const already = this.covered();
    if (already.length > 0) {
      return [t('ledger.alreadyPosted'), ...already.map((entry) => formatPosting(entry))].join(
        '\n'
      );
    }

    // Said before the posting it would write, because it is the reason not to
    // write it. Reported rather than enforced: somebody who means to post it
    // anyway is sometimes right, and a dialog that refused would be a dialog
    // they could not get past.
    const misses = this.nearMisses();
    if (misses.length > 0) {
      return [
        ...misses.map((miss) => this.nearMissLine(miss)),
        ...misses.map((miss) => formatPosting(miss.posting)),
        '',
        t('ledger.wouldWrite'),
        formatPosting(posting),
      ].join('\n');
    }

    const legs = this.legs();
    if (legs.length <= 1) return formatPosting(posting);

    return [
      formatPosting(posting),
      ...legs.map(
        (leg) => `    ${leg.account} | ${leg.amount.toFixed(2)}${leg.text ? ` | ${leg.text}` : ''}`
      ),
    ].join('\n');
  }

  private async write(paidDate: string | null): Promise<void> {
    const settings = this.deps.getSettings();
    const posting = paidDate ? this.posting() : null;

    try {
      // The posting first. A bill stamped paid with nothing in the ledger
      // behind it is a disagreement nothing reports; a posting with the bill
      // still open is one the next glance at the invoice list shows.
      //
      // Unless the ledger already holds it. A leg of a batched bank row, or an
      // entry made by hand, is this payment as much as one written here would
      // be, and a second copy is one payment in the books twice.
      if (posting && !this.bill.paidDate && this.covered().length === 0) {
        const legs = this.legs();
        const result = await writePostings(
          this.deps.app,
          settings,
          [{ posting, legs: legs.length > 1 ? legs : [] }],
          this.deps.today()
        );
        new Notice(
          t('ledger.imported', {
            count: String(result.written),
            notes: String(result.files.length),
          })
        );
      }

      await setBillPaid(this.deps.app, settings, this.bill.file, paidDate, this.paidFrom);
      this.deps.onSaved();
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }
}
