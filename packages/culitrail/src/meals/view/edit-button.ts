/**
 * The pencil in the meal header, which opens the staged editor.
 *
 * In the banner as well as in the pane menu. The pane menu is where Obsidian
 * users look for a command; the banner is where somebody reading a meal they
 * have just spotted a mistake in looks for one.
 */
import { setIcon, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';

export function renderEditButton(
  container: HTMLElement,
  file: TFile,
  editMeal: (file: TFile) => void
): void {
  const button = container.createEl('button', {
    cls: 'culi-action-btn',
    attr: { 'aria-label': t('meals.header.editMeal') },
  });
  setIcon(button.createSpan(), 'pencil');
  button.addEventListener('click', () => editMeal(file));
}
