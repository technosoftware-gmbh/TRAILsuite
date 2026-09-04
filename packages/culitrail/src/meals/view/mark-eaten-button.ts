/**
 * The "Mark as eaten" button in the meal header.
 *
 * Opens the dialog through the plugin rather than constructing it here, for the
 * same reason the plan button does: the meal view should not know which
 * people the vault has or where an attachment goes.
 */
import { setIcon, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';

export function renderMarkEatenButton(
  container: HTMLElement,
  file: TFile,
  enabled: boolean,
  markEaten: (file: TFile) => void
): void {
  // Nothing to record into when the feature is off, so the button is absent
  // rather than present and inert.
  if (!enabled) return;

  const button = container.createEl('button', {
    cls: 'culi-action-btn',
    attr: { 'aria-label': t('meals.header.markEaten') },
  });
  setIcon(button.createSpan(), 'circle-check-big');
  button.addEventListener('click', () => markEaten(file));
}
