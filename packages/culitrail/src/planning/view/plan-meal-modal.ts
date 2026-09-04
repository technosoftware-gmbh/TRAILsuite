/**
 * Planning one meal from outside the meal-plan view.
 *
 * The meal-plan view picks a meal for a day it already knows. This is the
 * other direction: the meal is known and the day is not, which is what a
 * cook reading a meal and deciding to make it on Thursday needs.
 *
 * The week and the person are shown rather than chosen. They are the ones the
 * meal-plan view is set to, and a second place to change them would be a
 * second answer to "whose plan am I looking at".
 */
import { App } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { MEAL_SLOT_KEYS, WEEKDAY_KEYS, mealSlotLabel, weekdayLabel } from '../../lang/vocabulary';
import { addFooterButtons, BaseModal } from '../../ui/base-modal';
import type { EntryScope } from '../meal-plan/entries';

export interface PlannedSlot {
  /** A weekday key, or undefined for the queue: a meal planned for the week but not for a day. */
  day: string | undefined;
  meal: string | undefined;
}

export class PlanMealModal extends BaseModal {
  private day: string | undefined;
  private meal: string | undefined;

  constructor(
    app: App,
    private readonly mealTitle: string,
    /**
     * Not called `scope`: Obsidian's own `Modal` declares a `scope` member for
     * keyboard handling, and narrowing it to something else is a type error.
     */
    private readonly planScope: EntryScope,
    private readonly onConfirm: (slot: PlannedSlot) => void
  ) {
    super(app);
  }

  getTitle(): string {
    return t('planning.planMeal.title', { name: this.mealTitle });
  }

  getIcon(): string {
    return 'calendar-plus';
  }

  renderBody(body: HTMLElement): void {
    body.createDiv({
      cls: 'culi-mpv-plan-scope',
      text: this.planScope.person
        ? t('planning.planMeal.scopeWithPerson', {
            week: this.planScope.week,
            person: this.planScope.person,
          })
        : t('planning.planMeal.scope', { week: this.planScope.week }),
    });

    this.renderChoice(
      body,
      t('planning.planMeal.day'),
      // The queue first, because it is the default: somebody who knows the
      // day picks it, and somebody who does not should not have to.
      [{ value: '', label: t('planning.planMeal.queue') }].concat(
        WEEKDAY_KEYS.map((key) => ({ value: key, label: weekdayLabel(key) }))
      ),
      (value) => (this.day = value || undefined)
    );

    this.renderChoice(
      body,
      t('planning.planMeal.meal'),
      [{ value: '', label: t('planning.planMeal.noSlot') }].concat(
        MEAL_SLOT_KEYS.map((key) => ({ value: key, label: mealSlotLabel(key) }))
      ),
      (value) => (this.meal = value || undefined)
    );
  }

  private renderChoice(
    body: HTMLElement,
    label: string,
    options: { value: string; label: string }[],
    onChange: (value: string) => void
  ): void {
    const row = body.createDiv({ cls: 'culi-mpv-plan-row' });
    row.createSpan({ cls: 'culi-mpv-plan-label', text: label });

    const select = row.createEl('select', {
      cls: 'culi-mpv-plan-select',
      attr: { 'aria-label': label },
    });
    for (const option of options) {
      select.createEl('option', { text: option.label, value: option.value });
    }
    select.addEventListener('change', () => onChange(select.value));
  }

  renderFooter(footer: HTMLElement): void {
    addFooterButtons(footer, {
      confirmLabel: t('planning.planMeal.confirm'),
      onCancel: () => this.close(),
      onConfirm: () => {
        this.onConfirm({ day: this.day, meal: this.meal });
        this.close();
      },
    });
  }
}
