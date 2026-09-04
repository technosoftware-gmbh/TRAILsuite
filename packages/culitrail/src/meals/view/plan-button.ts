/**
 * The calendar button in the meal header.
 *
 * Writes nothing itself. It hands the file back to the plugin, which owns which
 * week and which person a meal would be planned for, so the meal area never
 * has to resolve either.
 *
 * Stateful, because "add this" and "this is already planned" are different
 * questions with different answers. A button that always offered to add would
 * quietly plan a second helping of something already on Thursday.
 */
import { setIcon, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';

export function renderPlanButton(
  container: HTMLElement,
  file: TFile,
  planned: boolean,
  planMeal: (file: TFile) => void,
  openPlan: () => void
): void {
  const button = container.createEl('button', {
    cls: 'culi-action-btn',
    attr: {
      'aria-pressed': String(planned),
      'aria-label': planned ? t('meals.header.onThePlan') : t('meals.header.addToPlan'),
    },
  });
  button.toggleClass('culi-meal-plan-active', planned);
  setIcon(button.createSpan(), planned ? 'calendar-check-2' : 'calendar-plus');

  // Already planned goes to the plan rather than removing the entry. Removal
  // needs to say which day's entry is meant, and this button has no room to ask.
  button.addEventListener('click', () => (planned ? openPlan() : planMeal(file)));
}
