/**
 * The ledger view: the chart with live balances, one account's statement, the
 * profit calculation, the balance sheet, and the budget.
 *
 * Five tabs rather than five views because they are five readings of one set of
 * postings, and because the question "is this right?" is answered by moving
 * between them: a total on the chart that looks wrong is chased into the
 * statement that produced it.
 *
 * **Every figure here is computed from the postings on every render.** Nothing
 * is stored and nothing is cached, so a journal line corrected by hand is
 * corrected everywhere the moment the view is refreshed.
 *
 * **Currencies are never summed together.** An account keeps its own currency
 * and a total covers only the accounts that share the view's home currency; the
 * rest are listed beneath it. Nothing fetches a rate.
 */
import {
  accountLabel,
  balanceAt,
  balanceSheet,
  budgetYear,
  budgetYearOf,
  cashOut,
  incomeStatement,
  statement,
  type Account,
  type BudgetMeasureRow,
  type ReportGroup,
} from 'trail-core';
import { t } from '../../lang/I18nManager';
import { readBudgets, readLedger, type Ledger } from '../../ledger/read-ledger';
import {
  readArchive,
  standingOf,
  type ArchiveStanding,
} from '../../ledger/statement-archive-vault';
import { rateFor, toHome } from '../../shared/rates';
import { measureMonth } from '../../ledger/budget-month';
import { PeriodPicker } from '../kit/period-bar';
import { entryPostings } from '../../ledger/edit-posting';
import {
  card,
  emptyState,
  foldableGroup,
  row,
  rowAction,
  section,
  stat,
  statRow,
  tabs,
} from '../kit/elements';
import { documentAction } from '../kit/documents';
import { readBills } from '../../finance/read-finance';
import { day, money } from '../kit/format';
import { NodaView } from './base-view';
import { LEDGER_VIEW_TYPE } from './view-types';

const TABS = ['accounts', 'statement', 'income', 'balance', 'budget'] as const;
type Tab = (typeof TABS)[number];

export class LedgerView extends NodaView {
  private tab: Tab = 'accounts';
  /**
   * Which question the income tab answers: what the period cost, or what left
   * the accounts. Both come from the same postings; see `cashOut`.
   */
  private basis: 'accrual' | 'cash' = 'accrual';
  /** The month, quarter or year on screen. Shared with the finance view. */
  private readonly period = new PeriodPicker(() => this.deps.today());
  private account: number | null = null;
  /**
   * Whether the kept statements with nothing left to answer are listed.
   *
   * Closed by default and not remembered between sessions. The ordinary state
   * of this list is "all of them, all posted", which is a sentence rather than
   * a list, and a list that grows by one every import would push the balances
   * off the screen to say nothing.
   */
  private archiveOpen = false;
  /**
   * The report groups somebody has folded away, by `path`.
   *
   * Collapsed rather than expanded, so the set is empty in the ordinary case
   * and a group is only remembered once it has been acted on. `path` rather
   * than `name`, because two groups in different sections are allowed to share
   * a name and folding one must not fold the other.
   *
   * Not persisted, the same as the tab and the account on screen: this is a
   * reading posture, not a preference, and the next visit starts from the whole
   * report.
   */
  private readonly collapsed = new Set<string>();

  getViewType(): string {
    return LEDGER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return t('ledger.title');
  }

  getIcon(): string {
    return 'book-open';
  }

  protected toolbarActions() {
    return [
      {
        label: t('ledger.importStatement'),
        icon: 'download',
        onClick: () => this.deps.openImportStatement(),
      },
      {
        label: t('ledger.newPosting'),
        icon: 'plus',
        onClick: () => this.deps.openNewPosting(),
      },
      { label: t('ledger.newAccount'), icon: 'wallet', onClick: () => this.deps.openNewAccount() },
      {
        label: t('ledger.accountSetup'),
        icon: 'settings-2',
        onClick: () => this.deps.openAccountSetup(),
      },
    ];
  }

