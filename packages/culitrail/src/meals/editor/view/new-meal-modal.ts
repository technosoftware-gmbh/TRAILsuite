/**
 * The one question a meal has to answer before it can exist: what is it called.
 *
 * **A separate dialog from the editor, and only one field wide.** The editor
 * edits a note; this makes one. Folding the two together would mean the editor
 * carrying a "does this file exist yet" flag through every field it draws, and
 * a save that sometimes creates and sometimes does not. Two small things beat
 * one thing with a mode.
 *
 * **The note is created before the editor opens, not after it saves.** So
 * closing the editor without saving leaves a real, empty meal rather than
 * nothing at all, which is what "create" was asked to do. The alternative is a
 * dialog that quietly does nothing when dismissed, and somebody wondering where
 * their meal went.
 */
import { App, Notice, TFile } from 'obsidian';
import { t } from '../../../lang/I18nManager';
import { addFooterButtons, BaseModal } from '../../../ui/base-modal';
import type { CULItrailSettings } from '../../../settings/types';
import { createMealNote } from '../create-meal';
import { fieldLabel } from './fields';

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : JSON.stringify(error);
}

export class NewMealModal extends BaseModal {
  private title = '';
  private input: HTMLInputElement | null = null;
  private createButton: HTMLButtonElement | null = null;

  constructor(
    app: App,
    private readonly settings: CULItrailSettings,
    /** Handed the note that was made, so the caller can open the editor on it. */
    private readonly onCreated: (file: TFile) => void
  ) {
    super(app);
  }

  getTitle(): string {
    return t('meals.create.title');
  }

  getIcon(): string {
    return 'utensils-crossed';
  }

  getSubtitle(): string {
    return t('meals.create.subtitle');
  }

  renderBody(body: HTMLElement): void {
    const group = body.createDiv({ cls: 'culi-edit-group' });
    fieldLabel(group, t('meals.create.name'));

    const input = group.createEl('input', { cls: 'culi-edit-input', attr: { type: 'text' } });
    input.placeholder = t('meals.create.namePlaceholder');
    input.addEventListener('input', () => {
      this.title = input.value;
      this.refresh();
    });
    // Enter is how somebody finishes a one-field dialog, and reaching for the
    // mouse to confirm a name they have just typed is a step nobody wants.
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && this.title.trim()) void this.create();
    });

    this.input = input;
    window.setTimeout(() => input.focus(), 0);
  }

  renderFooter(footer: HTMLElement): void {
    this.createButton = addFooterButtons(footer, {
      confirmLabel: t('meals.create.create'),
      onConfirm: () => void this.create(),
      onCancel: () => this.close(),
    });
    this.refresh();
  }

  /** Create stays out of reach until there is a name, since that is the whole input. */
  private refresh(): void {
    if (this.createButton) this.createButton.disabled = this.title.trim() === '';
  }

  private async create(): Promise<void> {
    const name = this.title.trim();
    if (!name) return;

    if (this.createButton) this.createButton.disabled = true;

    try {
      const file = await createMealNote(this.app, this.settings, name);
      this.close();
      this.onCreated(file);
    } catch (error) {
      new Notice(t('meals.create.failed', { error: describe(error) }));
      this.refresh();
      this.input?.focus();
    }
  }
}
