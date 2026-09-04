/**
 * Creating or editing an order.
 *
 * One modal for both, because the fields are the same and the only real
 * difference is whether the order date can still be chosen. An existing
 * order's date is fixed: an order happened when it happened, and letting an
 * edit restamp it would quietly rewrite history and rename the file.
 */
import { App, Setting, TFile } from 'obsidian';
import { findValue, localDateISO, readNumberLike } from 'trail-core';
import { t } from '../../lang/I18nManager';
import type { CompanyTerms } from '../../crm/company-terms';
import { readCompanies, readPersons } from '../../crm/read-crm';
import { orderDefaults } from '../company-defaults';
import { eligiblePersons } from '../../crm/persons';
import { addFooterButtons, BaseModal } from '../../ui/base-modal';
import type { CULItrailSettings } from '../../settings/types';
import { readNotesOfType } from '../../vault/read-notes';
import type { OrderItem, OrderSelection, ParsedOrder } from '../types';
import {
  applyDishPrice,
  computedOrderTotal,
  dishLines,
  orderSubtotal,
  selectionTitles,
} from 'trail-core';
import { mealMetaAliases } from '../../meals/parser/meal-meta';

/** The fields the company's terms can fill in, and that a person can override. */
type PrefilledField = 'shipping' | 'discount' | 'priceCurrency';

export interface OrderDraft {
  orderNumber: string;
  orderDate: Date;
  companyTitle: string | null;
  deliveryDate: string | null;
  price: number | null;
  priceCurrency: string | null;
  discount: number | null;
  shipping: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  selections: OrderSelection[];
}

export class OrderModal extends BaseModal {
  private readonly draft: OrderDraft;
  private readonly persons: string[];
  private readonly companies: string[];
  /** What each company charges, read once when the dialog opens. */
  private readonly companyTerms: Map<string, CompanyTerms>;
  /**
   * Fields somebody has typed into, which pre-filling must not overwrite.
   *
   * The defaults follow the company and the line count, so they are reapplied
   * whenever either changes. Without this, correcting a shipping fee by hand
   * and then adding one more dish would silently undo the correction.
   */
  private readonly touched = new Set<PrefilledField>();
  /**
   * The three inputs pre-filling writes back into.
   *
   * Held rather than repainting the dialog, because the fields sit above the
   * dish list and rebuilding the form while somebody is halfway down it would
   * scroll them back to the top and drop the caret.
   */
  private readonly inputs: Partial<Record<PrefilledField, HTMLInputElement>> = {};
  private readonly meals: string[];
  /**
   * Each meal's current price, which is the **default** a new line is seeded
   * with and nothing more. Read once when the dialog opens: a price the supplier
   * changes tomorrow must not reach back into an order recorded today.
   */
  private readonly defaultPrices: Map<string, number | null>;
  /** Repainted when a line is added or removed, so the price rows stay true. */
  private costsSection: HTMLElement | null = null;
  /** Held because it is written to rather than typed into whenever the lines are priced. */
  private totalInput: HTMLInputElement | null = null;

  constructor(
    app: App,
    private readonly settings: CULItrailSettings,
    /** The order being edited, or null when this is a new one. */
    private readonly existing: (ParsedOrder & { file: TFile }) | null,
    private readonly onSave: (draft: OrderDraft, knownPersons: string[]) => void
  ) {
    super(app);

    this.persons = eligiblePersons(readPersons(app, settings), settings.eligiblePersonTags).map(
      (person) => person.title
    );
    const companyNotes = readCompanies(app, settings);
    this.companies = companyNotes.map((company) => company.title);
    this.companyTerms = new Map(
      companyNotes.map((company) => [company.title.trim().toLowerCase(), company.terms])
    );
    const mealNotes = readNotesOfType(app, settings, 'meal');
    this.meals = mealNotes.map((note) => note.title);

    const priceAliases = mealMetaAliases(settings).price;
    this.defaultPrices = new Map(
      mealNotes.map((note) => [
        note.title,
        readNumberLike(findValue(note.frontmatter, ...priceAliases)),
      ])
    );

    this.draft = existing
      ? {
          orderNumber: existing.orderNumber,
          orderDate: new Date(`${existing.orderDate ?? localDateISO()}T00:00:00`),
          companyTitle: existing.companyTitle,
          deliveryDate: existing.deliveryDate,
          price: existing.price,
          priceCurrency: existing.priceCurrency,
          discount: existing.discount,
          shipping: existing.shipping,
          vatRate: existing.vatRate,
          vatAmount: existing.vatAmount,
          // Items copied rather than shared, so cancelling the dialog leaves the
          // order exactly as it was.
          selections: existing.selections.map((selection) => ({
            personTitle: selection.personTitle,
            items: selection.items.map((item) => ({ ...item })),
          })),
        }
      : {
          orderNumber: '',
          orderDate: new Date(),
          companyTitle: null,
          deliveryDate: null,
          price: null,
          // Prefilled from settings rather than left blank: a household orders
          // in one currency and typing it every time is a tax on the common
          // case.
          priceCurrency: settings.orderDefaultCurrency || null,
          discount: null,
          shipping: null,
          vatRate: null,
          vatAmount: null,
          selections: [],
        };
  }