  protected async renderBody(): Promise<void> {
    const ledger = await readLedger(this.deps.app, this.deps.getSettings());

    const body = tabs(
      this.body,
      TABS.map((tab) => t(`ledger.tab.${tab}`)),
      TABS.indexOf(this.tab),
      (index) => {
        this.tab = TABS[index] ?? 'accounts';
        void this.render();
      }
    );

    if (ledger.accounts.length === 0) {
      emptyState(body, t('ledger.noAccounts'));
      return;
    }

    this.renderProblems(body, ledger);

    if (this.tab === 'accounts') await this.renderArchive(body, ledger);
    if (this.tab === 'accounts') this.renderChart(body, ledger);
    if (this.tab === 'statement') this.renderStatement(body, ledger);
    if (this.tab === 'income') this.renderIncome(body, ledger);
    if (this.tab === 'balance') this.renderBalance(body, ledger);
    if (this.tab === 'budget') await this.renderBudget(body, ledger);
  }

  /**
   * The statements the vault keeps, and how much of each the ledger has taken.
   *
   * The file an import came from is kept beside the journal notes it fed, and
   * this is the only place that says so. Its value is the second column: a
   * statement with rows the ledger has not taken is an account whose balance
   * disagrees with the bank by exactly their total, and until this existed the
   * only way to find that out was to add a column up by hand.
   *
   * **Replayed, not remembered.** Nothing was written down about the import, so
   * the count is worked out from the file and the postings every time it is
   * drawn. Answer a row that was left, or correct a posting three years later,
   * and the figure moves by itself.
   *
   * On the accounts tab, because that is the tab somebody is on when a balance
   * looks wrong.
   */
  private async renderArchive(parent: HTMLElement, ledger: Ledger): Promise<void> {
    const settings = this.deps.getSettings();
    const archive = readArchive(this.deps.app, settings);
    if (archive.length === 0) return;

    const standings: ArchiveStanding[] = [];
    for (const archived of archive) {
      standings.push(
        await standingOf(this.deps.app, settings, archived, ledger.accounts, ledger.postings)
      );
    }

    // A file that stopped parsing is asking for attention as much as one with
    // rows left, so it belongs with them rather than among the settled.
    const pending = standings.filter((standing) => standing.rows === 0 || standing.unposted > 0);
    const settled = standings.filter((standing) => standing.rows > 0 && standing.unposted === 0);

    const body = section(parent, t('ledger.archive'));
    for (const standing of pending) this.renderArchiveRow(body, standing, ledger);

    if (settled.length === 0) return;

    // The ordinary case as one line. Everything is still reachable -- the line
    // opens the list -- but a folder of finished statements is a fact, not a
    // list somebody reads.
    row(body, {
      title: t('ledger.archiveSettled', { count: settled.length }),
      trailing: this.archiveOpen ? t('ledger.archiveHide') : t('ledger.archiveShow'),
      trailingTone: 'good',
      icon: 'file-spreadsheet',
      onClick: () => {
        this.archiveOpen = !this.archiveOpen;
        void this.render();
      },
    });

    if (!this.archiveOpen) return;
    for (const standing of settled) this.renderArchiveRow(body, standing, ledger);
  }

  /** One kept statement: which account it went into, what it covers, what is left. */
  private renderArchiveRow(parent: HTMLElement, standing: ArchiveStanding, ledger: Ledger): void {
    const { archived } = standing;
    const account = ledger.accounts.find((candidate) => candidate.number === archived.name.account);

    const clean = standing.rows > 0 && standing.unposted === 0;
    const line = row(parent, {
      title: account ? accountLabel(account) : String(archived.name.account),
      subtitle: `${day(archived.name.from)} - ${day(archived.name.to)}`,
      trailing: unreadableOrCount(standing),
      trailingTone: clean ? 'good' : 'warn',
      icon: this.noteIcon(archived.file, 'file-spreadsheet'),
      onClick: () => void this.deps.openNote(archived.file),
    });

    if (standing.unposted === 0) return;

    // The file is right there and the account is known, so finishing is one
    // click rather than choosing both again from a file picker.
    rowAction(line, t('ledger.archiveFinish'), () => {
      void this.deps.app.vault.cachedRead(archived.file).then((text) => {
        this.deps.openArchivedStatement({
          text,
          name: archived.file.name,
          account: archived.name.account,
        });
      });
    });
  }

