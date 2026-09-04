/**
 * The four money creation forms.
 *
 * The company and the area are dropdowns over what the vault actually holds, so
 * a form cannot produce a link that resolves to nothing. The category is a
 * dropdown over the configured list, which is a default rather than a boundary:
 * a note carrying an id the list does not know is still read, and shown exactly
 * as written.
 *
 * **Nothing here computes a total.** A purchase's amount is what somebody types,
 * because the note is a record of what was charged. What the lines add up to is
 * shown beside it by the views and compared by the health check.
 */
import { App, Notice, Setting, TFile } from 'obsidian';
import {
  type BillLine,
  companyDefaultsToLearn,
  companyHasRole,
  hasCompanyDefaults,
  inheritFromCompany,
  inheritFromRecurring,
  type ParsedBill,
  periodTitle,
  RECURRING_CADENCES,
  RECURRING_STATUSES,
  PURCHASE_STATUSES,
  type PurchaseStatus,
  type RecurringCadence,
  type CompanyDefaults,
  type RecurringRecord,
  type RecurringStatus,
} from 'trail-core';
import { t } from '../../lang/I18nManager';
import { configuredCategories, categoryLabel } from '../../shared/categories';
import { splitList } from '../../settings/defaults';
import type { NODAtrailSettings } from '../../settings/types';
import { readAreas } from '../../para/read-para';
import {
  createBill,
  createBudget,
  createPurchase,
  createRecurring,
} from '../../finance/write-finance';
import { FormModal } from './form-modal';
import { documentFields, type DocumentChoice } from './document-field';
import { dateOf } from '../../finance/paths';
import { noteTitle } from '../../finance/finance-title';
import { accountChoices, accountValue } from '../../ledger/account-field';
import { BILL_DIRECTIONS, type BillDirection } from 'trail-core';
import { readAccounts } from '../../ledger/read-ledger';
import { readRecurring } from '../../finance/read-finance';
import { readOrders } from '../../finance/read-orders';
import { SplitLegsModal } from '../../ledger/split-modal';
import { fileDocumentChoices } from '../../finance/file-document';
import { NewCompanyModal } from '../../crm/new-company-modal';
import { readCrmCounterparties } from '../../crm/read-crm-board';
import { readCompanyDefaults, rememberCompanyDefaults } from '../../crm/company-defaults';
import type { CreateDeps } from './new-para-modals';

/**
 * Who a money note may name: the Company and Person notes, which all three
 * plugins share and none owns.
 *
 * **Both kinds in one list, under one property.** A bill's `company` holds a
 * wikilink and nothing has ever checked which folder it resolves into, so a
 * person who invoices the household needs no new property and no migration --
 * only a picker that offers them. The property keeps its name, which is a
 * setting a vault can rename without any code changing.
 *
 * `role` narrows the list to those carrying it, persons on the same terms as
 * companies. **Blank keeps everyone**, which is `companyHasRole`'s own rule and
 * the reason an unconfigured vault sees no change: a filter that emptied the
 * dropdown the day it shipped would be a filter nobody could use.
 */
function counterpartyTitles(app: App, settings: NODAtrailSettings, role: string): string[] {
  return readCrmCounterparties(app, settings)
    .filter((record) => companyHasRole(record.roles, role))
    .map((record) => record.title);
}

/**
 * The companies to offer: what the vault holds, plus what this form just made.
 *
 * **A note created a moment ago is not in the metadata cache yet.** Obsidian
 * indexes asynchronously, so redrawing the form straight after writing the note
 * asks a cache that has not heard about it and gets the old list back. Waiting
 * for the cache would make the dropdown depend on how fast a disk is.
 *
 * So the form remembers what it created and offers it regardless. The cache
 * catches up in its own time and the union quietly stops mattering.
 */
