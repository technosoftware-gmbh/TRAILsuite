/**
 * Names the copy, and says plainly what a copy is.
 *
 * A dialog rather than a silent "Trip (2)", because the name is the one thing
 * the user always wants to change and the one thing that cannot be changed
 * afterwards without moving a folder.
 *
 * **The note under the box is the point of the dialog.** What a duplicate
 * leaves behind -- the dates, the status, the bookings -- is a decision made
 * for good reasons in `duplicate-trip.ts`, and a user who is not told about it
 * finds out by wondering where their departure date went. It costs three lines
 * and it is the difference between a feature and a surprise.
 */
import { App, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { addFooterButtons, BaseModal } from '../../ui/components/modal-shell';
import { TravelTrip } from '../../vault/types';
import { duplicateTitle } from '../duplicate-trip';
import { duplicateTripNote } from './duplicate-trip';

export class DuplicateTripModal extends BaseModal {
  private titleInput!: HTMLInputElement;

  constructor(
    app: App,
    private readonly settings: APERtrailSettings,
    private readonly trip: TravelTrip,
    private readonly taken: readonly string[],
    private readonly onCreated?: (file: TFile) => void
  ) {
    super(app);
  }

  getTitle(): string {
    return t('trip.duplicateTitle');
  }

  getIcon(): string {
    return 'copy';
  }

  getSubtitle(): string {
    return this.trip.title;
  }

  renderBody(bodyEl: HTMLElement): void {
    const fields = bodyEl.createDiv({ cls: 'apt-modal-fields' });

    const field = fields.createDiv({ cls: 'apt-modal-field' });
    field.createEl('label', { cls: 'apt-modal-field-label', text: t('trip.duplicateNameField') });
    this.titleInput = field.createEl('input', {
      cls: 'apt-modal-input',
      attr: { type: 'text' },
    });
    this.titleInput.value = duplicateTitle(this.trip.title, this.taken);
    this.titleInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void this.submit();
      }
    });

    bodyEl.createEl('p', { cls: 'apt-modal-note', text: t('trip.duplicateWhat') });

    // Selected rather than only focused: the suggested name is a placeholder
    // and typing over it is what somebody is about to do.
    window.setTimeout(() => this.titleInput.select(), 0);
  }

  renderFooter(footerEl: HTMLElement): void {
    addFooterButtons(footerEl, {
      confirmLabel: t('trip.duplicateButton'),
      onCancel: () => this.close(),
      onConfirm: () => void this.submit(),
    });
  }

  private async submit(): Promise<void> {
    const title = this.titleInput.value.trim();
    if (!title) return;

    const file = await duplicateTripNote(this.app, this.settings, this.trip, title);
    // Left open on failure, so a name already taken can be corrected in the box
    // it was typed into rather than by starting again.
    if (!file) return;

    this.close();
    this.onCreated?.(file);
  }
}