  /**
   * Anything wrong with the journals, above whatever tab is showing.
   *
   * On every tab rather than on one of its own, because a figure computed from
   * a journal with an unreadable line in it is a figure quietly missing that
   * line, and the place to say so is beside the figure.
   *
   * Currency mismatches are here too, and they are the quietest of the three: a
   * franc figure written against a euro account parses, balances, and closes.
   * Only the chart knows it is wrong.
   *
   * And a posting that names an order the vault prices differently, which is
   * the only check here that reads a note NODAtrail did not write. The card is
   * still the truth about the money; a difference is a refund, a substitution,
   * or a figure keyed from the wrong line, and all three are worth a look.
   */
  private renderProblems(parent: HTMLElement, ledger: Ledger): void {
    const count =
      ledger.problems.length +
      ledger.unknown.length +
      ledger.mismatches.length +
      ledger.orderDiffers.length +
      ledger.selfPostings.length;
    if (count === 0) return;

    const body = section(parent, t('ledger.problems'));
    for (const { file, problem } of ledger.problems) {
      row(body, {
        title: t(`ledger.problem.${problem.reason}`),
        subtitle: `${file.basename}:${problem.line}  ${problem.raw.trim()}`,
        trailingTone: 'warn',
        icon: 'alert-triangle',
        onClick: () => void this.deps.openNote(file),
      });
    }
    for (const { file, posting, number } of ledger.unknown) {
      row(body, {
        title: t('ledger.problem.unknown-account', { number: String(number) }),
        subtitle: `${file.basename}:${posting.line}  ${posting.text}`,
        trailingTone: 'warn',
        icon: 'help-circle',
        onClick: () => void this.deps.openNote(file),
      });
    }
    for (const { file, mismatch } of ledger.mismatches) {
      const { posting, account, written } = mismatch;
      row(body, {
        title: t('ledger.problem.currency-mismatch', {
          number: String(account.number),
          held: account.currency ?? '',
          written,
        }),
        subtitle: `${file.basename}:${posting.line}  ${money(posting.amount, written)}  ${posting.text}`,
        trailingTone: 'warn',
        icon: 'coins',
        onClick: () => void this.deps.openNote(file),
      });
    }
    for (const { file, posting } of ledger.selfPostings) {
      row(body, {
        title: t('ledger.problem.self-posting', { number: String(posting.debit ?? '') }),
        subtitle: `${file.basename}:${posting.line}  ${money(posting.amount, posting.currency)}  ${posting.text}`,
        trailingTone: 'warn',
        icon: 'circle-slash',
        onClick: () => void this.deps.openNote(file),
      });
    }
    for (const { file, posting, match } of ledger.orderDiffers) {
      row(body, {
        title: t('ledger.problem.order-differs', { order: match.order.title }),
        subtitle: `${file.basename}:${posting.line}  ${t('ledger.orderDiffers', {
          order: match.order.title,
          charged: money(posting.amount, posting.currency),
          ordered: money(match.order.price ?? 0, match.order.priceCurrency),
        })}`,
        trailingTone: 'warn',
        icon: 'package-search',
        onClick: () => void this.deps.openNote(file),
      });
    }
  }

  // The chart ------------------------------------------------------------

  /**
   * How a figure in an account's own currency reaches the reporting currency.
   *
   * Handed to every report rather than applied to the totals afterwards. A
   * total assembled from unconverted figures is wrong at every level of the
   * tree, and no correction at the top can put the group subtotals right.
   * Null for a currency with no rate, which leaves that account out of the
   * totals and counted as missing.
   */
  private converter() {
    const settings = this.deps.getSettings();
    return (amount: number, currency: string | null): number | null =>
      toHome(amount, currency, settings);
  }

  private renderChart(parent: HTMLElement, ledger: Ledger): void {
    this.renderPeriodBar(parent);

    const convert = this.converter();
    const { from, to } = this.range();
    // Empty rows hidden here as everywhere else: a chart of eighty accounts of
    // which thirty have never been touched is a page somebody scrolls past
    // rather than reads, and the account still exists whether or not a report
    // about a period mentions it.
    const options = { convert, hideEmpty: true };
    const sheet = balanceSheet(ledger.accounts, ledger.postings, to, options);
    const result = incomeStatement(ledger.accounts, ledger.postings, from, to, options);

    const strip = statRow(parent);
    stat(strip, t('ledger.assets'), this.money(sheet.assetTotal));
    stat(strip, t('ledger.liabilities'), this.money(sheet.liabilityTotal));
    stat(strip, t('ledger.net'), this.money(sheet.net), sheet.net < 0 ? 'warn' : 'good');

    this.renderSection(parent, t('ledger.assets'), sheet.assets, ledger);
    this.renderSection(parent, t('ledger.liabilities'), sheet.liabilities, ledger);
    this.renderSection(
      parent,
      `${t('ledger.income')} (${this.periodLabel()})`,
      result.income,
      ledger
    );
    this.renderSection(
      parent,
      `${t('ledger.expense')} (${this.periodLabel()})`,
      result.expense,
      ledger
    );
  }

