/**
 * The import: choose a file and an account, look at what would happen, then let
 * it happen.
 *
 * **The preview is the feature.** Every row is shown with what it would post
 * and why, and nothing is written until the button at the bottom is pressed.
 * An import that wrote first and reported afterwards is one nobody dares run on
 * a second month, which makes it worse than typing.
 *
 * Four things a row can be: ready, waiting for an account, waiting for a split,
 * or already in the ledger. Only the first is written, and the count of each is
 * on screen before and after.
 */
import { App, Modal, Notice, Setting } from 'obsidian';
import {
  CARD_ACCOUNT_PROFILE,
  accountLabel,
  SWISS_EBANKING_PROFILE,
  acceptedRows,
  addDays,
  balanceAt,
  formatDayTitle,
  parseDayTitle,
  parseStatement,
  planImport,
  postingFor,
  reconcileStatement,
  roundCents,
  ruleFrom,
  type Account,
  type BankStatementRow,
  type ImportProposal,
  type Posting,
  type StatementProfile,
} from '@technosoftware/trail-core';
import { t } from '../lang/I18nManager';
import { money } from '../ui/kit/format';
import type { NODAtrailSettings } from '../settings/types';
import { readAccounts, readLedger } from './read-ledger';
import { archiveStatement } from './statement-archive-vault';
import {
  billsForImport,
  settleBills,
  type OpenBill,
  type Settlement,
} from '../finance/settle-bill';
import { writePostings, type PendingPosting, type SplitLeg } from './import-write';
import { SplitLegsModal, type SplitBillChoice } from './split-modal';
import { paymentProviderCompanies } from '../crm/company-defaults';
import { readOrders } from '../finance/read-orders';

/** The formats that ship. A third bank is a release, not a setting. */
export const PROFILES: readonly StatementProfile[] = [SWISS_EBANKING_PROFILE, CARD_ACCOUNT_PROFILE];

export interface ImportDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  saveSettings: (settings: NODAtrailSettings) => Promise<void>;
  now: () => Date;
  onImported: () => void;
  /**
   * A statement already in the vault, to open on rather than asking for a file.
   *
   * How somebody finishes the rows they left undecided: the archive knows the
   * file and the account, so neither needs choosing a second time.
   */
  opening?: { text: string; name: string; account: number };
}

/** What the person has decided about one row, on top of what the plan proposed. */
interface Decision {
  account: number | null;
  legs: SplitLeg[];
  remember: boolean;
}

export class ImportStatementModal extends Modal {
  private profile: StatementProfile = SWISS_EBANKING_PROFILE;
  private intoAccount: number | null = null;
  private fileText = '';
  private fileName = '';

  private accounts: Account[] = [];
  /** The outstanding invoices, so a row that pays one can be recognised as paying it. */
  private openInvoices: OpenBill[] = [];
  private proposals: ImportProposal[] = [];
  private decisions = new Map<string, Decision>();
  private reconciled: { ok: boolean; opening: number | null; breaks: number } | null = null;
  /**
   * What the ledger already says this account held the day before the file
   * starts, against what the file itself implies.
   *
   * Null when the file states no running balance, or when its first row cannot
   * be dated: there is nothing to compare and saying nothing beats guessing.
   */
  private handover: {
    ledger: number;
    statement: number;
    agree: boolean;
    /** Accounts whose ledger balance the file does start from, when this one is not it. */
    fits: Account[];
  } | null = null;

  /**
   * What the file says this account ends on, and what the ledger holds up to
   * that day.
   *
   * Null when the format states no running balance or the last row cannot be
   * dated, on the same terms as `handover`: there is nothing to compare and
   * saying nothing beats guessing.
   */
  private closing: { statement: number; day: string; postings: readonly Posting[] } | null = null;

  private body: HTMLElement | null = null;
  private footer: HTMLElement | null = null;

  constructor(private readonly deps: ImportDeps) {
    super(deps.app);

    const opening = deps.opening;
    if (opening) {
      this.fileText = opening.text;
      this.fileName = opening.name;
      this.intoAccount = opening.account;
    }
  }