function offeredCompanies(
  app: App,
  settings: NODAtrailSettings,
  made: readonly string[],
  role: string
): string[] {
  const titles = new Set(counterpartyTitles(app, settings, role));
  // The just-made ones skip the role filter as well as the cache. The form
  // seeds the role into the note it creates, so it belongs in the list; the
  // cache simply has not read it back yet, and dropping it here would make a
  // company vanish the instant somebody added it.
  for (const title of made) titles.add(title);
  return [...titles].sort((a, b) => a.localeCompare(b));
}

function optional(titles: readonly string[]): [string, string][] {
  return [['', t('common.none')], ...titles.map((title): [string, string] => [title, title])];
}

function categoryChoices(settings: NODAtrailSettings): [string, string][] {
  return [
    ['', t('common.none')],
    ...configuredCategories(settings.expenseCategories).map((id): [string, string] => [
      id,
      categoryLabel(id),
    ]),
  ];
}

function currencyChoices(settings: NODAtrailSettings): [string, string][] {
  const codes = splitList(settings.currencyOptions);
  const all = codes.includes(settings.homeCurrency) ? codes : [settings.homeCurrency, ...codes];
  return all.map((code): [string, string] => [code, code]);
}

/** Everything the three transaction forms share, so each one only writes its own middle. */
abstract class MoneyModal extends FormModal {
  protected companyTitle = '';
  /** Companies made from this form, which the metadata cache has not indexed yet. */
  private readonly createdCompanies: string[] = [];

  /**
   * The role a company must carry to be offered here, blank for everyone.
   *
   * A hook rather than a setting read in place, because only the invoice form
   * has a direction to narrow by: a purchase or a hand posting names whoever
   * it names. The two forms that do not override this are unchanged.
   */
  protected companyRole(): string {
    return '';
  }

  /** What the company dropdown offers, and what a chosen title is checked against. */
  protected offeredCompanyTitles(): string[] {
    return offeredCompanies(
      this.deps.app,
      this.deps.getSettings(),
      this.createdCompanies,
      this.companyRole()
    );
  }
  protected areaTitle = '';
  protected category = '';
  protected amount: number | null = null;
  protected currency: string;

  constructor(protected readonly deps: CreateDeps) {
    super(deps.app);
    this.currency = deps.getSettings().homeCurrency;
  }

  /**
   * What somebody typed in the title field, empty while the name follows the
   * three facts the note already carries. See `finance-title.ts`.
   */
  protected typedTitle = '';
  /** Writes the derived name into the field where it stands. Null before the form is drawn. */
  private showTitle: ((value: string) => void) | null = null;

  /**
   * The day this kind of note is named after: an invoice's issue date, a
   * purchase's order date, the day a recurring cost starts.
   */
  protected abstract namingDate(): string | null;

  /** The reference the note carries, which each form holds under its own name. */
  protected abstract namingReference(): string;

  /**
   * The name this note would be saved under.
   *
   * Recomputed rather than remembered, so correcting the date after typing the
   * reference gives the name the corrected date implies.
   */
  protected noteTitle(): string {
    return noteTitle(this.typedTitle, {
      date: this.namingDate(),
      company: this.companyTitle,
      reference: this.namingReference(),
    });
  }

  /** False in the edit forms: renaming a note is Obsidian's operation, not a dialog's. */
  protected offersTitle(): boolean {
    return true;
  }

  /** Draws the title field, which every one of the three puts first. */
  protected titleField(container: HTMLElement, name: string): void {
    if (!this.offersTitle()) return;
    this.showTitle = this.followedText(
      container,
      name,
      () => this.noteTitle(),
      (value) => {
        this.typedTitle = value;
        // Only when the field was emptied, which is how somebody asks for the
        // derived name back. Writing while they type would move the cursor.
        if (value.trim() === '') this.followTitle();
      }
    );
  }

  /** Shows the name the form would save under, after a fact it is derived from changed. */
  protected followTitle(): void {
    this.showTitle?.(this.noteTitle());
  }

  protected override blocker(): string | null {
    return this.noteTitle().trim() === '' ? t('common.needsTitle') : null;
  }

