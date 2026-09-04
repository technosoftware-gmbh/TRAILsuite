/**
 * "New state" creation modal -- title plus an optional Country picker.
 * Picking no country creates the note without a `country:` wikilink; only
 * the title is required.
 */
import { App, Notice } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { addFooterButtons, BaseModal } from '../../ui/components/modal-shell';
import { readTravelBoard } from '../../vault/read-entities';
import { TravelCountry } from '../../vault/types';
import { createStateNote } from '../../vault/create-entities';

export class NewStateModal extends BaseModal {
  private countryTitle = '';
  private readonly countries: TravelCountry[];
  private titleInput!: HTMLInputElement;

  constructor(
    app: App,
    private readonly settings: APERtrailSettings,
    private readonly onCreated?: (path: string) => void
  ) {
    super(app);
    this.countries = readTravelBoard(app, settings).countries;
  }

  getTitle(): string {
    return t('modals.newStateModal.title');
  }
  getIcon(): string {
    return 'map';
  }
  renderBody(bodyEl: HTMLElement): void {
    const fields = bodyEl.createDiv({ cls: 'apt-modal-fields' });

    const titleField = fields.createDiv({ cls: 'apt-modal-field' });
    titleField.createEl('label', {
      cls: 'apt-modal-field-label',
      text: t('modals.common.titleField'),
    });
    this.titleInput = titleField.createEl('input', {
      cls: 'apt-modal-input',
      attr: { type: 'text' },
    });
    this.titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void this.submit();
      }
    });
    window.setTimeout(() => this.titleInput.focus(), 0);

    const countryField = fields.createDiv({ cls: 'apt-modal-field' });
    countryField.createEl('label', {
      cls: 'apt-modal-field-label',
      text: t('modals.common.countryField'),
    });
    const countrySelect = countryField.createEl('select', { cls: 'apt-modal-select' });
    countrySelect.createEl('option', {
      attr: { value: '' },
      text: t('modals.common.noneOption'),
    });
    for (const country of this.countries) {
      countrySelect.createEl('option', { attr: { value: country.title }, text: country.title });
    }
    countrySelect.addEventListener('change', () => {
      this.countryTitle = countrySelect.value;
    });
  }

  renderFooter(footerEl: HTMLElement): void {
    addFooterButtons(footerEl, {
      confirmLabel: t('modals.common.create'),
      onCancel: () => this.close(),
      onConfirm: () => void this.submit(),
    });
  }

  private async submit(): Promise<void> {
    const title = this.titleInput.value.trim();
    if (!title) {
      new Notice(t('modals.common.titleRequired'));
      return;
    }
    const country = this.countries.find((c) => c.title === this.countryTitle) ?? null;
    try {
      const file = await createStateNote(this.app, this.settings, title, country);
      new Notice(t('modals.newStateModal.created', { title }));
      this.onCreated?.(file.path);
      this.close();
      await this.app.workspace.getLeaf('tab').openFile(file);
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('modals.common.createFailed'));
    }
  }
}