  getTitle(): string {
    return this.existing ? t('orders.editOrder') : t('orders.newOrder');
  }

  getIcon(): string {
    return 'receipt';
  }

  renderBody(body: HTMLElement): void {
    this.renderDetails(body);
    this.renderSelections(body);
    this.costsSection = body.createDiv({ cls: 'culi-order-costs' });
    this.paintCosts();
    // After the lines exist, since whether the total is derived at all depends
    // on whether any of them carries a price.
    this.paintTotal();
  }

  private renderDetails(body: HTMLElement): void {
    new Setting(body).setName(t('orders.orderNumber')).addText((text) =>
      text.setValue(this.draft.orderNumber).onChange((value) => {
        this.draft.orderNumber = value.trim();
      })
    );

    new Setting(body).setName(t('orders.orderDate')).addText((text) => {
      text.inputEl.type = 'date';
      text.setValue(localDateISO(this.draft.orderDate));
      // Fixed once the order exists: changing it would rename the note and
      // restate when the order happened.
      text.inputEl.disabled = this.existing !== null;
      text.onChange((value) => {
        const parsed = new Date(`${value}T00:00:00`);
        if (!Number.isNaN(parsed.getTime())) this.draft.orderDate = parsed;
      });
    });

    new Setting(body).setName(t('orders.company')).addDropdown((dropdown) => {
      dropdown.addOption('', t('orders.noCompany'));
      for (const company of this.companies) dropdown.addOption(company, company);
      dropdown.setValue(this.draft.companyTitle ?? '');
      dropdown.onChange((value) => {
        this.draft.companyTitle = value || null;
        this.applyCompanyDefaults();
      });
    });

    new Setting(body).setName(t('orders.deliveryDate')).addText((text) => {
      text.inputEl.type = 'date';
      text.setValue(this.draft.deliveryDate ?? '');
      text.onChange((value) => (this.draft.deliveryDate = value || null));
    });

    new Setting(body)
      .setName(t('orders.invoice.total'))
      .setDesc(t('orders.totalDesc'))
      .addText((text) => {
        text.inputEl.inputMode = 'decimal';
        this.totalInput = text.inputEl;
        text.setValue(this.draft.price === null ? '' : String(this.draft.price));
        // Only ever reached while the field is editable: a disabled input fires
        // no change event, which is what makes the derived case safe.
        text.onChange((value) => {
          const parsed = parseFloat(value.replace(',', '.'));
          this.draft.price = Number.isFinite(parsed) ? parsed : null;
        });
        this.paintTotal();
      })
      .addText((text) => {
        text.inputEl.addClass('culi-order-currency');
        text.setValue(this.draft.priceCurrency ?? '');
        this.inputs.priceCurrency = text.inputEl;
        text.onChange((value) => {
          this.touched.add('priceCurrency');
          this.draft.priceCurrency = value.trim() || null;
        });
      });

    // Both come off, or go onto, the whole order rather than any one line. That
    // is how a discount was described, and it is why there is no per-item one.
    this.amountField(body, t('orders.discount'), t('orders.discountDesc'), 'discount');
    this.amountField(body, t('orders.shipping'), null, 'shipping');
  }