  protected commonFields(container: HTMLElement): void {
    const settings = this.deps.getSettings();
    const areas = readAreas(this.deps.app, settings)
      .filter((area) => !area.archived)
      .map((area) => area.title);

    // The dropdown, and a way out of it. A vendor that is not in the vault yet
    // is the commonest thing a first month of invoices runs into, and leaving
    // the form to write a note by hand loses everything typed so far.
    //
    // The button makes a *company*, though the list holds both kinds. A vendor
    // met mid-form is nearly always one, and a person who invoices is somebody
    // the vault usually already has a note for. Offering the choice here would
    // put a second decision in front of the one somebody came to make.
    const companies = new Setting(container).setName(t('finance.counterparty'));
    companies.addDropdown((dropdown) => {
      for (const [value, label] of optional(this.offeredCompanyTitles())) {
        dropdown.addOption(value, label);
      }
      dropdown.setValue(this.companyTitle);
      dropdown.onChange((value) => {
        this.companyTitle = value;
        this.followTitle();
        // What this company usually does. Redrawn rather than written in place,
        // because what it fills is a dropdown and a number box rather than the
        // field being typed into.
        if (this.takeFromCompany()) this.rerender();
      });
    });
    companies.addExtraButton((button) => {
      button
        .setIcon('plus')
        .setTooltip(t('crm.addCompany'))
        .onClick(() => {
          new NewCompanyModal(
            {
              app: this.deps.app,
              getSettings: this.deps.getSettings,
              now: this.deps.now,
              onCreated: (file) => {
                // Chosen as well as created, so the form carries on where it was.
                this.createdCompanies.push(file.basename);
                this.companyTitle = file.basename;
                this.followTitle();
                this.rerender();
              },
            },
            '',
            // Seeded with the role this form is narrowing by, so a company
            // added from a filtered dropdown is in it the next time the form
            // opens. Without this the filter would quietly reject what it had
            // just invited somebody to create.
            this.companyRole()
          ).open();
        });
    });
    this.select(
      container,
      t('finance.area'),
      optional(areas),
      () => this.areaTitle,
      (value) => (this.areaTitle = value)
    );
    this.select(
      container,
      t('finance.category'),
      categoryChoices(settings),
      () => this.category,
      (value) => (this.category = value)
    );
    this.number(
      container,
      t('finance.amount'),
      () => this.amount,
      (value) => (this.amount = value)
    );
    this.select(
      container,
      t('finance.currency'),
      currencyChoices(settings),
      () => this.currency,
      (value) => (this.currency = value)
    );
  }

  /**
   * What a form takes from the company it names.
   *
   * The category here, because all three kinds of note carry one. A form that
   * also books to an account overrides this and takes that too; a purchase has
   * no account at all, so there is nothing for it to add.
   *
   * Returns true when anything changed, which is the caller's cue to redraw.
   */
  protected takeFromCompany(): boolean {
    const defaults = readCompanyDefaults(this.deps.app, this.deps.getSettings(), this.companyTitle);
    if (!hasCompanyDefaults(defaults) || !defaults.category) return false;
    if (this.category === defaults.category) return false;

    this.category = defaults.category;
    return true;
  }

  /** What the company would learn from this form, for a subclass that offers it. */
  protected companyLearns(onForm: CompanyDefaults): CompanyDefaults | null {
    if (!this.companyTitle.trim()) return null;
    const stored = readCompanyDefaults(this.deps.app, this.deps.getSettings(), this.companyTitle);
    return companyDefaultsToLearn(stored, onForm);
  }

  /** Writes what this form worked out back onto the company note. */
  protected async rememberForCompany(defaults: CompanyDefaults): Promise<void> {
    const written = await rememberCompanyDefaults(
      this.deps.app,
      this.deps.getSettings(),
      this.companyTitle,
      defaults
    );
    new Notice(
      written
        ? t('crm.defaultsRemembered', { company: this.companyTitle })
        : t('finance.noCompanyNote')
    );
  }

  protected announce(file: TFile): void {
    new Notice(t('notices.noteCreated', { title: file.basename }));
    this.deps.onCreated(file);
  }
}

