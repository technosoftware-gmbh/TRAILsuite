/**
 * The creation forms, over CRM notes that already exist.
 *
 * A company's account changes the day a shop moves its collection to a payment
 * provider; a category is decided after the first invoice rather than before
 * it; a person gets a new number. Obsidian's own property editor can change all
 * of it, and asking somebody to remember that `paymentProvider` is spelt that
 * way, and that an account is a number and not a link, is asking them to know
 * this plugin's private spelling in order to correct their own note.
 *
 * Each is the creation form with the title turned off and the submit rerouted,
 * rather than a second copy of the same fields that drifts from the first one
 * the day either is touched. The same arrangement as `edit-money-modals.ts`,
 * and for the same reason.
 *
 * **Blanking a field removes the property.** Not "writes an empty string": the
 * creation form leaves a blank field out entirely, and an edit that left
 * `email:` behind with nothing after it would produce notes shaped differently
 * depending on which dialog last touched them. Removing is also the only way to
 * take back a payment-provider flag, which is a thing somebody will want to do
 * the first time they set it on the wrong company.
 */
import { App, Notice, TFile } from 'obsidian';
import { readString, readStringList } from '@technosoftware/trail-core';
import { t } from '../lang/I18nManager';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';
import { readsAsYes } from './company-defaults';
import { NewCompanyModal } from './new-company-modal';
import { NewPersonModal } from './new-person-modal';

export interface EditCrmDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  now: () => Date;
  onSaved: () => void;
}

/** The note being edited: the file, and what it says now. */
export interface CrmNote {
  file: TFile;
  title: string;
  frontmatter: Record<string, unknown>;
}

function creationDeps(deps: EditCrmDeps) {
  return {
    app: deps.app,
    getSettings: deps.getSettings,
    now: deps.now,
    onCreated: () => deps.onSaved(),
  };
}

/**
 * Writes the properties this form owns, and removes the ones it blanked.
 *
 * Every other key on the note is left exactly as it was, which is the whole
 * contract for a note three plugins share: this one may say what it knows and
 * must not have an opinion about the rest.
 */
async function applyEdits(
  app: App,
  file: TFile,
  properties: Record<string, unknown>
): Promise<void> {
  await hostFor(app).frontmatter.process(file, (frontmatter) => {
    for (const [key, value] of Object.entries(properties)) {
      if (value === undefined) delete frontmatter[key];
      else frontmatter[key] = value;
    }
  });
}

/** A frontmatter value as a text field wants it: a string, and never `undefined`. */
function text(frontmatter: Record<string, unknown>, key: string): string {
  return readString(frontmatter[key]) ?? '';
}

export class EditCompanyModal extends NewCompanyModal {
  constructor(
    private readonly editDeps: EditCrmDeps,
    private readonly note: CrmNote
  ) {
    super(creationDeps(editDeps), note.title);
    const settings = editDeps.getSettings();
    const fm = note.frontmatter;

    this.description = text(fm, 'description');
    this.address = text(fm, 'address');
    this.website = text(fm, 'website');
    this.email = text(fm, 'email');

    const account = Number(fm[settings.companyAccountProperty]);
    this.account = Number.isFinite(account) && account > 0 ? account : null;
    this.category = text(fm, settings.companyCategoryProperty);
    // Read on the same loose terms it is written and read everywhere else: a
    // property editor writes `true`, a person types `yes`, and only an explicit
    // no is a no.
    this.collectsForOthers = readsAsYes(fm[settings.companyPaymentProviderProperty]);
    this.roles = readStringList(fm[settings.companyRolesProperty]).join(', ');
  }

  protected override heading(): string {
    return `${t('crm.editCompany')}: ${this.note.title}`;
  }

  protected override offersTitle(): boolean {
    return false;
  }

  protected override async submit(): Promise<void> {
    await applyEdits(
      this.editDeps.app,
      this.note.file,
      this.properties(this.editDeps.getSettings())
    );
    new Notice(t('notices.noteUpdated', { title: this.note.title }));
    this.editDeps.onSaved();
  }
}

export class EditPersonModal extends NewPersonModal {
  constructor(
    private readonly editDeps: EditCrmDeps,
    private readonly note: CrmNote
  ) {
    super(creationDeps(editDeps), note.title);
    const fm = note.frontmatter;

    this.description = text(fm, 'description');
    this.address = text(fm, 'address');
    this.email = text(fm, 'email');
    this.mobile = text(fm, 'mobile');
    this.privatePhone = text(fm, 'private');
    this.workPhone = text(fm, 'work');
    this.roles = readStringList(fm[editDeps.getSettings().personRolesProperty]).join(', ');
  }

  protected override heading(): string {
    return `${t('crm.editPerson')}: ${this.note.title}`;
  }

  protected override offersTitle(): boolean {
    return false;
  }

  protected override async submit(): Promise<void> {
    await applyEdits(
      this.editDeps.app,
      this.note.file,
      this.properties(this.editDeps.getSettings())
    );
    new Notice(t('notices.noteUpdated', { title: this.note.title }));
    this.editDeps.onSaved();
  }
}