  private amountField(
    body: HTMLElement,
    name: string,
    description: string | null,
    key: 'discount' | 'shipping'
  ): void {
    const setting = new Setting(body).setName(name);
    if (description) setting.setDesc(description);

    setting.addText((text) => {
      text.inputEl.inputMode = 'decimal';
      text.setValue(this.draft[key] === null ? '' : String(this.draft[key]));
      this.inputs[key] = text.inputEl;
      text.onChange((value) => {
        this.touched.add(key);
        const parsed = parseFloat(value.replace(',', '.'));
        this.draft[key] = Number.isFinite(parsed) ? parsed : null;
        this.paintTotal();
      });
    });
  }

  /**
   * Who ordered what.
   *
   * One block per eligible person, each with a checkbox per meal. A long
   * meal library makes this unwieldy, which is why the list is filtered by
   * a search box shared across the blocks rather than repeated per person.
   */
  private renderSelections(body: HTMLElement): void {
    const section = body.createDiv({ cls: 'culi-order-selections' });
    section.createEl('h3', { text: t('orders.whoOrderedWhat') });

    if (this.persons.length === 0) {
      section.createEl('p', { cls: 'culi-order-hint', text: t('orders.noPeople') });
      return;
    }

    const search = section.createEl('input', {
      cls: 'culi-order-search',
      attr: { type: 'search', placeholder: t('orders.searchMeals') },
    });

    const lists: Array<{ person: string; container: HTMLElement }> = [];

    for (const person of this.persons) {
      const block = section.createDiv({ cls: 'culi-order-person' });
      block.createDiv({ cls: 'culi-order-person-name', text: person });
      lists.push({ person, container: block.createDiv({ cls: 'culi-order-meal-list' }) });
    }

    const paint = (query: string): void => {
      const wanted = query.trim().toLowerCase();
      const shown = wanted
        ? this.meals.filter((title) => title.toLowerCase().includes(wanted))
        : this.meals;

      for (const { person, container } of lists) {
        container.empty();
        for (const meal of shown) this.renderMealToggle(container, person, meal);
      }
    };

    search.addEventListener('input', () => paint(search.value));
    paint('');
  }