export class NewPurchaseModal extends MoneyModal {
  protected reference = '';
  protected status: PurchaseStatus = 'ordered';
  protected orderDate: string | null = null;
  protected documentChoices: DocumentChoice[] = [];

  protected heading(): string {
    return t('commands.newPurchase');
  }

  protected override namingDate(): string | null {
    return this.orderDate;
  }

  protected override namingReference(): string {
    return this.reference;
  }

  protected fields(container: HTMLElement): void {
    this.titleField(container, t('types.purchase'));
    this.text(
      container,
      t('finance.reference'),
      () => this.reference,
      (value) => {
        this.reference = value;
        this.followTitle();
      }
    );
    this.date(
      container,
      t('finance.orderDate'),
      () => this.orderDate,
      (value) => {
        this.orderDate = value;
        this.followTitle();
      }
    );
    this.commonFields(container);
    this.select(
      container,
      t('common.status'),
      PURCHASE_STATUSES.map((status): [string, string] => [status, t(`status.purchase.${status}`)]),
      () => this.status,
      (value) => (this.status = value as PurchaseStatus)
    );
    documentFields(container, {
      app: this.deps.app,
      get: () => this.documentChoices,
      set: (choices) => (this.documentChoices = choices),
      refresh: () => this.rerender(),
    });
  }

  protected async submit(): Promise<void> {
    // Filed now rather than when it was picked: the folder is decided by the
    // date on the note, and on a half-filled form that date is still being
    // typed.
    const documentPaths = await fileDocumentChoices(
      this.deps.app,
      this.deps.getSettings(),
      'purchase',
      dateOf(this.orderDate),
      this.documentChoices
    );

    const file = await createPurchase(
      this.deps.app,
      this.deps.getSettings(),
      this.noteTitle().trim(),
      {
        reference: this.reference.trim(),
        companyTitle: this.companyTitle || null,
        areaTitle: this.areaTitle || null,
        projectTitle: null,
        category: this.category || null,
        status: this.status,
        date: this.orderDate,
        deliveryDate: null,
        // A new purchase has arrived in no boxes yet, by definition.
        deliveries: [],
        amount: this.amount,
        currency: this.currency,
        discount: null,
        shipping: null,
        vatRate: null,
        vatAmount: null,
        items: [],
        documentPaths,
        billTitle: null,
      },
      this.deps.now()
    );
    this.announce(file);
  }
}

export class NewBillModal extends MoneyModal {
  // Protected rather than private so the edit form can be this form over a note
  // that already exists, instead of a second copy of the same eleven fields
  // that drifts from this one the first time either is touched.
  /**
   * The account the invoice is booked to.
   *
   * The one field that decides whether this note ever reaches the ledger. A
   * statement import that recognises the payment takes this account and marks
   * the bill paid; without it, the import knows which invoice a row pays and
   * still has to ask where it belongs.
   */
  protected account: number | null = null;
  /**
   * Which way this invoice points.
   *
   * Incoming by default, because that is what an invoice is nearly always: one
   * the household owes. Everything the direction changes is a value rather
   * than a shape -- which accounts are offered, which companies, which side of
   * the posting is debited when it settles -- which is why this is one note
   * type and not two.
   */
  protected direction: BillDirection = 'incoming';

  /**
   * Which way the invoice travels decides which side of the vault it may name:
   * a vendor bills the household, the household bills a customer.
   */
  protected override companyRole(): string {
    const settings = this.deps.getSettings();
    return this.direction === 'outgoing' ? settings.billCustomerRole : settings.billVendorRole;
  }
  protected issueDate: string | null = null;
  protected dueDate: string | null = null;
  protected reference = '';
  protected documentChoices: DocumentChoice[] = [];
  /**
   * The recurring cost this invoice is one occurrence of.
   *
   * Without it the plan view counts the month twice: once for the invoice that
   * arrived and once for the occurrence it still projects. `settledOccurrences`
   * is what drops the projection, and it can only see a bill that says which
   * cost it belongs to.
   */
  protected recurringTitle = '';
  /**
   * The accounts this invoice divides across, when one is not enough.
   *
   * Empty on the ordinary invoice. A telephone bill carrying a hardware line,
   * or an energy bill covering electricity and gas, is two accounts on one
   * piece of paper, and splitting it into two notes would invent an invoice
   * that never arrived.
   */
  protected lines: BillLine[] = [];

