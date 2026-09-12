/**
 * One posting, entered by hand.
 *
 * Until now a posting could only arrive by importing a statement, which leaves
 * out everything a bank never sees: a credit card invoice, a cash payment, a
 * tax assessment, an opening debt. Those are exactly the postings that have to
 * exist **before** a bank statement is imported, because the statement holds
 * only the payment and the payment settles a debt that something else created.
 *
 * **A split is the common case, not the exception.** A card invoice is one
 * amount owed to the card and a dozen purchases behind it, so the leg editor is
 * a button away rather than a separate command.
 *
 * **The currency comes from the accounts, never from a setting.** A posting
 * between a franc account and a euro one has to carry both figures, because
 * each side takes the figure written in its own currency. Writing one figure
 * would take francs off a euro cash box, and the form asks for the second
 * figure rather than letting that be entered at all.
 *
 * **Either figure may be the one somebody types, and the rate fills the
 * other.** Which of the two is the fact depends on the accounts, not on the
 * form's layout. Money spent from a euro cash box was spent in euros: the
 * franc figure is a notional value at a rate on a day, and asking for it first
 * is asking somebody to work out the derived number and then be offered the
 * one they already knew. A franc card charged in euros is the other way round
 * -- there the bank states the franc amount and it is the euro one that is
 * inferred. So neither direction is offered as the default; both buttons are
 * there and each says what it would write.
 */
import { Notice } from 'obsidian';
import {
  accountLabel,
  formatDayTitle,
  parseDayTitle,
  roundCents,
  type Account,
  type Posting,
} from '@technosoftware/trail-core';
import { rateFor } from '../shared/rates';
import { readOrders } from '../finance/read-orders';
import { t } from '../lang/I18nManager';
import { FormModal } from '../ui/modals/form-modal';
import type { CreateDeps } from '../ui/modals/new-para-modals';
import { readAccounts } from './read-ledger';
import { writePostings, type SplitLeg } from './import-write';
import { SplitLegsModal } from './split-modal';

export class NewPostingModal extends FormModal {
  // Protected so the edit form can be this form over a posting that already
  // exists, rather than a second copy of the same seven fields.
  protected day: string;
  protected description = '';
  protected amount: number | null = null;
  protected debit: number | null = null;
  protected credit: number | null = null;
  protected reference = '';
  /** The other side of a conversion, in the other account's currency. */
  protected counterAmount: number | null = null;
  /**
   * The statement row this posting came from, when it came from one.
   *
   * Null here, because a posting entered by hand came from no row. It is a
   * field rather than a literal so that the **edit** form can carry the
   * original key through: a posting somebody corrects is still the row it
   * always was, and an edit that drops its key makes that row importable all
   * over again.
   *
   * Found in a real vault. Four card rows were given the wrong account by an
   * import, corrected by hand, and came back as ready on the next import of
   * the same file -- each one a duplicate nobody would have seen until a
   * balance was wrong months later.
   *
   * Kept across a change of date or figure as well. Correcting what a row says
   * does not make it a different row, and the key records which row it was.
   */
  protected importKey: string | null = null;
  protected legs: SplitLeg[] = [];
  protected accounts: Account[] = [];

  constructor(private readonly deps: CreateDeps) {
    super(deps.app);
    this.day = formatDayTitle(deps.now());
  }

  protected heading(): string {
    return t('ledger.newPosting');
  }

  protected override blocker(): string | null {
    if (!parseDayTitle(this.day.trim())) return t('ledger.needsDate');
    if (this.amount === null || this.amount <= 0) return t('ledger.needsAmount');

    // One side may be replaced by the legs; the other always has to be named.
    if (this.legs.length > 0) {
      return this.credit === null && this.debit === null ? t('ledger.needsOneAccount') : null;
    }

    if (this.debit === null && this.credit === null) return t('ledger.needsBothAccounts');
    if (this.debit === null) return t('ledger.needsDebit');
    if (this.credit === null) return t('ledger.needsCredit');

    // A posting across two currencies without the second figure is a posting
    // that would move the wrong amount through one of its accounts.
    if (this.converts() && (this.counterAmount === null || this.counterAmount <= 0)) {
      return t('ledger.needsCounterAmount', { currency: this.farCurrency() });
    }
    return null;
  }

  /** The currency an account keeps, falling back to the reporting currency. */
  private currencyOf(number: number | null): string {
    const home = this.deps.getSettings().homeCurrency;
    if (number === null) return home;
    return this.accounts.find((account) => account.number === number)?.currency ?? home;
  }