  /** One section of the report tree, groups and all. */
  private renderSection(
    parent: HTMLElement,
    title: string,
    group: ReportGroup,
    ledger: Ledger
  ): void {
    const body = section(parent, `${title}: ${this.money(group.total)}`);
    this.renderGroup(body, group, ledger, 0);
  }

  private renderGroup(
    parent: HTMLElement,
    group: ReportGroup,
    ledger: Ledger,
    depth: number
  ): void {
    const settings = this.deps.getSettings();
    const home = settings.homeCurrency;

    for (const entry of group.accounts) {
      const foreign = entry.account.currency !== null && entry.account.currency !== home;
      const rate = foreign ? rateFor(entry.account.currency, settings) : null;

      const line = row(parent, {
        title: accountLabel(entry.account),
        // The column stays in one currency so it can be added by eye, and what
        // the account actually holds is said beside it rather than instead.
        subtitle: !foreign
          ? (entry.account.currency ?? '')
          : entry.inTotal
            ? t('ledger.heldAt', {
                held: money(entry.stated, entry.account.currency),
                rate: displayRate(rate),
              })
            : t('ledger.heldNoRate', {
                held: money(entry.stated, entry.account.currency),
                currency: home,
              }),
        trailing: entry.inTotal
          ? money(entry.amount, home)
          : money(entry.stated, entry.account.currency),
        trailingTone: entry.inTotal ? undefined : 'warn',
        onClick: () => this.openAccount(entry.account, ledger),
      });
      line.addClass(depth > 0 ? 'nod-ledger-nested' : 'nod-ledger-flat');
    }

    for (const child of group.children) {
      const folded = this.collapsed.has(child.path);

      // **The total is drawn either way**, which is the whole point: a folded
      // group still says what it comes to. `foldableGroup` draws the header
      // unconditionally; only what is beneath it is guarded here.
      const wrapper = foldableGroup(parent, {
        name: child.name,
        trailing: this.money(child.total),
        folded,
        onToggle: () => {
          if (folded) this.collapsed.delete(child.path);
          else this.collapsed.add(child.path);
          void this.render();
        },
      });

      if (!folded) this.renderGroup(wrapper, child, ledger, depth + 1);
    }
  }

  // One account ----------------------------------------------------------

  private openAccount(account: Account, ledger: Ledger): void {
    void ledger;
    this.account = account.number;
    this.tab = 'statement';
    void this.render();
  }