  protected override namingDate(): string | null {
    return this.issueDate;
  }

  /** An invoice books to an account, so it takes the company's as well. */
  protected override takeFromCompany(): boolean {
    const filled = inheritFromCompany(
      { account: this.account, category: this.category || null },
      readCompanyDefaults(this.deps.app, this.deps.getSettings(), this.companyTitle)
    );
    // The lines are the more specific claim about where the money goes, so a
    // split invoice takes the category and leaves the account alone.
    const account = this.lines.length > 0 ? this.account : filled.account;
    const changed = account !== this.account || (filled.category ?? '') !== this.category;

    this.account = account;
    this.category = filled.category ?? '';
    return changed;
  }

  protected override namingReference(): string {
    return this.reference;
  }

  /** Fills the form from a bill that already exists. */
  protected loadFrom(bill: ParsedBill & { title: string }): void {
    // A note that exists is called what it is called, whatever the derivation
    // would say about it now.
    this.typedTitle = bill.title;
    this.account = bill.account;
    this.companyTitle = bill.companyTitle ?? '';
    this.areaTitle = bill.areaTitle ?? '';
    this.category = bill.category ?? '';
    this.amount = bill.amount;
    this.currency = bill.currency ?? this.currency;
    this.issueDate = bill.issueDate;
    this.dueDate = bill.dueDate;
    this.reference = bill.reference ?? '';
    this.documentChoices = bill.documentPaths.map((path) => ({ path, outside: null }));
  }

  protected heading(): string {
    return t('commands.newBill');
  }

  protected fields(container: HTMLElement): void {
    this.titleField(container, t('types.bill'));
    // First, because it answers the fields below it. An invoice for a standing
    // arrangement is the same company, the same amount and the same account
    // every time, and naming the arrangement is the whole of filling the form.
    this.recurringField(container);

    // Above the fields it decides. Changing it after filling the form in would
    // leave an account chosen from the wrong list still selected, so it is
    // asked first and the form is redrawn when it moves.
    this.select(
      container,
      t('finance.direction'),
      BILL_DIRECTIONS.map((value): [string, string] => [value, t(`finance.directions.${value}`)]),
      () => this.direction,
      (value) => {
        const next = value === 'outgoing' ? 'outgoing' : 'incoming';
        if (next === this.direction) return;
        this.direction = next;
        // The account belonged to the other direction's list, and a number
        // that is still selected but no longer offered is the shape that
        // saves an expense account onto a sales invoice.
        this.account = null;
        // The company is the same shape and a milder version of it. A value
        // with no matching option shows as the *first* option while the form
        // still holds the old one, so it would save a company nobody could
        // see. Checked rather than cleared, because a company that is both a
        // vendor and a customer carries both roles and is still valid: that
        // is the case the flat roles list was chosen for.
        if (this.companyTitle && !this.offeredCompanyTitles().includes(this.companyTitle)) {
          this.companyTitle = '';
          this.followTitle();
        }
        this.rerender();
      }
    );

    this.commonFields(container);
    this.select(
      container,
      this.direction === 'outgoing' ? t('ledger.earnedOn') : t('ledger.bookedTo'),
      // Narrowed by direction: an outgoing invoice earns into an income
      // account and an incoming one costs an expense account, and offering
      // both lists to both is offering a wrong figure in two reports.
      accountChoices(
        readAccounts(this.deps.app, this.deps.getSettings())
          .map((r) => r.account)
          .filter((account) =>
            this.direction === 'outgoing' ? account.kind === 'income' : account.kind === 'expense'
          )
      ),
      () => (this.account === null ? '' : String(this.account)),
      (value) => (this.account = accountValue(value))
    );
    this.linesRow(container);
    this.date(
      container,
      t('finance.issueDate'),
      () => this.issueDate,
      (value) => {
        this.issueDate = value;
        this.followTitle();
      }
    );
    this.date(
      container,
      t('finance.dueDate'),
      () => this.dueDate,
      (value) => (this.dueDate = value)
    );
    this.text(
      container,
      t('finance.reference'),
      () => this.reference,
      (value) => {
        this.reference = value;
        this.followTitle();
      }
    );
    this.rememberRow(container);

    documentFields(container, {
      app: this.deps.app,
      get: () => this.documentChoices,
      set: (choices) => (this.documentChoices = choices),
      refresh: () => this.rerender(),
    });
  }

