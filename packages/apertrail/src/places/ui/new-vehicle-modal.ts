/**
 * Creating a ship or a named train.
 *
 * Two fields beyond the title, and deliberately only two: what kind of thing
 * it is, and who runs it. Everything else a vehicle can carry -- when it was
 * built, how many it takes, its cabin catalogue -- is filled in over the
 * months afterwards, which is the same shape a photo spot has and the reason
 * neither collects its list of maps at creation.
 */
import { App, Notice } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { addFooterButtons, BaseModal } from '../../ui/components/modal-shell';
import { createVehicleNote } from '../../vault/create-entities';
import { readCrmBoard } from '../../crm/read-crm';
import { TRIP_LEG_MODES } from '../../trips/trip-note';

export class NewVehicleModal extends BaseModal {
  private mode = '';
  private operatorTitle = '';
  private readonly operators: string[];
  private titleInput!: HTMLInputElement;

  constructor(
    app: App,
    private readonly settings: APERtrailSettings,
    private readonly onCreated?: (path: string) => void
  ) {
    super(app);
    // Offered from the Company notes the vault already has, rather than typed:
    // the operator is a link, and a link somebody typed a second spelling of
    // resolves to nothing.
    this.operators = readCrmBoard(app, settings).companies.map((company) => company.title);
  }

  getTitle(): string {
    return t('modals.newVehicleModal.title');
  }
  getIcon(): string {
    return 'ship';
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
    this.titleInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void this.submit();
      }
    });
    window.setTimeout(() => this.titleInput.focus(), 0);

    const modeField = fields.createDiv({ cls: 'apt-modal-field' });
    modeField.createEl('label', {
      cls: 'apt-modal-field-label',
      text: t('modals.tripEditor.legMode'),
    });
    const modeSelect = modeField.createEl('select', { cls: 'apt-modal-select' });
    modeSelect.createEl('option', { attr: { value: '' }, text: t('modals.common.noneOption') });
    for (const mode of TRIP_LEG_MODES) {
      modeSelect.createEl('option', {
        attr: { value: mode },
        text: t(`modals.tripEditor.mode.${mode}`),
      });
    }
    modeSelect.addEventListener('change', () => {
      this.mode = modeSelect.value;
    });

    const operatorField = fields.createDiv({ cls: 'apt-modal-field' });
    operatorField.createEl('label', {
      cls: 'apt-modal-field-label',
      text: t('modals.newVehicleModal.operatorField'),
    });
    const operatorSelect = operatorField.createEl('select', { cls: 'apt-modal-select' });
    operatorSelect.createEl('option', { attr: { value: '' }, text: t('modals.common.noneOption') });
    for (const operator of this.operators) {
      operatorSelect.createEl('option', { attr: { value: operator }, text: operator });
    }
    operatorSelect.addEventListener('change', () => {
      this.operatorTitle = operatorSelect.value;
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
    try {
      const file = await createVehicleNote(this.app, this.settings, title, {
        mode: this.mode || null,
        operatorTitle: this.operatorTitle || null,
      });
      new Notice(t('modals.newVehicleModal.created', { title }));
      this.onCreated?.(file.path);
      this.close();
      await this.app.workspace.getLeaf('tab').openFile(file);
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('modals.common.createFailed'));
    }
  }
}
