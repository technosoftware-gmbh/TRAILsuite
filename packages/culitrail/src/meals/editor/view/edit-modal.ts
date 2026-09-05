/**
 * The meal editor.
 *
 * Staged: nothing is written until Save changes, so a half-finished edit
 * costs nothing and closing the modal is always safe. That is the difference
 * between this and the rest of the meal view, where the heart, the stars
 * and the scale stepper each write the moment they are clicked.
 *
 * The description is edited as text rather than as rows,
 * because that is what they are in the note: a group heading, a line per
 * item, and whatever Markdown somebody chose to put in them.
 */
import { App, Notice, TFile } from 'obsidian';
import { t } from '../../../lang/I18nManager';
import { addFooterButtons, BaseModal } from '../../../ui/base-modal';
import type { CULItrailSettings } from '../../../settings/types';
import { readMealDraft } from '../read-draft';
import type { CompanyTerms } from '../../../crm/company-terms';
import { companyHasRole } from '@technosoftware/trail-core';
import { readCompanies } from '../../../crm/read-crm';
import { SupplierLinesModal } from '../../../crm/supplier-lines-modal';
import { currencyFor } from '../../view-model/currency';
import { isUnknownSupplier, supplierOptionValues } from '../supplier-options';
import { joinValues, splitValues, vocabularyChoices, vocabularyOptions } from '../vocabulary';
import { readMealLibraryValues } from '../library-values';
import { writeMealDraft } from '../write-draft';
import type { MealDraft } from '../types';
import {
  chipsField,
  fieldGroup,
  fieldLabel,
  imageField,
  numberFieldRow,
  selectField,
  textArea,
  textField,
  twoColumns,
} from './fields';
import { renderNutritionFields } from './nutrition-fields';

/**
 * A thrown value as a line of text.
 *
 * A rejected vault write can carry anything at all, and passing a bare object
 * to a template would put `[object Object]` in front of somebody instead of a
 * reason.
 */
function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : JSON.stringify(error);
}

export class EditMealModal extends BaseModal {
  private draft: MealDraft | null = null;
  /** The element the fields are drawn into, held so a redraw does not have to find it. */
  private body: HTMLElement | null = null;
  private saveButton: HTMLButtonElement | null = null;

  constructor(
    app: App,
    private readonly file: TFile,
    private readonly settings: CULItrailSettings,
    private readonly onSaved: () => void
  ) {
    super(app);
  }

  getTitle(): string {
    return t('meals.editor.title');
  }

  getIcon(): string {
    return 'square-pen';
  }

  getSubtitle(): string {
    return this.file.basename;
  }

  getModalClasses(): string[] {
    return ['culi-edit-modal'];
  }

  /**
   * The company notes, plus whatever this meal already names.
   *
   * The rule and the reason it exists are in `supplier-options.ts`, which is where
   * they can be tested; this only attaches labels to what that returns.
   */
  private supplierOptions(current: string | null): { value: string; label: string }[] {
    // Narrowed to the companies carrying the configured role, which is empty
    // until somebody has classified their suppliers and then offers everyone.
    // A vault accumulates every company anybody has ever paid, and this
    // dropdown over two hundred of them is unusable; narrowing before the
    // companies are marked would hide the ones that are right.
    const companies = readCompanies(this.app, this.settings)
      .filter((company) => companyHasRole(company.roles, this.settings.mealSupplierRole))
      .map((company) => company.title);

    return supplierOptionValues(companies, current).map((value) => {
      if (value === '') return { value, label: t('meals.editor.noSupplier') };
      // Marked rather than shown as an ordinary choice, so it does not read as a
      // company that exists.
      return value === current && isUnknownSupplier(companies, current)
        ? { value, label: t('meals.editor.unknownSupplier', { name: value }) }
        : { value, label: value };
    });
  }

  /** The price label, with the currency this meal is actually priced in. */
  private priceLabel(draft: MealDraft): string {
    const currency = currencyFor(draft, this.supplierTerms(draft.supplier), this.settings);
    return currency ? `${t('meals.editor.price')} (${currency})` : t('meals.editor.price');
  }

  /** What the named company charges, or null when it names none this vault has. */
  private supplierTerms(supplier: string | null): CompanyTerms | null {
    if (!supplier) return null;
    const key = supplier.trim().toLowerCase();
    return (
      readCompanies(this.app, this.settings).find(
        (company) => company.title.trim().toLowerCase() === key
      )?.terms ?? null
    );
  }