  /**
   * The way a company learns where its invoices go.
   *
   * Offered rather than assumed, and only when there is something to learn.
   * Building the mapping by hand across forty companies is an evening nobody
   * spends; building it one invoice at a time, from the answer somebody just
   * gave, costs a click on the months it changes and nothing at all on the
   * months it does not.
   */
  private rememberRow(container: HTMLElement): void {
    const onForm = { account: this.account, category: this.category || null };
    const learns = this.companyLearns(onForm);
    if (!learns) return;

    const line = container.createDiv({ cls: 'nod-ledger-picker' });
    const where = learns.account === null ? (learns.category ?? '') : String(learns.account);
    line.createSpan({ cls: 'nod-ledger-hint', text: t('crm.defaultsHint', { where }) });

    const button = line.createEl('button', {
      text: t('crm.defaultsFor', { company: this.companyTitle }),
    });
    button.addEventListener('click', () => {
      void this.rememberForCompany(learns).then(() => this.rerender());
    });
  }

  /**
   * The standing arrangement this invoice is one occurrence of.
   *
   * **Choosing one fills the form.** A recurring cost already states the
   * company, the amount, the currency, the area, the category and the account,
   * and an invoice under it repeats every one of them. Typing them again once a
   * month is how they end up disagreeing with the arrangement they came from.
   *
   * Only what the cost actually states is copied. A cost with no area leaves
   * the area alone rather than clearing it, because "not stated here" and
   * "deliberately none" are different answers and only one of them is the
   * arrangement's to give.
   *
   * Clearing the selection changes nothing else. What was filled in is what
   * this invoice says, and unpicking the arrangement is not a reason to empty a
   * form somebody has been working in.
   */
  private recurringField(container: HTMLElement): void {
    const costs = readRecurring(this.deps.app, this.deps.getSettings());

    this.select(
      container,
      t('finance.recurring'),
      optional(costs.map((cost) => cost.title)),
      () => this.recurringTitle,
      (value) => {
        this.recurringTitle = value;
        const cost = costs.find((entry) => entry.title === value);
        if (cost) this.takeFrom(cost);
        // Redrawn rather than left as it was: the fields it just filled are
        // dropdowns and a number box, and each shows what it was given.
        this.rerender();
      }
    );
  }

  /**
   * What an invoice inherits from the arrangement it belongs to.
   *
   * The rule itself is `inheritFromRecurring`, which is arithmetic over two
   * records rather than anything about a form, and is tested as such.
   */
  private takeFrom(cost: RecurringRecord<TFile>): void {
    const filled = inheritFromRecurring(
      {
        companyTitle: this.companyTitle || null,
        areaTitle: this.areaTitle || null,
        category: this.category || null,
        amount: this.amount,
        currency: this.currency,
        account: this.account,
      },
      cost,
      { split: this.lines.length > 0 }
    );

    this.companyTitle = filled.companyTitle ?? '';
    this.areaTitle = filled.areaTitle ?? '';
    this.category = filled.category ?? '';
    this.amount = filled.amount;
    this.currency = filled.currency ?? this.currency;
    this.account = filled.account;
    this.followTitle();
  }

