/**
 * The finance view: purchases, bills and recurring costs, as three tabs.
 *
 * Three rather than four: the budget left for the ledger view when it became a
 * plan against accounts measured by postings. What is here is the paperwork,
 * and what is there is the money.
 *
 * **Currencies are never summed together.** Every total here is per currency,
 * and where a period holds two the view shows two figures side by side. Nothing
 * fetches a rate.
 */
import {
  billStatus,
  isOutstanding,
  occurrencesBetween,
  purchaseStatusOf,
  sumByCurrency,
} from 'trail-core';
import type { BillRecord, BillStatus } from 'trail-core';
import type { TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { readFinanceBoard, type FinanceBoard } from '../../finance/read-finance';
import { purchaseAmount } from '../../finance/spend';
import { categoryLabel } from '../../shared/categories';
import { card, emptyState, section, stat, statRow, tabs, type CardField } from '../kit/elements';
import { documentAction } from '../kit/documents';
import { day, money } from '../kit/format';
import { PeriodPicker } from '../kit/period-bar';
import { NodaView } from './base-view';
import { FINANCE_VIEW_TYPE } from './view-types';

const TABS = ['purchases', 'bills', 'recurring'] as const;
type Tab = (typeof TABS)[number];

/**
 * The day an invoice belongs to.
 *
 * Its issue date, which is the date the note is named and filed under. A bill
 * with none falls back to when it is due, because a bill has to be somewhere
 * and the alternative is one that no period contains.
 */
function billDay(bill: { issueDate: string | null; dueDate: string | null }): string | null {
  return bill.issueDate ?? bill.dueDate;
}

export class FinanceView extends NodaView {
  private tab: Tab = 'bills';
  /**
   * The month, quarter or year on screen. The same control the ledger has, and
   * the same one across the three tabs: somebody looking at February's invoices
   * and then at February's standing costs is asking one question.
   */
  private readonly period = new PeriodPicker(() => this.deps.today());

  getViewType(): string {
    return FINANCE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return t('finance.title');
  }

  getIcon(): string {
    return 'wallet';
  }

  protected toolbarActions() {
    return [
      {
        label: t('commands.newPurchase'),
        icon: 'shopping-bag',
        onClick: () => this.deps.openNewPurchase(),
      },
      { label: t('commands.newBill'), icon: 'receipt', onClick: () => this.deps.openNewBill() },
      {
        label: t('commands.newRecurring'),
        icon: 'repeat',
        onClick: () => this.deps.openNewRecurring(),
      },
    ];
  }

  protected renderBody(): Promise<void> {
    const settings = this.deps.getSettings();
    const finance = readFinanceBoard(this.deps.app, settings);

    const body = tabs(
      this.body,
      TABS.map((tab) => t(`finance.${tab}`)),
      TABS.indexOf(this.tab),
      (index) => {
        this.tab = TABS[index] ?? 'bills';
        void this.render();
      }
    );

    this.period.render(body, () => void this.render());

    if (this.tab === 'purchases') this.renderPurchases(body, finance);
    if (this.tab === 'bills') this.renderBills(body, finance);
    if (this.tab === 'recurring') this.renderRecurring(body, finance);

    return Promise.resolve();
  }

  private renderPurchases(parent: HTMLElement, finance: FinanceBoard): void {
    if (finance.purchases.length === 0) {
      emptyState(parent, t('finance.noPurchases'));
      return;
    }

    const sorted = [...finance.purchases]
      .filter((purchase) => this.period.holds(purchase.date))
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

    if (sorted.length === 0) {
      emptyState(parent, t('finance.nothingInPeriod'));
      return;
    }

    const body = section(parent, `${t('finance.purchases')} (${this.period.label()})`);

    for (const purchase of sorted) {
      const fields: CardField[] = [];
      if (purchase.date) {
        fields.push({ label: t('finance.orderDate'), value: day(purchase.date), icon: 'calendar' });
      }
      // Only once there is one. An undelivered order saying "Lieferdatum --"
      // would be a field whose whole content is that it has no content.
      if (purchase.deliveryDate) {
        fields.push({
          label: t('finance.deliveryDate'),
          value: day(purchase.deliveryDate),
          icon: 'package',
        });
      }
      fields.push({
        label: t('finance.amount'),
        value: money(purchaseAmount(purchase), purchase.currency),
        icon: 'wallet',
      });
      const category = categoryLabel(purchase.category);
      if (category) fields.push({ label: t('finance.category'), value: category, icon: 'tag' });

      card(body, {
        name: purchase.companyTitle ?? purchase.title,
        id: purchase.reference,
        fields,
        // Derived rather than read: a purchase that recorded two boxes against
        // five lines is partly delivered whatever its `status:` still says, and
        // the consignments are the thing that knows. `delivered` shows nothing,
        // as it always did -- a card saying a finished purchase is finished is
        // a chip nobody reads.
        chips: (() => {
          const state = purchaseStatusOf(purchase.status, purchase.items, purchase.deliveries);
          if (state === 'delivered') return [];
          return [{ text: t(`status.purchase.${state}`), tone: 'muted' as const }];
        })(),
        actions: [
          ...documentAction(purchase.documentPaths, this.deps.openDocument),
          // The lines have an editor of their own: they are the one property
          // Obsidian's own property editor cannot handle at all.
          {
            icon: 'list',
            label: t('finance.items'),
            onClick: () => this.deps.openEditPurchaseItems(purchase),
          },
          {
            icon: 'pencil',
            label: t('common.edit'),
            onClick: () => this.deps.openEditPurchase(purchase),
          },
        ],
        onClick: () => void this.deps.openNote(purchase.file),
      });
    }
  }

  /**
   * The invoices, scoped to the period, and everything still owed from outside it.
   *
   * **A period filter must never hide a bill somebody owes.** The whole reason
   * this tab is opened is to find out what is outstanding, and an unpaid
   * January invoice is at its most important in March. So the period scopes
   * what is *browsed* and the second section catches what the scoping would
   * otherwise have swallowed, on either side of the window.
   *
   * The figure at the top is the total owed, always, and is deliberately not
   * scoped: a number that shrank because somebody changed the month would be a
   * number nobody could act on.
   */
  private renderBills(parent: HTMLElement, finance: FinanceBoard): void {
    const settings = this.deps.getSettings();
    const today = this.deps.today();

    if (finance.bills.length === 0) {
      emptyState(parent, t('finance.noBills'));
      return;
    }

    const withStatus = finance.bills
      .map((bill) => ({ bill, status: billStatus(bill, today, settings.billDueSoonDays) }))
      // Outstanding first, then by due date. What is owed is the question this
      // tab is opened to answer, and what is paid is the archive of it.
      .sort((a, b) => {
        const owed = Number(isOutstanding(b.status)) - Number(isOutstanding(a.status));
        return owed !== 0 ? owed : (a.bill.dueDate ?? '').localeCompare(b.bill.dueDate ?? '');
      });

    const outstanding = withStatus.filter(({ status }) => isOutstanding(status));

    // **Never summed together.** What the household owes and what it is owed
    // are two figures, and one net number would hide a month with both a large
    // bill and a large invoice behind a small difference. The same rule this
    // view already keeps for two currencies.
    const strip = statRow(parent);
    this.renderOwedStat(strip, outstanding, 'incoming', settings.homeCurrency);
    this.renderOwedStat(strip, outstanding, 'outgoing', settings.homeCurrency);

    const inPeriod = withStatus.filter(({ bill }) => this.period.holds(billDay(bill)));
    const elsewhere = outstanding.filter(({ bill }) => !this.period.holds(billDay(bill)));

    if (inPeriod.length === 0) {
      emptyState(parent, t('finance.nothingInPeriod'));
    } else {
      this.renderBillSection(
        parent,
        inPeriod,
        'incoming',
        `${t('finance.bills')} (${this.period.label()})`
      );
      this.renderBillSection(
        parent,
        inPeriod,
        'outgoing',
        `${t('finance.salesInvoices')} (${this.period.label()})`
      );
    }

    if (elsewhere.length > 0) {
      const carried = section(parent, t('finance.outstandingElsewhere'));
      for (const entry of elsewhere) this.renderBillRow(carried, entry);
    }
  }

  /** One section per direction, and none at all for a direction with nothing in it. */
  private renderBillSection(
    parent: HTMLElement,
    entries: { bill: BillRecord<TFile>; status: BillStatus }[],
    direction: 'incoming' | 'outgoing',
    heading: string
  ): void {
    const matching = entries.filter(({ bill }) => bill.direction === direction);
    if (matching.length === 0) return;

    const body = section(parent, heading);
    for (const entry of matching) this.renderBillRow(body, entry);
  }

  /**
   * What is owed in one direction, per currency.
   *
   * The outgoing tile is drawn only when there is something in it: a vault that
   * never sends an invoice should not carry a permanent zero for a feature it
   * does not use.
   */
  private renderOwedStat(
    strip: HTMLElement,
    outstanding: { bill: BillRecord<TFile> }[],
    direction: 'incoming' | 'outgoing',
    home: string
  ): void {
    const bills = outstanding
      .filter(({ bill }) => bill.direction === direction)
      .map(({ bill }) => bill);
    const totals = sumByCurrency(bills, home);
    const label = direction === 'outgoing' ? t('finance.owedToUs') : t('finance.outstanding');

    if (totals.size === 0) {
      // Incoming keeps its dash, because "nothing outstanding" is an answer
      // somebody opened this tab for.
      if (direction === 'incoming') stat(strip, label, '-', 'good');
      return;
    }
    for (const [code, amount] of totals) {
      stat(strip, label, money(amount, code), direction === 'outgoing' ? 'good' : 'warn');
    }
  }

  /**
   * One invoice, as what it says rather than as what it is filed under.
   *
   * The file name is not shown. `20260204_ORELLFUESSLI_8779324681` is a sorting
   * key with the company and the reference already inside it, and printing it
   * as the title meant the two figures that matter -- what is owed and by when
   * -- were the smallest text on the line. The company is the title now and the
   * reference is beside it, both taken from the note's own properties.
   */
  private renderBillRow(
    parent: HTMLElement,
    { bill, status }: { bill: BillRecord<TFile>; status: BillStatus }
  ): void {
    const fields: CardField[] = [];
    if (bill.issueDate) {
      fields.push({ label: t('finance.issueDate'), value: day(bill.issueDate), icon: 'calendar' });
    }
    if (bill.dueDate) {
      fields.push({
        label: t('finance.dueDate'),
        value: day(bill.dueDate),
        icon: 'calendar-clock',
        tone: status === 'overdue' ? 'warn' : undefined,
      });
    }
    fields.push({
      label: t('finance.amount'),
      value: money(bill.amount, bill.currency),
      icon: 'wallet',
      tone: status === 'overdue' ? 'warn' : status === 'paid' ? 'good' : undefined,
    });
    if (bill.paidDate) {
      fields.push({ label: t('finance.paidDate'), value: day(bill.paidDate), icon: 'check' });
    }

    card(parent, {
      // A bill with no company on it still has to say something, and the note's
      // title is the only other thing that names it.
      name: bill.companyTitle ?? bill.title,
      id: bill.reference,
      fields,
      chips: [{ text: t(`status.bill.${status}`), tone: status === 'overdue' ? 'warn' : 'muted' }],
      // Two different edits, and they were sharing one button. Marking paid is
      // the commonest thing that happens to a bill; correcting the figure read
      // off the PDF is the second, and it had nowhere to happen at all.
      actions: [
        ...documentAction(bill.documentPaths, this.deps.openDocument),
        {
          icon: 'check-check',
          label: t('finance.markPaid'),
          onClick: () => this.deps.openMarkPaid(bill),
        },
        { icon: 'pencil', label: t('common.edit'), onClick: () => this.deps.openEditBill(bill) },
      ],
      onClick: () => void this.deps.openNote(bill.file),
    });
  }

  private renderRecurring(parent: HTMLElement, finance: FinanceBoard): void {
    if (finance.recurring.length === 0) {
      emptyState(parent, t('finance.noRecurring'));
      return;
    }

    // The count follows the period rather than always naming a year, which is
    // what makes it answer "how often does this fall in the month I am looking
    // at" rather than one question nobody asked.
    const range = this.period.range();
    const body = section(parent, `${t('finance.recurring')} (${this.period.label()})`);

    for (const cost of finance.recurring) {
      const occurrences = occurrencesBetween(cost, range.from, range.to);

      const fields: CardField[] = [
        { label: t('finance.cadence'), value: t(`cadence.${cost.cadence}`), icon: 'repeat' },
        { label: t('finance.amount'), value: money(cost.amount, cost.currency), icon: 'wallet' },
      ];
      if (cost.startDate) {
        fields.push({
          label: t('finance.startDate'),
          value: day(cost.startDate),
          icon: 'calendar',
        });
      }
      // An arrangement that has been cancelled from a date is a different thing
      // from one that runs on, and the date is the only place that says so.
      if (cost.endDate) {
        fields.push({
          label: t('finance.endDate'),
          value: day(cost.endDate),
          icon: 'calendar-clock',
        });
      }
      const category = categoryLabel(cost.category);
      if (category) fields.push({ label: t('finance.category'), value: category, icon: 'tag' });

      const chips: { text: string; tone?: 'warn' | 'good' | 'muted' }[] = [
        { text: t('finance.occurrences', { count: occurrences.length }), tone: 'muted' },
      ];
      if (cost.status !== 'active') {
        chips.push({ text: t(`status.recurring.${cost.status}`), tone: 'muted' });
      }

      card(body, {
        name: cost.companyTitle ?? cost.title,
        fields,
        chips,
        actions: [
          ...documentAction(cost.documentPaths, this.deps.openDocument),
          {
            icon: 'pencil',
            label: t('common.edit'),
            onClick: () => this.deps.openEditRecurring(cost),
          },
        ],
        onClick: () => void this.deps.openNote(cost.file),
      });
    }
  }
}
