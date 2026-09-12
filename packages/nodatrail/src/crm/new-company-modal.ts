/**
 * A Company note, made from NODAtrail.
 *
 * Every bill, purchase and standing charge asks which company it is with, and
 * until now the answer could only be one that already existed. A plugin that
 * asks a question it cannot let you answer is a plugin you leave in order to
 * write a note by hand, which for a first month of invoices is a hundred
 * detours.
 *
 * **The note format is the suite's, not this plugin's.** Company and Person
 * notes are shared by all three plugins and owned by none, so a field left
 * blank is left out rather than written empty, and nothing here touches a field
 * the shared contract names.
 *
 * The account and the category are this plugin's own addition, and they are
 * additive rather than a change to the contract: the other two read the fields
 * they know and never see these. They are here because the alternative is a
 * mapping kept in settings, which would not survive a reinstall, would not be
 * visible in the note somebody has open, and could not be corrected with
 * Obsidian's own property editor.
 */
import { App, Notice, TFile } from 'obsidian';
import { t } from '../lang/I18nManager';
import { FormModal } from '../ui/modals/form-modal';
import { accountChoices, accountValue } from '../ledger/account-field';
import { readAccounts } from '../ledger/read-ledger';
import { configuredCategories, categoryLabel } from '../shared/categories';
import type { NODAtrailSettings } from '../settings/types';
import { createTypedNote } from '../vault/create-note';

export interface NewCompanyDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  now: () => Date;
  /** Handed the new note, so a caller that asked for a company can use it at once. */
  onCreated: (file: TFile) => void;
}

export class NewCompanyModal extends FormModal {
  // Protected rather than private throughout: the edit form is this form with
  // the title turned off and the submit rerouted, which is only possible if it
  // can fill these in. A second copy of the same eight fields would drift from
  // this one the day either was touched.
  protected companyName: string;
  protected description = '';
  protected address = '';
  protected website = '';
  protected email = '';
  /** Where this company's invoices usually go. Both optional, and both a default rather than a rule. */
  protected account: number | null = null;
  protected category = '';
  /**
   * True for a company that collects other companies' money: Klarna, PayPal, a
   * card acquirer. Their statement rows carry their name where the invoice
   * carries the shop's, and this is what lets the import match the two anyway.
   */
  protected collectsForOthers = false;
  /**
   * What this company is to the household: `meals`, `hotel`, `restaurant`.
   *
   * Comma separated as typed, because it is answered once per company and a
   * vocabulary editor for a field somebody fills in at the moment they create
   * the note would be a second page to maintain. The lists that *read* it are
   * where a vocabulary matters, and those offer what the vault already says.
   */
  protected roles = '';

  constructor(
    private readonly deps: NewCompanyDeps,
    initialName = '',
    initialRoles = ''
  ) {
    super(deps.app);
    // Prefilled when the modal was opened from a field somebody had already
    // typed into, which is the common way in.
    this.companyName = initialName;
    // Prefilled when the form that opened this one only offers companies of a
    // given role: a company created there and not carrying it would be missing
    // from the dropdown that asked for it. Still an ordinary editable field,
    // so a company that turns out to be something else is one word away.
    this.roles = initialRoles;
  }

  protected heading(): string {
    return t('crm.newCompany');
  }

  protected override blocker(): string | null {
    return this.companyName.trim() === '' ? t('common.needsTitle') : null;
  }

  /**
   * Whether the note's name is up for editing.
   *
   * False on the edit form. Renaming is Obsidian's operation and it has links
   * to keep in step; a dialog that quietly renamed a file every invoice in the
   * vault points at would be one nobody trusts with a folder.
   */
  protected offersTitle(): boolean {
    return true;
  }

  protected fields(container: HTMLElement): void {
    const rows: [string, () => string, (value: string) => void][] = [
      ...(this.offersTitle()
        ? ([[t('common.name'), () => this.companyName, (v: string) => (this.companyName = v)]] as [
            string,
            () => string,
            (value: string) => void,
          ][])
        : []),
      [t('crm.description'), () => this.description, (v) => (this.description = v)],
      [t('crm.address'), () => this.address, (v) => (this.address = v)],
      [t('crm.website'), () => this.website, (v) => (this.website = v)],
      [t('crm.email'), () => this.email, (v) => (this.email = v)],
    ];
    for (const [name, get, set] of rows) this.text(container, name, get, set);

    const settings = this.deps.getSettings();
    this.select(
      container,
      t('ledger.bookedTo'),
      accountChoices(readAccounts(this.deps.app, settings).map((record) => record.account)),
      () => (this.account === null ? '' : String(this.account)),
      (value) => (this.account = accountValue(value))
    );
    this.select(
      container,
      t('finance.category'),
      [
        ['', t('common.none')],
        ...configuredCategories(settings.expenseCategories).map((id): [string, string] => [
          id,
          categoryLabel(id),
        ]),
      ],
      () => this.category,
      (value) => (this.category = value)
    );
    this.text(
      container,
      t('crm.roles'),
      () => this.roles,
      (value) => (this.roles = value)
    );
    this.toggle(
      container,
      t('crm.paymentProvider'),
      t('crm.paymentProviderHint'),
      () => this.collectsForOthers,
      (value) => (this.collectsForOthers = value)
    );
  }

  /**
   * What this form has to say about a company, as properties.
   *
   * `undefined` for a field left blank, which the creation path drops and the
   * edit path deletes. One definition rather than two, so the two paths cannot
   * disagree about which property a field is called.
   */
  protected properties(settings: NODAtrailSettings): Record<string, unknown> {
    return {
      description: this.description.trim() || undefined,
      address: this.address.trim() || undefined,
      website: this.website.trim() || undefined,
      email: this.email.trim() || undefined,
      [settings.companyAccountProperty]: this.account ?? undefined,
      [settings.companyCategoryProperty]: this.category || undefined,
      [settings.companyPaymentProviderProperty]: this.collectsForOthers || undefined,
      // A list, always, even of one. This one is read by three plugins and a
      // reader that had to cope with both shapes is three chances to cope with
      // them differently.
      [settings.companyRolesProperty]:
        splitRoles(this.roles).length > 0 ? splitRoles(this.roles) : undefined,
    };
  }

  protected async submit(): Promise<void> {
    const settings = this.deps.getSettings();

    const file = await createTypedNote(
      this.deps.app,
      settings,
      {
        folder: settings.companiesFolder,
        title: this.companyName.trim(),
        typeValue: settings.companyTypeValue,
        // Only what was filled in. An empty property on a shared note is one
        // the other two plugins each have to decide how to read.
        properties: Object.fromEntries(
          Object.entries(this.properties(settings)).filter(([, value]) => value !== undefined)
        ),
      },
      this.deps.now()
    );

    new Notice(t('notices.noteCreated', { title: file.basename }));
    this.deps.onCreated(file);
  }
}

/** A comma-separated roles field as the list the note holds. */
export function splitRoles(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}
