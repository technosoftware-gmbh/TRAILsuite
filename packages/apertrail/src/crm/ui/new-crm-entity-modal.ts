/**
 * Shared creation modal for Person and Company. The two differ only in
 * which contact fields they collect and which create function they call, so
 * this is one parameterized class rather than two near-identical files --
 * mirroring places/ui/new-place-modal.ts, which made the same trade for the
 * five place types.
 *
 * Everything past the title is optional. A person you just met is worth a
 * note before you have their address, and the note is a note: whatever this
 * modal does not collect is typed into the file afterwards.
 */
import { App, Notice } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { addFooterButtons, BaseModal } from '../../ui/components/modal-shell';
import { CrmEntityType } from '../entity-types';
import { createCompanyNote, createPersonNote } from '../create-crm';
import { crmTagValues, readCrmBoard } from '../read-crm';

const TITLE_KEY: Record<CrmEntityType, string> = {
  person: 'modals.newPersonModal.title',
  company: 'modals.newCompanyModal.title',
};

const CREATED_KEY: Record<CrmEntityType, string> = {
  person: 'modals.newPersonModal.created',
  company: 'modals.newCompanyModal.created',
};

const ICON: Record<CrmEntityType, string> = {
  person: 'user',
  company: 'building-2',
};

/** The id the tags input points its `list` attribute at. One modal is open at a time, so a constant is enough. */
const TAG_SUGGESTIONS_ID = 'apt-crm-tag-suggestions';

/** A contact field: which key it fills on the create call, and its label. */
interface CrmField {
  key: 'email' | 'mobile' | 'phone' | 'website' | 'address';
  label: string;
}

export class NewCrmEntityModal extends BaseModal {
  private titleInput!: HTMLInputElement;
  private tagsInput!: HTMLInputElement;
  private readonly fieldInputs = new Map<CrmField['key'], HTMLInputElement>();
  private readonly knownTags: string[];

  constructor(
    app: App,
    private readonly settings: APERtrailSettings,
    private readonly kind: CrmEntityType,
    private readonly onCreated?: (path: string) => void
  ) {
    super(app);
    // Read once, at construction: the modal is short-lived and nothing can
    // add a CRM note while it is open.
    this.knownTags = crmTagValues(readCrmBoard(app, settings));
  }

  getTitle(): string {
    return t(TITLE_KEY[this.kind]);
  }
  getIcon(): string {
    return ICON[this.kind];
  }
  /**
   * Built here rather than as a module constant so every label is a literal
   * translation call the key scanner can see, and so none of them resolve
   * before the catalogue is loaded. (Writing the call out as an example in
   * a comment would itself register as a key: the scanner reads raw
   * source.)
   */
  private fields(): CrmField[] {
    if (this.kind === 'person') {
      return [
        { key: 'email', label: t('modals.crm.emailField') },
        { key: 'mobile', label: t('modals.crm.mobileField') },
        { key: 'address', label: t('modals.crm.addressField') },
      ];
    }
    return [
      { key: 'website', label: t('modals.crm.websiteField') },
      { key: 'email', label: t('modals.crm.emailField') },
      { key: 'phone', label: t('modals.crm.phoneField') },
      { key: 'address', label: t('modals.crm.addressField') },
    ];
  }

  private renderTextField(
    fields: HTMLElement,
    label: string,
    attr: Record<string, string> = {}
  ): HTMLInputElement {
    const field = fields.createDiv({ cls: 'apt-modal-field' });
    field.createEl('label', { cls: 'apt-modal-field-label', text: label });
    const input = field.createEl('input', {
      cls: 'apt-modal-input',
      attr: { type: 'text', ...attr },
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void this.submit();
      }
    });
    return input;
  }

  renderBody(bodyEl: HTMLElement): void {
    const fields = bodyEl.createDiv({ cls: 'apt-modal-fields' });

    this.titleInput = this.renderTextField(fields, t('modals.common.titleField'));
    window.setTimeout(() => this.titleInput.focus(), 0);

    // A datalist rather than a dropdown: the tags this vault already uses
    // are suggestions, not the whole vocabulary, and the third spelling of
    // "Friends" is what this is here to prevent.
    this.tagsInput = this.renderTextField(fields, t('modals.crm.tagsField'), {
      placeholder: t('modals.crm.tagsPlaceholder'),
      list: TAG_SUGGESTIONS_ID,
    });
    const suggestions = fields.createEl('datalist', { attr: { id: TAG_SUGGESTIONS_ID } });
    for (const tag of this.knownTags) suggestions.createEl('option', { attr: { value: tag } });

    for (const field of this.fields()) {
      this.fieldInputs.set(field.key, this.renderTextField(fields, field.label));
    }
  }

  renderFooter(footerEl: HTMLElement): void {
    addFooterButtons(footerEl, {
      confirmLabel: t('modals.common.create'),
      onCancel: () => this.close(),
      onConfirm: () => void this.submit(),
    });
  }

  private valueOf(key: CrmField['key']): string {
    return this.fieldInputs.get(key)?.value ?? '';
  }

  private tags(): string[] {
    return this.tagsInput.value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag !== '');
  }

  private async submit(): Promise<void> {
    const title = this.titleInput.value.trim();
    if (!title) {
      new Notice(t('modals.common.titleRequired'));
      return;
    }
    try {
      const file =
        this.kind === 'person'
          ? await createPersonNote(this.app, this.settings, {
              title,
              tags: this.tags(),
              email: this.valueOf('email'),
              mobile: this.valueOf('mobile'),
              address: this.valueOf('address'),
            })
          : await createCompanyNote(this.app, this.settings, {
              title,
              tags: this.tags(),
              website: this.valueOf('website'),
              email: this.valueOf('email'),
              phone: this.valueOf('phone'),
              address: this.valueOf('address'),
            });
      new Notice(t(CREATED_KEY[this.kind], { title }));
      this.onCreated?.(file.path);
      this.close();
      await this.app.workspace.getLeaf('tab').openFile(file);
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('modals.common.createFailed'));
    }
  }
}