  private renderStatement(parent: HTMLElement, ledger: Ledger): void {
    const choices = ledger.accounts;
    const chosen =
      choices.find((account) => account.number === this.account) ??
      choices.find((account) => account.kind === 'asset') ??
      choices[0];
    if (!chosen) return;

    this.renderAccountPicker(parent, choices, chosen);

    const rows = statement(ledger.postings, chosen);
    const strip = statRow(parent);
    stat(strip, t('ledger.opening'), money(chosen.opening, chosen.currency));
    stat(
      strip,
      t('ledger.balance'),
      money(balanceAt(ledger.postings, chosen, null), chosen.currency)
    );
    stat(strip, t('ledger.postings'), String(rows.length));

    if (rows.length === 0) {
      emptyState(parent, t('ledger.noPostings'));
      return;
    }

    // Which invoice a posting settles is already written on the line, in the
    // reference column the mark-paid dialog fills with the note's title. That
    // is the whole route to the paper: the posting names the invoice and the
    // invoice names the PDF. Built once per draw rather than looked up per row.
    const documents = this.documentsByReference();

    const body = section(parent, accountLabel(chosen));
    // Newest first, which is the order a bank statement arrives in and
    // therefore the order somebody is comparing against.
    for (const entry of [...rows].reverse()) {
      const other = ledger.byNumber.get(entry.other ?? -1);

      // The statement is where a wrong line is noticed, so it is where the
      // correction belongs. The journal the posting came from is found by
      // matching the posting itself: a view holds no file.
      const journal = ledger.journals.find((note) => note.postings.includes(entry.posting));

      card(body, {
        name: entry.posting.text || t('ledger.noText'),
        id: entry.posting.reference,
        // Movement and balance were one trailing string separated by spaces,
        // which read as one number twice as often as it read as two. Named
        // separately, the running balance stops looking like part of the
        // amount.
        fields: [
          { label: t('ledger.postingDate'), value: day(entry.posting.date), icon: 'calendar' },
          {
            label: t('ledger.bookedTo'),
            value: other ? accountLabel(other) : t('ledger.unassigned'),
            icon: 'book-open',
            tone: other ? undefined : 'warn',
          },
          {
            label: t('ledger.movement'),
            value: money(entry.change, chosen.currency),
            icon: 'arrow-right-left',
            tone: entry.change < 0 ? 'warn' : 'good',
          },
          {
            label: t('ledger.balance'),
            value: money(entry.balance, chosen.currency),
            icon: 'wallet',
          },
        ],
        actions: [
          ...documentAction(
            entry.posting.reference ? documents.get(entry.posting.reference) : null,
            this.deps.openDocument
          ),
          ...(journal
            ? [
                {
                  icon: 'pencil',
                  label: t('common.edit'),
                  onClick: () =>
                    // The whole entry, so editing one leg of a split opens the split.
                    this.deps.openEditPosting(
                      journal.file,
                      entryPostings(journal.postings, entry.posting)
                    ),
                },
              ]
            : []),
        ],
      });
    }
  }

  /**
   * Invoice title to the document it holds, for the postings that settle one.
   *
   * Only the invoices with paper behind them are in the map, so a lookup that
   * misses is the same answer as a note with no document: no button.
   *
   * Titles rather than paths, because the reference column holds the note's
   * title -- which is what `MarkPaidModal` writes into it and what somebody
   * typing a reference by hand would recognise.
   */
  private documentsByReference(): Map<string, string[]> {
    const found = new Map<string, string[]>();
    for (const bill of readBills(this.deps.app, this.deps.getSettings())) {
      if (bill.documentPaths.length > 0) found.set(bill.title, bill.documentPaths);
    }
    return found;
  }

  private renderAccountPicker(
    parent: HTMLElement,
    choices: readonly Account[],
    chosen: Account
  ): void {
    const bar = parent.createDiv({ cls: 'nod-ledger-picker' });
    const select = bar.createEl('select');
    for (const account of choices) {
      const option = select.createEl('option', {
        value: String(account.number),
        text: accountLabel(account),
      });
      if (account.number === chosen.number) option.selected = true;
    }
    select.addEventListener('change', () => {
      this.account = Number(select.value);
      void this.render();
    });
  }

  // The two reports ------------------------------------------------------

  private renderIncome(parent: HTMLElement, ledger: Ledger): void {
    this.renderPeriodBar(parent);
    this.renderBasisBar(parent);
    if (this.basis === 'cash') {
      this.renderCashOut(parent, ledger);
      return;
    }

    const { from, to } = this.range();
    const report = incomeStatement(ledger.accounts, ledger.postings, from, to, {
      hideEmpty: true,
      convert: this.converter(),
    });

    const strip = statRow(parent);
    stat(strip, t('ledger.income'), this.money(report.incomeTotal));
    stat(strip, t('ledger.expense'), this.money(report.expenseTotal));
    stat(strip, t('ledger.result'), this.money(report.result), report.result < 0 ? 'warn' : 'good');

    if (report.incomeTotal === 0 && report.expenseTotal === 0) {
      emptyState(parent, t('ledger.nothingInPeriod'));
      return;
    }

    this.renderSection(parent, t('ledger.income'), report.income, ledger);
    this.renderSection(parent, t('ledger.expense'), report.expense, ledger);
  }