  /** What the amount is written in: the side being grown, or the payer for a split. */
  protected nearCurrency(): string {
    return this.currencyOf(this.legs.length > 0 ? this.credit : this.debit);
  }

  /** What the other side is written in, when it is written in something else. */
  protected farCurrency(): string {
    return this.currencyOf(this.credit);
  }

  /**
   * Whether this posting crosses two currencies.
   *
   * A split is excluded: its legs share the header's figure, and a split whose
   * legs were in a third currency is a shape the journal format has no room for.
   */
  protected converts(): boolean {
    if (this.legs.length > 0) return false;
    if (this.debit === null || this.credit === null) return false;
    return this.nearCurrency() !== this.farCurrency();
  }

  protected fields(container: HTMLElement): void {
    this.accounts = readAccounts(this.deps.app, this.deps.getSettings()).map(
      (record) => record.account
    );

    if (this.accounts.length === 0) {
      container.createEl('p', { text: t('ledger.noAccounts') });
      return;
    }

    this.date(
      container,
      t('ledger.postingDate'),
      () => this.day,
      (value) => {
        this.day = value ?? '';
      }
    );
    this.text(
      container,
      t('common.description'),
      () => this.description,
      (v) => (this.description = v)
    );
    this.number(
      container,
      `${t('finance.amount')} (${this.nearCurrency()})`,
      () => this.amount,
      (value) => {
        this.amount = value;
      }
    );

    // Debit and credit, named as what they mean rather than as what they are
    // called: "to" grows, "from" pays. The accounting words are on the journal
    // table where somebody reading a ledger expects them.
    this.account(
      container,
      `${t('ledger.debit')} (${t('ledger.toAccount')})`,
      () => this.debit,
      (v) => (this.debit = v)
    );
    this.account(
      container,
      `${t('ledger.credit')} (${t('ledger.fromAccount')})`,
      () => this.credit,
      (v) => (this.credit = v)
    );

    // After both accounts, because whether it is needed depends on them, and
    // before the reference, because it is part of the figure rather than a note
    // about it.
    if (this.converts()) this.conversionRow(container);

    this.text(
      container,
      t('finance.reference'),
      () => this.reference,
      (v) => (this.reference = v)
    );

    this.splitRow(container);
  }

  /**
   * The second figure, for a posting between two currencies.
   *
   * The rate from the settings fills it rather than deciding it: a household
   * keeps one rate per currency and a real purchase happened at the rate the
   * card gave that day, so the suggestion is a starting point somebody
   * overwrites with what they were actually charged.
   */
  private conversionRow(container: HTMLElement): void {
    const near = this.nearCurrency();
    const far = this.farCurrency();

    this.number(
      container,
      `${t('finance.amount')} (${far})`,
      () => this.counterAmount,
      (value) => {
        this.counterAmount = value;
      }
    );

    const line = container.createDiv({ cls: 'nod-ledger-picker' });
    line.createSpan({
      cls: 'nod-ledger-hint',
      text: t('ledger.twoCurrencies', { near, far }),
    });

    // One button per direction, each offered only once the figure it reads
    // from has been typed. Both can be on screen at once, which is not a
    // conflict: whichever is pressed last is the one that stands, and the
    // figure each would write is on its own face.
    this.rateButton(line, far, this.converted(this.amount, near, far), (value) => {
      this.counterAmount = value;
    });
    this.rateButton(line, near, this.converted(this.counterAmount, far, near), (value) => {
      this.amount = value;
    });
  }

  /** One direction of the conversion, or nothing when it cannot be offered. */
  private rateButton(
    line: HTMLElement,
    currency: string,
    suggestion: number | null,
    apply: (value: number) => void
  ): void {
    if (suggestion === null) return;

    const button = line.createEl('button', {
      text: t('ledger.useRate', { amount: suggestion.toFixed(2), currency }),
    });
    button.addEventListener('click', () => {
      apply(suggestion);
      this.rerender();
    });
  }

  /**
   * `amount` in `from`, expressed in `to`, at the settings rates, or null.
   *
   * Both sides go through the home currency rather than dividing one rate by
   * the other directly, which is the same arithmetic and is right when one of
   * the two currencies is the home one and there is no rate to look up.
   *
   * Null for a missing figure as well as a missing rate, so a button is simply
   * not offered rather than offered and refusing.
   */
  private converted(amount: number | null, from: string, to: string): number | null {
    if (amount === null || amount <= 0) return null;
    const settings = this.deps.getSettings();
    const source = rateFor(from, settings);
    const target = rateFor(to, settings);
    if (source === null || target === null || target === 0) return null;
    return roundCents((amount * source) / target);
  }

