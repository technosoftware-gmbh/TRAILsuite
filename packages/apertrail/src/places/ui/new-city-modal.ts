/**
 * "New city" creation modal -- title plus optional Country and State
 * pickers. The State dropdown lists every configured State regardless of
 * the chosen Country (not filtered/cascading): a flat, dependency-free
 * field list matches every other creation modal here, and a
 * country-filtered State dropdown can be added later if the flat list
 * turns out to be confusing with many countries configured.
 */
import { App, Notice } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { addFooterButtons, BaseModal } from '../../ui/components/modal-shell';
import { readTravelBoard } from '../../vault/read-entities';
import { TravelCountry, TravelState } from '../../vault/types';
import { createCityNote } from '../../vault/create-entities';

export class NewCityModal extends BaseModal {
  private countryTitle = '';
  private stateTitle = '';
  private readonly countries: TravelCountry[];
  private readonly states: TravelState[];
  private titleInput!: HTMLInputElement;

  constructor(
    app: App,
    private readonly settings: APERtrailSettings,
    private readonly onCreated?: (path: string) => void
  ) {
    super(app);
    const board = readTravelBoard(app, settings);
    this.countries = board.countries;
    this.states = board.states;
  }

  getTitle(): string {
    return t('modals.newCityModal.title');
  }
  getIcon(): string {
    return 'building-2';
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

    const stateField = fields.createDiv({ cls: 'apt-modal-field' });
    stateField.createEl('label', {
      cls: 'apt-modal-field-label',
      text: t('modals.common.stateField'),
    });
    const stateSelect = stateField.createEl('select', { cls: 'apt-modal-select' });
    stateSelect.createEl('option', {
      attr: { value: '' },
      text: t('modals.common.noneOption'),
    });
    for (const state of this.states) {
      stateSelect.createEl('option', { attr: { value: state.title }, text: state.title });
    }
    stateSelect.addEventListener('change', () => {
      this.stateTitle = stateSelect.value;
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
    const state = this.states.find((s) => s.title === this.stateTitle) ?? null;
    try {
      const file = await createCityNote(this.app, this.settings, title, country, state);
      new Notice(t('modals.newCityModal.created', { title }));
      this.onCreated?.(file.path);
      this.close();
      await this.app.workspace.getLeaf('tab').openFile(file);
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('modals.common.createFailed'));
    }
  }
}