  /** The two questions the period can be asked, side by side. */
  private renderBasisBar(parent: HTMLElement): void {
    const bar = parent.createDiv({ cls: 'nod-ledger-picker' });
    const select = bar.createEl('select');
    for (const [value, label] of [
      ['accrual', t('ledger.basisAccrual')],
      ['cash', t('ledger.basisCash')],
    ] as const) {
      const option = select.createEl('option', { value, text: label });
      if (value === this.basis) option.selected = true;
    }
    select.addEventListener('change', () => {
      this.basis = select.value === 'cash' ? 'cash' : 'accrual';
      void this.render();
    });
    bar.createSpan({
      cls: 'nod-ledger-hint',
      text: this.basis === 'cash' ? t('ledger.basisCashHint') : t('ledger.basisAccrualHint'),
    });
  }

  /**
   * What actually left the accounts in the period.
   *
   * Two sections rather than one, because money paid against a card or a tax
   * debt left the household just as surely as money paid to a shop, and
   * hiding it under an expense account it never touched would be a fiction.
   */
  private renderCashOut(parent: HTMLElement, ledger: Ledger): void {
    const { from, to } = this.range();
    const report = cashOut(ledger.accounts, ledger.postings, from, to, {
      hideEmpty: true,
      convert: this.converter(),
    });

    const strip = statRow(parent);
    stat(strip, t('ledger.expense'), this.money(report.expenseTotal));
    stat(strip, t('ledger.basisSettled'), this.money(report.settledTotal));
    stat(strip, t('ledger.basisOut'), this.money(report.total), 'warn');

    if (report.total === 0) {
      emptyState(parent, t('ledger.nothingInPeriod'));
      return;
    }

    this.renderSection(parent, t('ledger.expense'), report.expense, ledger);
    this.renderSection(parent, t('ledger.basisSettled'), report.settled, ledger);
  }

  /**
   * What was held and owed at the end of the period on screen.
   *
   * **As of the last day of the period, not as of now.** A balance sheet is a
   * statement about a day, and the day worth asking about is the one the rest
   * of the view is showing: an income statement for January beside a balance
   * sheet including March is two answers to two different questions, and the
   * pair cannot be checked against anything.
   *
   * The period bar is rendered here rather than only on the income tab,
   * because a sheet that can only ever be asked about today is a sheet nobody
   * can check a closed month against once a later month is on the books.
   */
  private renderBalance(parent: HTMLElement, ledger: Ledger): void {
    this.renderPeriodBar(parent);

    const sheet = balanceSheet(ledger.accounts, ledger.postings, this.range().to, {
      convert: this.converter(),
      // An account holding nothing on the day is not part of what is held.
      hideEmpty: true,
    });

    const strip = statRow(parent);
    stat(strip, t('ledger.assets'), this.money(sheet.assetTotal));
    stat(strip, t('ledger.liabilities'), this.money(sheet.liabilityTotal));
    stat(strip, t('ledger.net'), this.money(sheet.net), sheet.net < 0 ? 'warn' : 'good');

    // The day is named, because a balance sheet that does not say which day it
    // is about is a figure nobody can check against anything.
    this.renderSection(parent, `${t('ledger.assets')} (${sheet.on ?? ''})`, sheet.assets, ledger);
    this.renderSection(
      parent,
      `${t('ledger.liabilities')} (${sheet.on ?? ''})`,
      sheet.liabilities,
      ledger
    );
  }

  // The budget -----------------------------------------------------------