  private renderMealToggle(container: HTMLElement, person: string, meal: string): void {
    const label = container.createEl('label', { cls: 'culi-order-meal' });
    const checkbox = label.createEl('input', { attr: { type: 'checkbox' } });
    checkbox.checked = this.picked(person).includes(meal);
    label.createSpan({ text: meal });

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) this.addItem(person, meal);
      else this.removeItem(person, meal);
      // Before the repaint: a quantity discount and a free-shipping threshold
      // both step on the number of dishes, so adding one can change both.
      this.applyCompanyDefaults();
      this.paintCosts();
      this.paintTotal();
    });
  }

  private itemsFor(person: string): OrderItem[] {
    return this.draft.selections.find((s) => s.personTitle === person)?.items ?? [];
  }

  private picked(person: string): string[] {
    const selection = this.draft.selections.find((s) => s.personTitle === person);
    return selection ? selectionTitles(selection) : [];
  }

  /**
   * Adds a line, seeded with the dish's price as it stands right now.
   *
   * **This is the moment the price is recorded**, and it is the only moment it is
   * read from the meal. Everything afterwards, including reopening this dialog
   * next year, works from what the note stored. A dish with no price gives a line
   * with no price rather than a zero, which is not the same claim.
   */
  private addItem(person: string, mealTitle: string): void {
    const item: OrderItem = {
      mealTitle,
      price: this.defaultPrices.get(mealTitle) ?? null,
      quantity: 1,
      // Null rather than the company's quantity discount: that comes off the
      // whole order and is pre-filled there. A line discount is the exception
      // somebody types, so it starts unstated.
      discount: null,
    };

    const existing = this.draft.selections.find((s) => s.personTitle === person);
    if (existing) existing.items.push(item);
    else this.draft.selections = [...this.draft.selections, { personTitle: person, items: [item] }];
  }

  private removeItem(person: string, mealTitle: string): void {
    const selection = this.draft.selections.find((s) => s.personTitle === person);
    if (!selection) return;

    selection.items = selection.items.filter((item) => item.mealTitle !== mealTitle);
    // A person with nothing picked is dropped rather than kept as an empty
    // entry, so the note carries only real selections.
    if (selection.items.length === 0) {
      this.draft.selections = this.draft.selections.filter((s) => s !== selection);
    }
  }

  /**
   * What each chosen dish cost, and what that adds up to.
   *
   * **One row per dish, not per person.** A price belongs to the meal: two people
   * choosing the same dish pay the same for it, so offering two separately editable
   * prices invited them to disagree. The person's name is gone from the row for the
   * same reason, which also gives the dish name back the room it needs. `x 2` says
   * two portions were ordered, however many people that was.
   *
   * A section of its own rather than a price box beside each of a hundred and
   * twenty-six checkboxes above, so the list is as long as the order rather than as
   * long as the library.
   */
  private paintCosts(): void {
    const section = this.costsSection;
    if (!section) return;

    section.empty();

    const dishes = dishLines(this.draft);
    if (dishes.length === 0) return;

    section.createEl('h3', { text: t('orders.whatItCost') });

    for (const dish of dishes) {
      const row = section.createDiv({ cls: 'culi-order-cost-row' });
      row.createSpan({ cls: 'culi-order-cost-dish', text: dish.mealTitle });

      // Only when there is more than one, so a single-portion dish is not labelled
      // with an arithmetic fact nobody needs.
      if (dish.count > 1) {
        row.createSpan({ cls: 'culi-order-cost-count', text: `x ${dish.count}` });
      }

      const price = row.createEl('input', {
        cls: 'culi-order-cost-price',
        attr: { type: 'text', inputmode: 'decimal', placeholder: t('orders.pricePlaceholder') },
      });
      price.value = dish.price === null ? '' : String(dish.price);
      price.addEventListener('input', () => {
        const parsed = parseFloat(price.value.replace(',', '.'));
        applyDishPrice(this.draft, dish.mealTitle, Number.isFinite(parsed) ? parsed : null);
        this.paintTotal();
      });
    }
  }

  /**
   * Offers what the company charges, for the fields nobody has touched.
   *
   * Reapplied on every change to the company or the lines, because a quantity
   * discount and a free-shipping threshold both step on a count. What it writes
   * is a plain number: from here on the note says what was charged, and nothing
   * recomputes it. See `company-defaults.ts`.
   */
  private applyCompanyDefaults(): void {
    const key = this.draft.companyTitle?.trim().toLowerCase();
    const terms = key ? this.companyTerms.get(key) : undefined;
    if (!terms) return;

    const defaults = orderDefaults(terms, this.draft.selections, orderSubtotal(this.draft));

    if (!this.touched.has('priceCurrency') && defaults.currency) {
      this.setPrefilled('priceCurrency', defaults.currency);
    }
    if (!this.touched.has('shipping')) this.setPrefilled('shipping', defaults.shipping);
    if (!this.touched.has('discount')) this.setPrefilled('discount', defaults.discount);

    this.paintCosts();
    this.paintTotal();
  }

  /** Writes a pre-filled value into the draft and into the field showing it. */
  private setPrefilled(field: PrefilledField, value: string | number | null): void {
    if (field === 'priceCurrency') this.draft.priceCurrency = (value as string | null) ?? null;
    else this.draft[field] = (value as number | null) ?? null;

    const input = this.inputs[field];
    if (input) input.value = value === null ? '' : String(value);
  }

  /**
   * The total field, which is derived whenever there is anything to derive it
   * from.
   *
   * **An order with line prices does not get asked what it cost.** It is the
   * sum of its lines, less the discount, plus the shipping, and a field that
   * let somebody type a different number was an invitation for the note to say
   * one thing while its own lines said another -- which is exactly the
   * disagreement the document used to have to render two totals to describe.
   * The draft is written here rather than on save, so what the note stores and
   * what the field shows cannot come apart.
   *
   * An order whose lines carry no price keeps an editable field. That is every
   * order written before line prices existed, and the typed total is the only
   * thing such a note knows about money.
   *
   * Its own method rather than part of `paintCosts`, so typing in a price field
   * does not rebuild the field being typed into and move the caret to its end.
   */
  private paintTotal(): void {
    const input = this.totalInput;
    if (!input) return;

    const computed = computedOrderTotal(this.draft);
    input.disabled = computed !== null;
    input.toggleClass('culi-order-total-derived', computed !== null);
    if (computed === null) return;

    this.draft.price = computed;
    input.value = computed.toFixed(2);
  }

  renderFooter(footer: HTMLElement): void {
    addFooterButtons(footer, {
      confirmLabel: this.existing ? t('orders.save') : t('orders.create'),
      onCancel: () => this.close(),
      onConfirm: () => {
        this.onSave(this.draft, this.persons);
        this.close();
      },
    });
  }
}
