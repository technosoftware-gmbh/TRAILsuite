/**
 * "New country" creation modal -- title only. Capital/States are wikilink
 * relationships that normally point at notes created *after* the country
 * (you create the Country first, then its Capital City and States, then
 * link them back), so there's nothing meaningful to pick at creation time --
 * matches createCountryNote()'s own optional capital/states params, both
 * left unset here.
 */
import { App, Notice } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { addFooterButtons, BaseModal } from '../../ui/components/modal-shell';
import { createCountryNote } from '../../vault/create-entities';

export class NewCountryModal extends BaseModal {
  private titleInput!: HTMLInputElement;

  constructor(
    app: App,
    private readonly settings: APERtrailSettings,
    private readonly onCreated?: (path: string) => void
  ) {
    super(app);
  }

  getTitle(): string {
    return t('modals.newCountryModal.title');
  }
  getIcon(): string {
    return 'flag';
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
      const file = await createCountryNote(this.app, this.settings, title);
      new Notice(t('modals.newCountryModal.created', { title }));
      this.onCreated?.(file.path);
      this.close();
      await this.app.workspace.getLeaf('tab').openFile(file);
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('modals.common.createFailed'));
    }
  }
}