  /** The split button, and what it has been told so far. */
  private splitRow(container: HTMLElement): void {
    const line = container.createDiv({ cls: 'nod-ledger-picker' });
    line.createSpan({
      text:
        this.legs.length > 0
          ? t('ledger.legsSet', { count: String(this.legs.length) })
          : t('ledger.splitHint'),
    });

    const button = line.createEl('button', { text: t('ledger.split') });
    button.addEventListener('click', () => {
      const total = this.amount ?? 0;
      if (total <= 0) {
        new Notice(t('ledger.amountFirst'));
        return;
      }
      new SplitLegsModal(
        this.deps.app,
        {
          total,
          accounts: this.accounts,
          legs: this.legs,
          label: this.description || t('ledger.newPosting'),
          // A card statement is the commonest split there is, and its legs name
          // orders the vault already priced.
          orders: readOrders(this.deps.app, this.deps.getSettings()),
        },
        (saved) => {
          this.legs = saved;
          // The legs replace the debit side, which is what a card invoice is:
          // one amount owed and several things bought.
          this.debit = null;
          // A split carries one figure, so a second one would be written and
          // never read.
          this.counterAmount = null;
          this.rerender();
        }
      ).open();
    });
  }

  private account(
    container: HTMLElement,
    name: string,
    get: () => number | null,
    set: (value: number | null) => void
  ): void {
    this.select(
      container,
      name,
      [
        ['', this.legs.length > 0 ? t('ledger.fromSplit') : t('ledger.chooseAccount')],
        ...this.accounts.map((account): [string, string] => [
          String(account.number),
          accountLabel(account),
        ]),
      ],
      () => (get() === null ? '' : String(get())),
      (value) => {
        const before = this.currencyShape();
        set(value ? Number(value) : null);
        // Both the amount's label and the conversion row are decided from the
        // two accounts' currencies, and both are drawn before either account
        // has been chosen -- so neither can be right until the form is drawn
        // again. Without this the box goes on saying the home currency, the
        // second figure is never offered, and the only sign anything is wrong
        // is `blocker()` refusing to save with a message about a field that is
        // not on screen. Redrawn rather than written in place, because what
        // changes is a label and a whole row rather than a value somebody is
        // part-way through typing.
        if (this.currencyShape() !== before) this.rerender();
      }
    );
  }

  /**
   * Everything the form's shape is decided from, as one string to compare.
   *
   * One string, so a change of either account is one comparison rather than
   * two that can disagree.
   *
   * `converts()` is in here as well as the two currencies, and it has to be.
   * An account nobody has chosen yet reports the **home** currency, so the pair
   * alone cannot tell "not chosen" from "chosen, and it keeps francs". Choose
   * the EUR account first and the CHF one second and the pair reads `CHF EUR`
   * both times -- unchanged, no redraw, and the second figure the posting now
   * needs is never offered. Found on an iPad against 1006/1001, where picking
   * the two accounts in the other order had always hidden it.
   */
  private currencyShape(): string {
    return `${this.nearCurrency()} ${this.farCurrency()} ${String(this.converts())}`;
  }

  /** The posting the form currently describes, or null when it is not complete. */
  protected built(): { posting: Posting; legs: SplitLeg[] } | null {
    const date = parseDayTitle(this.day.trim());
    if (!date || this.amount === null) return null;
    return { posting: this.posting(date), legs: this.legs };
  }

  private posting(date: Date): Posting {
    return {
      date: formatDayTitle(date),
      debit: this.debit,
      credit: this.credit,
      amount: roundCents(this.amount ?? 0),
      currency: this.nearCurrency(),
      text: this.description.trim(),
      reference: this.reference.trim() || null,
      counterAmount:
        this.converts() && this.counterAmount !== null ? roundCents(this.counterAmount) : null,
      counterCurrency: this.converts() && this.counterAmount !== null ? this.farCurrency() : null,
      line: 0,
      entryLine: 0,
      splitOf: null,
      importKey: this.importKey,
    };
  }

  protected async submit(): Promise<void> {
    const built = this.built();
    if (!built) return;

    const result = await writePostings(
      this.deps.app,
      this.deps.getSettings(),
      [built],
      this.deps.now()
    );

    new Notice(t('ledger.imported', { count: '1', notes: String(result.files.length) }));
    const file = result.files[0];
    if (file) this.deps.onCreated(file);
  }
}
