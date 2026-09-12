/**
 * A Person note, made from NODAtrail.
 *
 * The sibling of `new-company-modal.ts`, and it exists for the same reason: an
 * account can name the person it belongs to, and until now the only answer
 * available was one somebody had already written by hand somewhere else.
 *
 * **The note format is the suite's, not this plugin's.** Person notes are
 * shared by all three plugins and owned by none, so a field left blank is left
 * out rather than written empty, and nothing here touches a field the shared
 * contract names -- `type` and `tags` are the contract's, and tags in
 * particular are left to Obsidian's own property editor, which handles a list
 * better than a text box would.
 *
 * **Three ways to reach somebody, because the vault already keeps three.** The
 * person notes this was written against carry `private`, `work` and `mobile`
 * separately, and a single "phone" field would have to pick one of them to
 * write into and would silently ignore the other two on the way back in.
 */
import { App, Notice, TFile } from 'obsidian';
import { t } from '../lang/I18nManager';
import { splitRoles } from './new-company-modal';
import { FormModal } from '../ui/modals/form-modal';
import type { NODAtrailSettings } from '../settings/types';
import { createTypedNote } from '../vault/create-note';

export interface NewPersonDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  now: () => Date;
  /** Handed the new note, so a caller that asked for a person can use it at once. */
  onCreated: (file: TFile) => void;
}

export class NewPersonModal extends FormModal {
  // Protected for the same reason as on the company form: the edit dialog is
  // this dialog with the title turned off and the submit rerouted.
  protected personName: string;
  protected description = '';
  protected address = '';
  protected email = '';
  protected mobile = '';
  protected privatePhone = '';
  protected workPhone = '';
  /**
   * What this person is to the household: `vendor`, `customer`.
   *
   * The same field a company has, for the same reason. A person can send an
   * invoice as readily as a company can, and a household that classifies its
   * companies and not its people has classified half its CRM.
   */
  protected roles = '';

  constructor(
    private readonly deps: NewPersonDeps,
    initialName = ''
  ) {
    super(deps.app);
    // Prefilled when the modal was opened from a field somebody had already
    // typed into, which is the common way in.
    this.personName = initialName;
  }

  protected heading(): string {
    return t('crm.newPerson');
  }

  protected override blocker(): string | null {
    return this.personName.trim() === '' ? t('common.needsTitle') : null;
  }

  /** False on the edit form: renaming is Obsidian's operation, with links to keep in step. */
  protected offersTitle(): boolean {
    return true;
  }

  protected fields(container: HTMLElement): void {
    const rows: [string, () => string, (value: string) => void][] = [
      ...(this.offersTitle()
        ? ([[t('common.name'), () => this.personName, (v: string) => (this.personName = v)]] as [
            string,
            () => string,
            (value: string) => void,
          ][])
        : []),
      [t('crm.description'), () => this.description, (v) => (this.description = v)],
      [t('crm.address'), () => this.address, (v) => (this.address = v)],
      [t('crm.email'), () => this.email, (v) => (this.email = v)],
      [t('crm.mobile'), () => this.mobile, (v) => (this.mobile = v)],
      [t('crm.phonePrivate'), () => this.privatePhone, (v) => (this.privatePhone = v)],
      [t('crm.phoneWork'), () => this.workPhone, (v) => (this.workPhone = v)],
      [t('crm.roles'), () => this.roles, (v) => (this.roles = v)],
    ];
    for (const [name, get, set] of rows) this.text(container, name, get, set);
  }

  /**
   * What this form has to say about a person, as properties.
   *
   * `undefined` for a field left blank, which the creation path drops and the
   * edit path deletes. One definition rather than two.
   */
  protected properties(settings: NODAtrailSettings): Record<string, unknown> {
    return {
      description: this.description.trim() || undefined,
      address: this.address.trim() || undefined,
      email: this.email.trim() || undefined,
      mobile: this.mobile.trim() || undefined,
      private: this.privatePhone.trim() || undefined,
      work: this.workPhone.trim() || undefined,
      // A list, always, even of one. Three plugins read this and a reader that
      // had to cope with both shapes is three chances to cope differently.
      [settings.personRolesProperty]:
        splitRoles(this.roles).length > 0 ? splitRoles(this.roles) : undefined,
    };
  }

  protected async submit(): Promise<void> {
    const settings = this.deps.getSettings();

    const file = await createTypedNote(
      this.deps.app,
      settings,
      {
        folder: settings.personsFolder,
        title: this.personName.trim(),
        typeValue: settings.personTypeValue,
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