  /**
   * The lines the supplier publishes, plus whatever the meal already says.
   *
   * Empty when the company publishes none and the meal names none, which is
   * what makes the caller fall back to a plain text field: a dropdown holding
   * only "none" is a control that cannot be used.
   */
  /**
   * The link that opens the supplier's line list, when there is a supplier.
   *
   * A company this vault does not have is the case worth handling: a meal can
   * name a supplier whose note was renamed or never existed, and offering to
   * edit the lines of a note that is not there would open an editor over
   * nothing.
   */
  private renderEditLinesButton(container: HTMLElement, draft: MealDraft): void {
    const named = draft.supplier?.trim();
    if (!named) return;

    const key = named.toLowerCase();
    const company = readCompanies(this.app, this.settings).find(
      (candidate) => candidate.title.trim().toLowerCase() === key
    );
    if (!company) return;

    const link = container.createEl('button', {
      cls: 'culi-edit-lines-link',
      text: t('meals.lines.edit'),
      type: 'button',
    });
    link.addEventListener('click', (event) => {
      event.preventDefault();
      new SupplierLinesModal(this.app, company.file, company.title, this.settings, () =>
        this.redraw()
      ).open();
    });
  }

  /**
   * What the meal notes in this vault actually say, for the three fields with a
   * vocabulary.
   *
   * Read once per draw rather than per field: it is one pass over the library
   * and three fields want it.
   */
  private libraryValues(): { diets: string[]; allergens: string[]; lines: string[] } {
    return readMealLibraryValues(this.app, this.settings);
  }

  private lineOptions(draft: MealDraft): { value: string; label: string }[] {
    const published = this.supplierTerms(draft.supplier)?.lines ?? [];
    const values = supplierOptionValues(published, draft.line);
    return values.map((value) => ({
      value,
      label: value === '' ? t('meals.editor.noLine') : value,
    }));
  }

  async renderBody(body: HTMLElement): Promise<void> {
    const draft = await readMealDraft(this.app, this.file, this.settings);
    this.draft = draft;
    this.body = body;
    if (this.saveButton) this.saveButton.disabled = false;
    this.renderFields(body, draft);
  }

  /**
   * Draws the fields again from the draft in hand.
   *
   * **Never `renderBody`.** That reads the note from disk, which is right when
   * the form opens and destroys every unsaved edit at any other moment. A chip
   * toggled after ten minutes of typing would have thrown all ten minutes away.
   */
  private redraw(): void {
    const draft = this.draft;
    const body = this.body;
    if (!draft || !body) return;
    body.empty();
    this.renderFields(body, draft);
  }