  /**
   * The way into the line editor, and what it has been told so far.
   *
   * The same editor the statement import uses for a batched payment, because it
   * is the same question: one amount, several accounts, and it must add up. It
   * needs the total first, so an invoice with no amount is asked for one rather
   * than opened onto a total of nothing.
   */
  private linesRow(container: HTMLElement): void {
    const line = container.createDiv({ cls: 'nod-ledger-picker' });
    line.createSpan({
      text:
        this.lines.length > 0
          ? t('ledger.legsSet', { count: String(this.lines.length) })
          : t('finance.oneAccount'),
    });

    const button = line.createEl('button', { text: t('finance.splitBill') });
    button.addEventListener('click', () => {
      const total = this.amount ?? 0;
      if (total === 0) {
        new Notice(t('ledger.amountFirst'));
        return;
      }
      new SplitLegsModal(
        this.deps.app,
        {
          total,
          accounts: readAccounts(this.deps.app, this.deps.getSettings()).map((r) => r.account),
          legs: this.lines.map((entry) => ({
            account: entry.account,
            amount: entry.amount,
            text: entry.note,
          })),
          label: this.noteTitle() || t('types.bill'),
          orders: readOrders(this.deps.app, this.deps.getSettings()),
        },
        (saved) => {
          this.lines = saved.map((leg) => ({
            account: leg.account,
            amount: leg.amount,
            note: leg.text,
          }));
          // The lines replace the single account, so leaving it set would be a
          // second claim about where the same money goes.
          if (this.lines.length > 0) this.account = null;
          this.rerender();
        }
      ).open();
    });
  }

  protected async submit(): Promise<void> {
    const documentPaths = await fileDocumentChoices(
      this.deps.app,
      this.deps.getSettings(),
      'bill',
      dateOf(this.issueDate ?? this.dueDate),
      this.documentChoices
    );

    const file = await createBill(
      this.deps.app,
      this.deps.getSettings(),
      this.noteTitle().trim(),
      {
        companyTitle: this.companyTitle || null,
        areaTitle: this.areaTitle || null,
        category: this.category || null,
        amount: this.amount,
        currency: this.currency,
        issueDate: this.issueDate,
        dueDate: this.dueDate,
        paidDate: null,
        reference: this.reference.trim() || null,
        documentPaths,
        direction: this.direction,
        account: this.account,
        lines: this.lines,
        // Written by whoever settles it, not by the form that creates it.
        paidFrom: null,
        recurringTitle: this.recurringTitle || null,
        purchaseTitle: null,
        // Left unstated on creation, always. The status is derived from the
        // dates, and a value written here would be stale by morning.
        statedStatus: null,
      },
      this.deps.now()
    );
    this.announce(file);
  }
}

export class NewRecurringModal extends MoneyModal {
  /**
   * The account every occurrence of this cost is booked to.
   *
   * Here rather than on each invoice, because it is the same answer every time
   * and the invoice form was asking for it once a month. An invoice that names
   * this cost now takes the account from it.
   */
  protected account: number | null = null;
  protected cadence: RecurringCadence = 'monthly';
  protected interval = 1;
  protected startDate: string | null = null;
  protected endDate: string | null = null;
  protected status: RecurringStatus = 'active';
  /** The policy or contract number, which is what somebody quotes on the phone. */
  protected reference = '';
  /**
   * The paper behind the arrangement: a policy, a contract, a subscription
   * confirmation. Not an invoice -- a recurring cost is the standing agreement
   * rather than any one bill under it -- but it is a document all the same, and
   * the reason to keep the note is usually that the document exists.
   */
  protected documentChoices: DocumentChoice[] = [];

  protected heading(): string {
    return t('commands.newRecurring');
  }

  protected override namingDate(): string | null {
    return this.startDate;
  }

  protected override namingReference(): string {
    return this.reference;
  }