  /**
   * The year planned, and the month on screen measured against it.
   *
   * Both, because they answer different questions and somebody moves between
   * them constantly: the year is where a figure is decided and the month is
   * where it is judged. The twelve monthly figures come from each line's
   * rhythm, so a premium falling once in March is planned once and appears in
   * March alone.
   */
  private async renderBudget(parent: HTMLElement, ledger: Ledger): Promise<void> {
    const settings = this.deps.getSettings();
    const budgets = readBudgets(this.deps.app, settings);
    const year = this.periodDate().getFullYear();
    const budget = budgets.find((note) => budgetYearOf(note) === year);

    this.renderPeriodBar(parent);

    if (!budget) {
      // The empty state used to be the whole tab: it named the missing year and
      // offered nothing, and the only way to make a budget was the command
      // palette. A tab that says what is absent has to be the place the absent
      // thing is made, or it is a sign pointing at a door nobody can find.
      const body = section(parent, t('finance.budget'), {
        label: t('commands.newBudget'),
        icon: 'plus',
        onClick: () => this.deps.openNewBudget(),
      });
      emptyState(body, t('ledger.noBudgetForYear', { year: String(year) }));
      return;
    }

    const currency = budget.currency ?? settings.homeCurrency;
    const plan = budgetYear(budget.lines);

    const measured = await measureMonth(this.deps.app, settings, this.periodDate());
    if (measured) {
      const measure = measured.measure;
      const left = measure.plannedTotal - measure.actualTotal;
      const strip = statRow(parent);
      stat(strip, t('finance.planned'), money(measure.plannedTotal, currency));
      stat(strip, t('finance.actual'), money(measure.actualTotal, currency));
      stat(strip, t('finance.variance'), money(left, currency), left < 0 ? 'warn' : 'good');

      const month = section(parent, `${t('finance.budget')}: ${this.periodLabel()}`, {
        label: t('common.edit'),
        icon: 'pencil',
        onClick: () => this.deps.openEditBudgetLines(budget),
      });
      for (const line of measure.rows) {
        if (line.planned === 0 && line.actual === 0) continue;
        this.renderBudgetRow(month, line, ledger, currency);
      }

      if (measure.unbudgeted.length > 0) {
        // Shown rather than hidden: an account with spending on it and no plan
        // is the most interesting row on the page.
        const unbudgeted = section(parent, t('finance.unbudgeted'));
        for (const line of measure.unbudgeted) {
          this.renderBudgetRow(unbudgeted, line, ledger, currency);
        }
      }
    }

    const overview = section(parent, `${t('ledger.yearPlan')}: ${budget.title}`);
    for (const entry of plan.rows) {
      const account = ledger.byNumber.get(entry.line.account);
      row(overview, {
        title: account ? accountLabel(account) : String(entry.line.account),
        subtitle: `${t(`cadence.${entry.line.rhythm}`)}  ${money(entry.line.amount, currency)}`,
        trailing: money(entry.total, currency),
      });
    }
    row(overview, {
      title: t('ledger.yearTotal'),
      trailing: money(plan.total, currency),
    });
  }

  private renderBudgetRow(
    parent: HTMLElement,
    line: BudgetMeasureRow,
    ledger: Ledger,
    currency: string
  ): void {
    const account = line.account ?? ledger.byNumber.get(line.number) ?? null;
    row(parent, {
      title: account ? accountLabel(account) : String(line.number),
      subtitle: `${money(line.actual, currency)} / ${money(line.planned, currency)}`,
      trailing: money(line.left, currency),
      trailingTone: line.left < 0 ? 'warn' : 'good',
    });
  }

  // The period -----------------------------------------------------------

  private renderPeriodBar(parent: HTMLElement): void {
    this.period.render(parent, () => void this.render());
  }

  private periodLabel(): string {
    return this.period.label();
  }

  private periodDate(): Date {
    return this.period.date();
  }

  private range(): { from: string; to: string } {
    return this.period.range();
  }

  /** A figure in the home currency, which is what every total here is in. */
  private money(amount: number): string {
    return money(amount, this.deps.getSettings().homeCurrency);
  }
}

/**
 * A rate as it reads, rather than as a float prints.
 *
 * `1/1.26` is stored as 0.7936507936507936, and the settings row shows that in
 * full on purpose: it is the number the arithmetic uses and rounding it there
 * would hide a wrong rate. Here it is a subtitle beside a balance, where the
 * last eight digits say nothing the first eight do not and a line of them
 * reads as a defect rather than as precision. Display only -- the figure in
 * the column beside it is computed from the stored rate.
 */
function displayRate(rate: number | null): string {
  if (rate === null) return '';
  return String(Number(rate.toFixed(8)));
}

/**
 * What the archive's second column says.
 *
 * Three states rather than a number and a blank: a file that stopped parsing
 * has to read differently from one with nothing left to post, or a statement
 * this plugin can no longer read looks like a statement that is finished.
 */
function unreadableOrCount(standing: { rows: number; unposted: number }): string {
  if (standing.rows === 0) return t('ledger.archiveUnreadable');
  if (standing.unposted === 0) return t('ledger.archiveAllPosted');
  return t('ledger.archiveUnposted', { count: standing.unposted });
}