  override onOpen(): void {
    this.accounts = readAccounts(this.deps.app, this.deps.getSettings()).map(
      (record) => record.account
    );
    this.intoAccount = this.accounts.find((account) => account.kind === 'asset')?.number ?? null;
    this.render();
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    // A statement row is a date, a figure, a description, what it settles and
    // an account. Five columns do not fit a default modal.
    this.modalEl.addClass('nod-import-modal');
    contentEl.createEl('h2', { text: t('ledger.importStatement') });

    if (this.accounts.length === 0) {
      contentEl.createEl('p', { text: t('ledger.noAccounts') });
      return;
    }

    this.renderChooser(contentEl);
    this.body = contentEl.createDiv({ cls: 'nod-import-body' });
    this.footer = contentEl.createDiv({ cls: 'nod-import-footer' });
    this.renderPlan();
  }

  private renderChooser(parent: HTMLElement): void {
    const balanceAccounts = this.accounts.filter(
      (account) => account.kind === 'asset' || account.kind === 'liability'
    );

    new Setting(parent).setName(t('ledger.intoAccount')).addDropdown((dropdown) => {
      for (const account of balanceAccounts) {
        dropdown.addOption(String(account.number), accountLabel(account));
      }
      dropdown.setValue(String(this.intoAccount ?? balanceAccounts[0]?.number ?? ''));
      dropdown.onChange((value) => {
        this.intoAccount = Number(value);
        this.renderPlan();
      });
    });

    new Setting(parent).setName(t('ledger.format')).addDropdown((dropdown) => {
      for (const profile of PROFILES) dropdown.addOption(profile.name, profile.name);
      dropdown.setValue(this.profile.name);
      dropdown.onChange((value) => {
        this.profile = PROFILES.find((profile) => profile.name === value) ?? this.profile;
        this.renderPlan();
      });
    });

    new Setting(parent).setName(t('ledger.file')).then((setting) => {
      const input = setting.controlEl.createEl('input', { type: 'file' });
      input.accept = '.csv,text/csv';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        void file.text().then((text) => {
          this.fileText = text;
          this.fileName = file.name;
          this.decisions.clear();
          this.renderPlan();
        });
      });
    });
  }

  /** Reads the file, plans, and draws. Called again after every decision. */
  private renderPlan(): void {
    const body = this.body;
    const footer = this.footer;
    if (!body || !footer) return;

    body.empty();
    footer.empty();

    if (!this.fileText || this.intoAccount === null) {
      body.createEl('p', { text: t('ledger.chooseFile') });
      return;
    }

    const settings = this.deps.getSettings();
    void readLedger(this.deps.app, settings).then((ledger) => {
      const parsed = parseStatement(this.fileText, this.profile);
      const rows = acceptedRows(parsed, this.profile);
      const balance = reconcileStatement(rows, false);
      this.reconciled = { ok: balance.ok, opening: balance.opening, breaks: balance.breaks.length };

      this.handover = this.compareHandover(rows, balance.opening, ledger.postings);

      // `acceptedRows` hands them over oldest first whichever way the file was
      // written, so the last one is the one the file ends on.
      const last = rows[rows.length - 1];
      this.closing =
        last && last.balance !== null && parseDayTitle(last.date)
          ? { statement: last.balance, day: last.date, postings: ledger.postings }
          : null;

      this.openInvoices = billsForImport(this.deps.app, settings, this.deps.now());
      const plan = planImport(rows, {
        intoAccount: this.intoAccount ?? 0,
        accounts: this.accounts,
        rules: settings.importRules,
        existing: ledger.postings,
        bills: this.openInvoices.map((bill) => bill.forMatching),
        paymentProviders: paymentProviderCompanies(this.deps.app, settings),
        // A card charge for an order a sibling plugin already recorded takes
        // that order's number, so nobody types a figure the vault holds twice.
        orders: readOrders(this.deps.app, settings),
      });
      this.proposals = plan.proposals;

      body.empty();
      this.renderSummary(body, parsed.rows.length, rows.length);
      this.renderRows(body);
      this.renderFooter(footer);
    });
  }

  /**
   * The join between what is already booked and what is about to be.
   *
   * Every statement states the balance it starts from, and the ledger knows
   * what it thinks that account held the day before. If the two agree, this
   * file continues the story the ledger is already telling. If they do not,
   * something is missing between them, and finding that out before writing
   * beats finding it out from a balance that is quietly wrong ever after.
   */
  private compareHandover(
    rows: readonly BankStatementRow[],
    statementOpening: number | null,
    postings: readonly Posting[]
  ): { ledger: number; statement: number; agree: boolean; fits: Account[] } | null {
    if (statementOpening === null) return null;

    const account = this.accounts.find((candidate) => candidate.number === this.intoAccount);
    const first = rows[0];
    if (!account || !first) return null;

    const start = parseDayTitle(first.date);
    if (!start) return null;

    const dayBefore = formatDayTitle(addDays(start, -1));
    const ledger = balanceAt(postings, account, dayBefore);
    const agree = Math.abs(ledger - statementOpening) < 0.005;

    return {
      ledger,
      statement: statementOpening,
      agree,
      // When they do not agree, the commonest reason by far is that this file
      // belongs to another account. Naming the one whose balance the file does
      // start from turns "something is missing" into "you picked the wrong
      // account", which is a different afternoon.
      fits: agree
        ? []
        : this.accounts.filter(
            (candidate) =>
              candidate.number !== account.number &&
              Math.abs(balanceAt(postings, candidate, dayBefore) - statementOpening) < 0.005
          ),
    };
  }

  /**
   * Where this account will stand once the write is done, against where the
   * file says it ends.
   *
   * The twin of `compareHandover`, and the half that was missing. That one
   * asks whether this file continues the ledger's story; this one asks whether
   * the ledger will still be telling it afterwards. Everything on this screen
   * used to be about the beginning of the file, so a run could write what it
   * could, leave a dozen rows undecided, and report nothing but success -- and
   * the account was silently out by their total until somebody added it up by
   * hand months later.
   *
   * Recomputed on every render rather than with the plan, because answering a
   * row is what changes it: the figure has to move as the questions are
   * answered, or it is advice about a screen that no longer exists.
   *
   * The undecided total is carried separately because it is almost always the
   * whole of the difference, and saying "twelve rows have no account and they
   * come to 992.33" is the sentence that ends the search.
   */
  private landing(): {
    ledger: number;
    statement: number;
    agree: boolean;
    undecided: number;
    undecidedRows: number;
  } | null {
    const closing = this.closing;
    const account = this.accounts.find((candidate) => candidate.number === this.intoAccount);
    if (!closing || !account) return null;

    let willWrite = 0;
    let undecided = 0;
    let undecidedRows = 0;
    for (const proposal of this.proposals) {
      const status = this.statusOf(proposal);
      // A row's own amount is what it moves through the account being imported
      // into, whichever way round the posting ends up.
      if (status === 'ready') willWrite += proposal.row.amount;
      else if (status === 'needs-account' || status === 'needs-split') {
        undecided += proposal.row.amount;
        undecidedRows += 1;
      }
    }

    const ledger = roundCents(balanceAt(closing.postings, account, closing.day) + willWrite);
    return {
      ledger,
      statement: closing.statement,
      agree: Math.abs(ledger - closing.statement) < 0.005,
      undecided: roundCents(undecided),
      undecidedRows,
    };
  }

  private renderSummary(parent: HTMLElement, read: number, accepted: number): void {
    const counts = this.currentCounts();
    const summary = parent.createDiv({ cls: 'nod-import-summary' });

    summary.createEl('p', {
      text: t('ledger.importSummary', {
        file: this.fileName,
        read: String(read),
        accepted: String(accepted),
        ready: String(counts.ready),
        attention: String(counts.attention),
        skipped: String(counts.skipped),
      }),
    });

    // The balance chain is the reason to trust the rest of this screen, so it
    // is stated whether it held or not rather than only when it failed.
    const chain = this.reconciled;
    if (chain) {
      summary.createEl('p', {
        cls: chain.ok ? 'nod-import-ok' : 'nod-import-warn',
        text: chain.ok
          ? t('ledger.chainHolds', {
              opening: money(chain.opening ?? 0, null),
            })
          : t('ledger.chainBreaks', { count: String(chain.breaks) }),
      });
    }

    const handover = this.handover;
    if (handover) {
      const currency = this.deps.getSettings().homeCurrency;
      summary.createEl('p', {
        cls: handover.agree ? 'nod-import-ok' : 'nod-import-warn',
        text: handover.agree
          ? t('ledger.handoverAgrees', {
              balance: money(handover.ledger, currency),
            })
          : t('ledger.handoverDiffers', {
              ledger: money(handover.ledger, currency),
              statement: money(handover.statement, currency),
              difference: money(handover.statement - handover.ledger, currency),
            }),
      });

      // The likelier explanation, when there is one.
      if (handover.fits.length > 0) {
        summary.createEl('p', {
          cls: 'nod-import-warn',
          text: t('ledger.handoverFits', {
            accounts: handover.fits.map((candidate) => accountLabel(candidate)).join(', '),
          }),
        });
      }
    }

    const landing = this.landing();
    if (landing) {
      const currency = this.deps.getSettings().homeCurrency;
      summary.createEl('p', {
        cls: landing.agree ? 'nod-import-ok' : 'nod-import-warn',
        text: landing.agree
          ? t('ledger.landingAgrees', { balance: money(landing.statement, currency) })
          : t('ledger.landingDiffers', {
              ledger: money(landing.ledger, currency),
              statement: money(landing.statement, currency),
              difference: money(landing.statement - landing.ledger, currency),
            }),
      });

      // Named only when it is the difference, so the sentence is an
      // explanation rather than a second thing to weigh up.
      if (!landing.agree && landing.undecidedRows > 0) {
        summary.createEl('p', {
          cls: 'nod-import-warn',
          text: t('ledger.landingUndecided', {
            count: landing.undecidedRows,
            amount: money(landing.undecided, currency),
          }),
        });
      }
    }
  }

  private renderRows(parent: HTMLElement): void {
    const expenseAccounts = this.accounts.filter((account) => account.number !== this.intoAccount);

    for (const proposal of this.proposals) {
      const decided = this.decisions.get(proposal.key);
      const status = this.statusOf(proposal);
      const line = parent.createDiv({ cls: 'nod-import-row' });
      // Written out rather than built from the status: a class name assembled
      // in a template literal is one the stylesheet check cannot see, and a
      // rule nobody can prove is used is a rule nobody dares delete.
      if (status === 'ready') line.addClass('nod-import-ready');
      else if (status === 'needs-account' || status === 'needs-split')
        line.addClass('nod-import-attention');
      else line.addClass('nod-import-skipped');

      line.createSpan({ cls: 'nod-import-date', text: proposal.row.date });
      line.createSpan({
        cls: 'nod-import-amount',
        text: money(proposal.row.amount, proposal.row.currency),
      });
      line.createSpan({ cls: 'nod-import-text', text: proposal.row.text });

      // Which invoice this row pays, shown before the account, because it is
      // the reason the account is what it is.
      if (proposal.settles) {
        line.createSpan({
          cls: 'nod-import-note',
          text: t('ledger.settlesBill', { title: proposal.settles.bill.title }),
        });
        // The division the invoice states, so it can be checked against the
        // paper before it is written rather than after.
        if (proposal.legs.length > 0) {
          line.createSpan({
            cls: 'nod-import-note',
            text: proposal.legs
              .map((leg) => `${leg.account}: ${money(leg.amount, proposal.row.currency)}`)
              .join('  '),
          });
        }
        if (proposal.settles.alsoFits.length > 0) {
          line.createSpan({
            cls: 'nod-import-warn',
            text: t('ledger.alsoOpen', { count: String(proposal.settles.alsoFits.length) }),
          });
        }
      }

      // Which order this charge paid for. Said out loud rather than only
      // written into the text, because a number appearing in a description
      // nobody was shown is a number nobody agreed to.
      if (proposal.order) {
        line.createSpan({
          cls: proposal.order.alsoFits.length > 0 ? 'nod-import-warn' : 'nod-import-note',
          text:
            proposal.order.alsoFits.length > 0
              ? t('ledger.ordersAmbiguous', {
                  count: String(proposal.order.alsoFits.length + 1),
                })
              : t('ledger.paysOrder', { title: proposal.order.order.title }),
        });
      }

      const account = decided?.account ?? proposal.counterAccount;
      if (
        status === 'already-imported' ||
        status === 'mirrors-existing' ||
        status === 'already-settled'
      ) {
        line.createSpan({ cls: 'nod-import-note', text: skipReason(status) });
        continue;
      }

      if (proposal.status === 'needs-split') {
        const legs = decided?.legs ?? [];
        line.createSpan({
          cls: 'nod-import-note',
          text: t('ledger.batchOf', { count: String(proposal.legCount ?? 0) }),
        });
        const button = line.createEl('button', {
          text:
            legs.length > 0
              ? t('ledger.legsSet', { count: String(legs.length) })
              : t('ledger.split'),
        });
        button.addEventListener('click', () => {
          new SplitLegsModal(
            this.deps.app,
            {
              total: Math.abs(proposal.row.amount),
              accounts: expenseAccounts,
              legs,
              label: proposal.row.text,
              // The invoices still open, so a leg can say which one it pays.
              bills: this.billChoices(),
            },
            (saved) => {
              this.decisions.set(proposal.key, {
                account: null,
                legs: saved,
                remember: false,
              });
              this.renderPlan();
            }
          ).open();
        });
        continue;
      }

      // No dropdown on a row the invoice already divided: there is no single
      // account to choose, and offering one would invite a second answer.
      if (proposal.legs.length > 0) continue;

      const dropdown = line.createEl('select', { cls: 'nod-import-select' });
      dropdown.createEl('option', { value: '', text: t('ledger.chooseAccount') });
      for (const candidate of expenseAccounts) {
        const option = dropdown.createEl('option', {
          value: String(candidate.number),
          text: accountLabel(candidate),
        });
        if (candidate.number === account) option.selected = true;
      }
      dropdown.addEventListener('change', () => {
        const chosen = dropdown.value ? Number(dropdown.value) : null;
        this.decisions.set(proposal.key, {
          account: chosen,
          legs: [],
          // Offered rather than assumed, and only for a row nothing already
          // matched: overwriting a rule that worked, because of one odd
          // payment, is how a rule set rots.
          remember: chosen !== null && proposal.matchedBy === null,
        });
        this.renderPlan();
      });

      this.renderRemember(line, proposal, decided);
    }
  }

  /**
   * Whether to learn this choice, shown as a choice.
   *
   * It used to be neither shown nor asked: picking an account on an unmatched
   * row wrote a rule, silently. That is right for a vendor who bills every
   * month and wrong for a payment that happens once -- a TWINT to a shop, say,
   * where the next one is a different shop and belongs on a different account.
   * A rule learned from one of those quietly answers a question nobody wanted
   * answered, and the rule list fills with places somebody went once.
   *
   * Ticked by default, because a recurring vendor is the commoner case, and
   * visible so the other one takes a single click. The rule it would write is
   * named, since a rule nobody can read is a rule nobody can undo.
   */
  private renderRemember(
    line: HTMLElement,
    proposal: ImportProposal,
    decided: Decision | undefined
  ): void {
    // Nothing to learn from a row that matched by itself, or one still
    // waiting for an account.
    if (proposal.matchedBy !== null || !decided?.account) return;

    const label = line.createEl('label', { cls: 'nod-import-remember' });
    const box = label.createEl('input');
    box.type = 'checkbox';
    box.checked = decided.remember;
    box.addEventListener('change', () => {
      this.decisions.set(proposal.key, { ...decided, remember: box.checked });
      this.renderPlan();
    });
    label.createSpan({ text: t('ledger.remember') });
    label.setAttribute('aria-label', ruleFrom(proposal.row, decided.account).match);
    label.title = t('ledger.rememberAs', { match: ruleFrom(proposal.row, decided.account).match });
  }

  private renderFooter(parent: HTMLElement): void {
    const counts = this.currentCounts();
    parent.empty();

    new Setting(parent)
      .addButton((button) => {
        // Keeping the file is offered on its own as well as after a write,
        // because the two are not the same act and the commoner of them has no
        // postings behind it. A statement whose rows are all already imported
        // can never reach `write()` -- the button above is disabled with
        // nothing ready -- so without this the archive could only ever hold
        // files from imports that happened after it existed, and every
        // statement already imported was unkeepable. That is also how the
        // first four in this vault got there: by hand, before this button.
        button
          .setButtonText(t('ledger.keepStatement'))
          .setDisabled(!this.fileText || this.intoAccount === null)
          .onClick(() => {
            void this.keep();
          });
      })
      .addButton((button) => {
        button
          .setButtonText(t('ledger.writePostings', { count: String(counts.ready) }))
          .setCta()
          .setDisabled(counts.ready === 0)
          .onClick(() => {
            void this.write();
          });
      });
  }

  /**
   * Files the loaded statement without writing anything.
   *
   * The same call the write path makes afterwards, so a file kept either way
   * lands under the same name and identical bytes are never stored twice.
   */
  private async keep(): Promise<void> {
    if (!this.fileText || this.intoAccount === null) return;
    const settings = this.deps.getSettings();

    try {
      const rows = acceptedRows(parseStatement(this.fileText, this.profile), this.profile);
      const kept = await archiveStatement(
        this.deps.app,
        settings,
        this.intoAccount,
        rows,
        this.fileText
      );
      new Notice(
        kept ? t('ledger.statementKept', { path: kept }) : t('ledger.statementAlreadyKept')
      );
      this.deps.onImported();
    } catch (error) {
      new Notice(t('ledger.statementNotKept', { reason: String(error) }));
    }
  }

  /** What each row would do right now, decisions included. */
  private statusOf(proposal: ImportProposal): ImportProposal['status'] | 'ready' {
    // The three ways a row is already accounted for. None of them is a decision
    // anybody can override from here, so they pass straight through.
    if (
      proposal.status === 'already-imported' ||
      proposal.status === 'mirrors-existing' ||
      proposal.status === 'already-settled'
    ) {
      return proposal.status;
    }
    const decided = this.decisions.get(proposal.key);
    if (proposal.status === 'needs-split') {
      return decided && decided.legs.length > 0 ? 'ready' : 'needs-split';
    }
    if (proposal.status === 'ready') return 'ready';
    return decided?.account ? 'ready' : 'needs-account';
  }

  private currentCounts(): { ready: number; attention: number; skipped: number } {
    let ready = 0;
    let attention = 0;
    let skipped = 0;
    for (const proposal of this.proposals) {
      const status = this.statusOf(proposal);
      if (status === 'ready') ready += 1;
      else if (
        status === 'already-imported' ||
        status === 'mirrors-existing' ||
        status === 'already-settled'
      )
        skipped += 1;
      else attention += 1;
    }
    return { ready, attention, skipped };
  }

  /**
   * Notes the invoice a row paid, if it paid one.
   *
   * Collected here and stamped after the postings are written, so a failed
   * write leaves the invoice open -- a state somebody can see and redo --
   * rather than paid with nothing behind it.
   */
  private recordSettlement(proposal: ImportProposal, into: Settlement[]): void {
    if (!proposal.settles) return;
    const settled = this.openInvoices.find(
      (bill) => bill.record.title === proposal.settles?.bill.title
    );
    if (!settled) return;

    into.push({
      bill: settled.record,
      paidDate: proposal.row.date,
      paidFrom: this.intoAccount ?? 0,
    });
  }

  /** The outstanding invoices as the split editor wants them. */
  private billChoices(): SplitBillChoice[] {
    return this.openInvoices
      .filter((bill) => !bill.record.paidDate && bill.record.amount !== null)
      .map((bill) => ({
        title: bill.record.title,
        label: `${money(bill.record.amount, bill.record.currency)}  ${bill.record.companyTitle ?? bill.record.title}`,
        amount: bill.record.amount ?? 0,
        account: bill.record.account,
      }))
      .sort((a, b) => a.amount - b.amount || a.label.localeCompare(b.label));
  }

  /**
   * The invoices the legs of one batched row settle.
   *
   * A bank row that covered eight payments can settle eight invoices, and each
   * is stamped with the row's own date: the day the money actually left, not
   * the day the invoice said it was due.
   */
  private recordLegSettlements(
    legs: readonly SplitLeg[],
    proposal: ImportProposal,
    into: Settlement[]
  ): void {
    for (const leg of legs) {
      if (!leg.settles) continue;
      const settled = this.openInvoices.find((bill) => bill.record.title === leg.settles);
      if (!settled) continue;
      into.push({
        bill: settled.record,
        paidDate: proposal.row.date,
        paidFrom: this.intoAccount ?? 0,
      });
    }
  }

  private async write(): Promise<void> {
    const settings = this.deps.getSettings();
    const pending: PendingPosting[] = [];
    const learned: BankStatementRow[] = [];
    const learnedAccounts: number[] = [];
    const settlements: Settlement[] = [];

    for (const proposal of this.proposals) {
      if (this.statusOf(proposal) !== 'ready') continue;
      const decided = this.decisions.get(proposal.key);

      if (proposal.status === 'needs-split' && decided) {
        const outward = proposal.row.amount < 0;
        pending.push({
          posting: {
            ...postingFor(proposal.row, proposal.key, this.intoAccount ?? 0, 0),
            // The unknown side is left blank and the legs fill it: outward the
            // expenses are unknown, inward the sources are.
            debit: outward ? null : (this.intoAccount ?? 0),
            credit: outward ? (this.intoAccount ?? 0) : null,
          },
          legs: decided.legs,
        });
        this.recordLegSettlements(decided.legs, proposal, settlements);
        continue;
      }

      // An invoice that divides across accounts brought its own legs, and the
      // posting it implies already has the side they fill left blank.
      if (proposal.legs.length > 0 && proposal.posting) {
        pending.push({
          posting: proposal.posting,
          legs: proposal.legs.map((leg) => ({
            account: leg.account,
            amount: leg.amount,
            text: leg.note,
          })),
        });
        this.recordSettlement(proposal, settlements);
        continue;
      }

      const account = decided?.account ?? proposal.counterAccount;
      if (account === null || account === undefined) continue;

      pending.push({
        posting: postingFor(proposal.row, proposal.key, this.intoAccount ?? 0, account),
        legs: [],
      });

      this.recordSettlement(proposal, settlements);

      if (decided?.remember) {
        learned.push(proposal.row);
        learnedAccounts.push(account);
      }
    }

    try {
      const result = await writePostings(this.deps.app, settings, pending, this.deps.now());

      if (learned.length > 0) {
        const rules = [...settings.importRules];
        for (let index = 0; index < learned.length; index += 1) {
          const row = learned[index];
          const account = learnedAccounts[index];
          if (!row || account === undefined) continue;
          const rule = ruleFrom(row, account);
          if (
            !rules.some((existing) => existing.match.toLowerCase() === rule.match.toLowerCase())
          ) {
            rules.push({ match: rule.match, account: rule.account });
          }
        }
        await this.deps.saveSettings({ ...settings, importRules: rules });
      }

      new Notice(
        t('ledger.imported', {
          count: String(result.written),
          notes: String(result.files.length),
        })
      );

      const stamped = await settleBills(this.deps.app, settings, settlements);
      if (stamped > 0) new Notice(t('ledger.billsPaid', { count: String(stamped) }));

      // After the write, and only after: a statement kept for an import that
      // threw would describe something that did not happen. Failing to keep it
      // is reported and does not undo the postings, which are the part that
      // matters -- an archive is a convenience and the ledger is the record.
      try {
        const rows = acceptedRows(parseStatement(this.fileText, this.profile), this.profile);
        const kept = await archiveStatement(
          this.deps.app,
          settings,
          this.intoAccount ?? 0,
          rows,
          this.fileText
        );
        if (kept) new Notice(t('ledger.statementKept', { path: kept }));
      } catch (error) {
        new Notice(t('ledger.statementNotKept', { reason: String(error) }));
      }

      this.deps.onImported();
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }
}

/** Why a row is being left alone, in the words that say which of the three reasons it is. */
function skipReason(status: 'already-imported' | 'mirrors-existing' | 'already-settled'): string {
  if (status === 'already-imported') return t('ledger.alreadyImported');
  if (status === 'mirrors-existing') return t('ledger.mirrorsExisting');
  return t('ledger.alreadySettled');
}
