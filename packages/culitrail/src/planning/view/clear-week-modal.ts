/** "Clear this week?", and the count of what is about to go. */
import { App } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { addFooterButtons, BaseModal } from '../../ui/base-modal';

export class ClearWeekModal extends BaseModal {
  constructor(
    app: App,
    private readonly count: number,
    private readonly onConfirm: () => void
  ) {
    super(app);
  }

  getTitle(): string {
    return t('planning.mealPlan.clearWeek');
  }

  getIcon(): string {
    return 'eraser';
  }

  renderBody(body: HTMLElement): void {
    body.createEl('p', { text: t('planning.mealPlan.confirmClear', { count: this.count }) });
  }

  renderFooter(footer: HTMLElement): void {
    addFooterButtons(footer, {
      confirmLabel: t('planning.mealPlan.clearWeek'),
      destructive: true,
      onCancel: () => this.close(),
      onConfirm: () => {
        this.onConfirm();
        this.close();
      },
    });
  }
}
