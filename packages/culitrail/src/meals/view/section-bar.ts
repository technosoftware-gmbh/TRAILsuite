/**
 * The row of buttons under a meal that open something in a modal.
 *
 * Shared so the eating-history chip and the trailing-section buttons land in
 * one row rather than two: they are the same thing to a reader, a titled
 * piece of the note that is not part of eating it.
 */
import { setIcon } from 'obsidian';

/** Creates the bar, or returns the one already there, so two callers fill one row. */
export function sectionBar(container: HTMLElement): HTMLElement {
  const existing = container.querySelector<HTMLElement>(':scope > .culi-section-sidebar');
  return existing ?? container.createDiv({ cls: 'culi-section-sidebar' });
}

export function sectionButton(
  bar: HTMLElement,
  options: {
    icon: string;
    label: string;
    count?: number;
    /**
     * Accents the button. Reserved for the eating history, which is a feature of
     * the plugin rather than whatever heading a note happened to carry, so it
     * should not look like one of the note's own sections.
     */
    history?: boolean;
    onClick: () => void;
  }
): HTMLElement {
  const button = bar.createEl('button', { cls: 'culi-sidebar-btn' });
  if (options.history) button.addClass('culi-sidebar-btn--history');
  setIcon(button.createSpan({ cls: 'culi-sidebar-btn-icon' }), options.icon);
  button.createSpan({ cls: 'culi-sidebar-btn-label', text: options.label });

  // A count of zero is left off rather than shown as a 0 pill: the chip is
  // offered whenever the feature is on, and "0" reads as a broken counter
  // where an absent pill reads as nothing logged yet.
  if (options.count) {
    button.createSpan({ cls: 'culi-sidebar-btn-badge', text: String(options.count) });
  }

  button.addEventListener('click', options.onClick);
  return button;
}