  private renderFields(body: HTMLElement, draft: MealDraft): void {
    fieldLabel(body, t('meals.editor.description'));
    textArea(body, draft.description, (value) => (draft.description = value), 2);

    // Two pairs of columns rather than five stacked groups. Height is the scarce
    // dimension: stacked, this form ran about 850px for a meal of ordinary
    // length, which is past the bottom of the dialog on a laptop screen.
    const shortGroups = twoColumns(body);

    const basics = fieldGroup(shortGroups, t('meals.editor.basicInfo'));
    fieldLabel(basics, t('meals.editor.timing'));
    numberFieldRow(basics, [
      {
        label: t('meals.editor.prep'),
        placeholder: '15',
        value: draft.prepTime,
        onChange: (value) => (draft.prepTime = value),
      },
      {
        label: t('meals.editor.cook'),
        placeholder: '30',
        value: draft.reheatTime,
        onChange: (value) => (draft.reheatTime = value),
      },
      {
        label: t('meals.editor.total'),
        placeholder: '45',
        value: draft.totalTime,
        onChange: (value) => (draft.totalTime = value),
      },
    ]);

    numberFieldRow(basics, [
      {
        label: t('meals.editor.servings'),
        placeholder: '4',
        value: draft.servings,
        onChange: (value) => (draft.servings = value),
      },
    ]);

    // A labelled row of its own rather than a fifth box beside the timings, which
    // is where this started and where nobody could find it: it rendered correctly
    // at every width and still read as another number about eating. The label
    // says what a price is doing on a meal at all, which for a library that is
    // mostly bought rather than eaten is the more useful question.
    fieldLabel(basics, t('meals.editor.readyMeal'));
    numberFieldRow(basics, [
      {
        // The currency is appended rather than translated in, because it comes
        // from the note, its supplier or a setting, and a label that said "CHF"
        // in a euro household would be worse than one that said nothing. It
        // follows the same chain the view formats the price through, so the
        // form and the header cannot name two different currencies.
        label: this.priceLabel(draft),
        placeholder: '17.00',
        value: draft.price,
        onChange: (value) => (draft.price = value),
      },
    ]);

    selectField(
      basics,
      t('meals.editor.supplier'),
      this.supplierOptions(draft.supplier),
      draft.supplier ?? '',
      (value) => (draft.supplier = value || null)
    );

    // A dropdown of the supplier's own ranges, and a plain field for a company
    // that publishes none. **Whatever the note already says is always an
    // option**, which is the rule the supplier dropdown exists to keep: a
    // `<select>` whose value matches nothing falls back to its first option, so
    // saving would silently move the meal to another line.
    const lines = this.lineOptions(draft);
    if (lines.length > 1) {
      selectField(basics, t('meals.editor.line'), lines, draft.line ?? '', (value) => {
        draft.line = value || null;
      });
    } else {
      textField(basics, t('meals.editor.line'), draft.line ?? '', (value) => {
        draft.line = value.trim() || null;
      });
    }

    // The moment somebody notices the list is wrong is the moment they are
    // looking at this field, so the way to fix it is here rather than in a
    // command they would have to know exists. Offered only with a supplier
    // named, because there is otherwise no note to write the lines to.
    this.renderEditLinesButton(basics, draft);

    const known = this.libraryValues();

    // A dropdown where there is a vocabulary to offer and a text field where
    // there is not, which is the same shape the line field takes: a dropdown
    // holding one empty option is a control that cannot be used.
    const diets = vocabularyOptions(this.settings.mealDietOptions, known.diets, draft.diet);
    if (diets.length > 0) {
      selectField(
        basics,
        t('meals.editor.diet'),
        [
          { value: '', label: t('meals.editor.noDiet') },
          ...diets.map((v) => ({ value: v, label: v })),
        ],
        draft.diet,
        (value) => (draft.diet = value)
      );
    } else {
      textField(basics, t('meals.editor.diet'), draft.diet, (value) => (draft.diet = value));
    }

    const chosenAllergens = splitValues(draft.allergens);
    const allergens = vocabularyChoices(
      this.settings.mealAllergenOptions,
      known.allergens,
      chosenAllergens
    );
    if (allergens.length > 0) {
      chipsField(basics, t('meals.editor.allergens'), allergens, chosenAllergens, (chosen) => {
        draft.allergens = joinValues(chosen);
        // Redrawn from the draft, because a chip is a view of the list rather
        // than a second record of it.
        this.redraw();
      });
    } else {
      textField(
        basics,
        t('meals.editor.allergens'),
        draft.allergens,
        (value) => (draft.allergens = value)
      );
    }

    imageField(basics, {
      app: this.app,
      label: t('meals.editor.image'),
      get: () => draft.image,
      set: (value) => (draft.image = value),
      refresh: () => this.redraw(),
    });

    renderNutritionFields(fieldGroup(shortGroups, t('meals.editor.nutrition')), draft);
  }

  renderFooter(footer: HTMLElement): void {
    this.saveButton = addFooterButtons(footer, {
      confirmLabel: t('meals.editor.save'),
      onCancel: () => this.close(),
      onConfirm: () => this.save(),
    });
    // Enabled once the draft has loaded. Saving a draft that is still null
    // would write a note's every field as empty.
    this.saveButton.disabled = true;
  }

  private save(): void {
    const draft = this.draft;
    const button = this.saveButton;
    if (!draft || !button) return;

    button.disabled = true;
    button.setText(t('meals.editor.saving'));

    void writeMealDraft(this.app, this.file, this.settings, draft)
      .then(() => {
        this.onSaved();
        this.close();
      })
      .catch((error: unknown) => {
        // Left open rather than closed on failure: the draft is the only copy
        // of what was typed, and closing would discard it.
        new Notice(t('meals.editor.saveFailed', { error: describe(error) }));
        button.disabled = false;
        button.setText(t('meals.editor.save'));
      });
  }
}