  /** A standing cost books to an account, so it takes the company's as well. */
  protected override takeFromCompany(): boolean {
    const filled = inheritFromCompany(
      { account: this.account, category: this.category || null },
      readCompanyDefaults(this.deps.app, this.deps.getSettings(), this.companyTitle)
    );
    const changed = filled.account !== this.account || (filled.category ?? '') !== this.category;

    this.account = filled.account;
    this.category = filled.category ?? '';
    return changed;
  }

  protected fields(container: HTMLElement): void {
    this.titleField(container, t('types.recurring'));
    this.commonFields(container);
    this.select(
      container,
      t('ledger.bookedTo'),
      accountChoices(readAccounts(this.deps.app, this.deps.getSettings()).map((r) => r.account)),
      () => (this.account === null ? '' : String(this.account)),
      (value) => (this.account = accountValue(value))
    );
    this.select(
      container,
      t('cadence.monthly'),
      RECURRING_CADENCES.map((cadence): [string, string] => [cadence, t(`cadence.${cadence}`)]),
      () => this.cadence,
      (value) => (this.cadence = value as RecurringCadence)
    );
    this.number(
      container,
      t('finance.interval'),
      () => this.interval,
      (value) => (this.interval = value ?? 1)
    );
    this.date(
      container,
      t('finance.startDate'),
      () => this.startDate,
      (value) => {
        this.startDate = value;
        this.followTitle();
      }
    );
    this.date(
      container,
      t('finance.endDate'),
      () => this.endDate,
      (value) => (this.endDate = value)
    );
    this.select(
      container,
      t('common.status'),
      RECURRING_STATUSES.map((status): [string, string] => [
        status,
        t(`status.recurring.${status}`),
      ]),
      () => this.status,
      (value) => (this.status = value as RecurringStatus)
    );
    this.text(
      container,
      t('finance.reference'),
      () => this.reference,
      (value) => {
        this.reference = value;
        this.followTitle();
      }
    );
    documentFields(container, {
      app: this.deps.app,
      get: () => this.documentChoices,
      set: (choices) => (this.documentChoices = choices),
      refresh: () => this.rerender(),
    });
  }

  protected async submit(): Promise<void> {
    // Filed by the day the arrangement starts, which is the date the note is
    // filed under itself, so the document lands beside its own note.
    const documentPaths = await fileDocumentChoices(
      this.deps.app,
      this.deps.getSettings(),
      'recurring',
      dateOf(this.startDate),
      this.documentChoices
    );

    const file = await createRecurring(
      this.deps.app,
      this.deps.getSettings(),
      this.noteTitle().trim(),
      {
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
        documentPaths,
        account: this.account,
        reference: this.reference.trim() || null,
      },
      this.deps.now()
    );
    this.announce(file);
  }
}

export class NewBudgetModal extends FormModal {
  private period: string;
  private currency: string;

  constructor(private readonly deps: CreateDeps) {
    super(deps.app);
    // The year, because a budget is one note a year now: each line carries a
    // rhythm and the twelve months are derived from it.
    this.period = periodTitle('year', deps.now());
    this.currency = deps.getSettings().homeCurrency;
  }

  protected heading(): string {
    return t('commands.newBudget');
  }

  protected override blocker(): string | null {
    return this.period.trim() === '' ? t('ledger.needsYear') : null;
  }

  protected fields(container: HTMLElement): void {
    this.text(
      container,
      t('common.period'),
      () => this.period,
      (value) => (this.period = value)
    );
    this.select(
      container,
      t('finance.currency'),
      currencyChoices(this.deps.getSettings()),
      () => this.currency,
      (value) => (this.currency = value)
    );
  }

  protected async submit(): Promise<void> {
    // Created with no lines, and the note says so with an empty list rather
    // than by omitting the property: an empty list is how it says "budgeted,
    // and it holds nothing" instead of "not filled in".
    const file = await createBudget(
      this.deps.app,
      this.deps.getSettings(),
      { period: this.period.trim(), currency: this.currency, lines: [] },
      this.deps.now()
    );
    new Notice(t('notices.noteCreated', { title: file.basename }));
    this.deps.onCreated(file);
  }
}
