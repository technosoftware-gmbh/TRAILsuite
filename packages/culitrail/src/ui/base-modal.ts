/**
 * The modal shell every CULItrail modal is built on: sticky header, scrollable
 * body, sticky footer.
 *
 * An abstract class rather than a helper function on purpose. A concrete modal
 * receives `body` and `footer` as parameters and never sees `contentEl`, so it
 * cannot put content in the wrong region even by accident. `onOpen()` here is
 * the only code in the plugin that builds the outer structure, which is what
 * keeps twenty modals looking like one plugin.
 */
import { Modal, setIcon } from 'obsidian';
import { t } from '../lang/I18nManager';

export abstract class BaseModal extends Modal {
  /** Protected so a multi-stage modal can retitle itself as it advances. */
  protected shellTitleEl!: HTMLElement;

  /** The text shown in the header. */
  abstract getTitle(): string;

  /** Fills the scrollable body. May be async; the footer is already up by then. */
  abstract renderBody(body: HTMLElement): void | Promise<void>;

  /** Fills the sticky footer. A modal that saves as you type implements this empty. */
  abstract renderFooter(footer: HTMLElement): void;

  /** An optional Lucide icon shown left of the title. */
  getIcon(): string | undefined {
    return undefined;
  }

  /** An optional line of explanation under the title. */
  getSubtitle(): string | undefined {
    return undefined;
  }

  /**
   * Extra classes for `modalEl`, the dialog container, for a modal that needs
   * its own sizing.
   *
   * **`modalEl`, not `contentEl`**, and the distinction is the whole reason this
   * hook is documented at this length. `contentEl` is the box inside the dialog;
   * widening it does not widen the dialog, so the content simply overflows and
   * the modal gains a horizontal scrollbar with its right-hand fields cut off.
   * The meal editor shipped exactly that. A width belongs on the container.
   */
  getModalClasses(): string[] {
    return [];
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('culi-modal');
    this.modalEl.addClasses(this.getModalClasses());

    const header = contentEl.createDiv({ cls: 'culi-modal-header' });
    const icon = this.getIcon();
    if (icon) setIcon(header.createSpan({ cls: 'culi-modal-icon' }), icon);
    this.shellTitleEl = header.createEl('h2', { cls: 'culi-modal-title', text: this.getTitle() });
    const subtitle = this.getSubtitle();
    if (subtitle) header.createEl('p', { cls: 'culi-modal-subtitle', text: subtitle });

    const body = contentEl.createDiv({ cls: 'culi-modal-body' });
    const footer = contentEl.createDiv({ cls: 'culi-modal-footer' });

    // The footer goes up first and synchronously, so Cancel is reachable even
    // while an async body is still loading. A modal that cannot be dismissed
    // during a slow vault read is the failure this ordering prevents.
    this.renderFooter(footer);
    void this.renderBody(body);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export interface FooterButtonOptions {
  cancelLabel?: string;
  confirmLabel: string;
  /** Gives the primary button `mod-warning` instead of `mod-cta`. */
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Adds the standard Cancel-then-primary button pair to a footer.
 *
 * Cancel comes first, and the primary action carries Obsidian's own `mod-cta`
 * or `mod-warning` rather than colour of our own, so the pair matches every
 * other dialog in the app. Returns the primary button, which callers disable
 * while validating or while a write is in flight.
 */
export function addFooterButtons(
  footer: HTMLElement,
  options: FooterButtonOptions
): HTMLButtonElement {
  footer
    .createEl('button', {
      cls: 'culi-modal-cancel',
      text: options.cancelLabel ?? t('ui.modal.cancel'),
    })
    .addEventListener('click', options.onCancel);

  const confirm = footer.createEl('button', {
    cls: options.destructive ? 'mod-warning' : 'mod-cta',
    text: options.confirmLabel,
  });
  confirm.addEventListener('click', options.onConfirm);
  return confirm;
}
