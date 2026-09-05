/**
 * The dialog behind "Mark as eaten": when, who, and how it went.
 *
 * Collects and reports. The write belongs to `write-history.ts`, so the one
 * path that touches a note's log stays one path whether the entry came from
 * here or from anywhere else.
 */
import { App, Platform, TFile } from 'obsidian';
import { localDateTimeISO } from '@technosoftware/trail-core';
import { t } from '../../../lang/I18nManager';
import { eligiblePersonTitles } from '../../../crm/persons';
import { addFooterButtons, BaseModal } from '../../../ui/base-modal';
import { renderStarRow } from '../../../ui/star-row';
import type { CULItrailSettings } from '../../../settings/types';

export interface MarkEatenResult {
  date: string;
  note: string;
  personLink?: string;
  rating?: number;
}

export class MarkEatenModal extends BaseModal {
  private date: string;
  private note = '';
  private personTitle = '';
  private rating: number | undefined;

  constructor(
    app: App,
    private readonly file: TFile,
    private readonly settings: CULItrailSettings,
    private readonly onConfirm: (result: MarkEatenResult) => void
  ) {
    super(app);
    this.date = localDateTimeISO();
  }

  getTitle(): string {
    return t('meals.markEaten.title');
  }

  getIcon(): string {
    return 'circle-check-big';
  }

  getSubtitle(): string {
    return this.file.basename;
  }

  renderBody(body: HTMLElement): void {
    this.renderDate(body);
    this.renderPerson(body);
    this.renderRating(body);
    this.renderNote(body);
  }

  renderFooter(footer: HTMLElement): void {
    addFooterButtons(footer, {
      confirmLabel: t('meals.markEaten.confirm'),
      onCancel: () => this.close(),
      onConfirm: () => {
        this.onConfirm({
          date: this.date,
          note: this.note.trim(),
          // A wikilink rather than a bare name, so renaming the person note
          // updates every cook that names them.
          personLink: this.personTitle ? `[[${this.personTitle}]]` : undefined,
          rating: this.rating,
        });
        this.close();
      },
    });
  }

  private field(body: HTMLElement, label: string): HTMLElement {
    const field = body.createDiv({ cls: 'culi-edit-group' });
    field.createEl('label', { cls: 'culi-edit-label', text: label });
    return field;
  }

  private renderDate(body: HTMLElement): void {
    const input = this.field(body, t('meals.markEaten.when')).createEl('input', {
      cls: 'culi-edit-input',
      attr: { type: 'datetime-local' },
    });
    input.value = this.date;
    input.addEventListener('change', () => {
      // An emptied field falls back to now rather than to an invalid record.
      this.date = input.value || localDateTimeISO();
      input.value = this.date;
    });
  }

  private renderPerson(body: HTMLElement): void {
    const titles = eligiblePersonTitles(this.app, this.settings);
    // No People folder, or nobody eligible, means no selector rather than an
    // empty dropdown that looks broken. The entry simply records no person.
    if (titles.length === 0) return;

    const select = this.field(body, t('meals.markEaten.who')).createEl('select', {
      cls: 'culi-edit-input dropdown',
    });
    select.createEl('option', { value: '', text: t('meals.markEaten.nobody') });
    for (const title of titles) select.createEl('option', { value: title, text: title });
    select.addEventListener('change', () => {
      this.personTitle = select.value;
    });
  }

  private renderRating(body: HTMLElement): void {
    renderStarRow(this.field(body, t('meals.markEaten.rating')), 0, {
      hoverPreview: true,
      // Zero is reported as "not rated" rather than as a real 0. Clicking the
      // first star and then clicking it again is how somebody undoes a
      // misclick, and that should leave the field unset.
      onChange: (value) => {
        this.rating = value === 0 ? undefined : value;
      },
    });
  }

  private renderNote(body: HTMLElement): void {
    const input = this.field(body, t('meals.markEaten.note')).createEl('textarea', {
      cls: 'culi-edit-textarea',
      attr: { rows: '4', placeholder: t('meals.markEaten.notePlaceholder') },
    });
    input.addEventListener('input', () => {
      this.note = input.value;
    });

    // Not on a phone: focusing a textarea raises the keyboard over the rest of
    // the dialog, which then looks as though it is not there.
    if (!Platform.isMobile) window.requestAnimationFrame(() => input.focus());
  }
}
