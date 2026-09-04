/**
 * The meal-plan view: one person's week, as seven columns and a queue.
 *
 * It renders from state, and state is a mirror of the notes, so the view
 * syncs the browsed week on open and whenever the week or person changes. It
 * never writes state directly: every change goes through the actions in
 * `meal-plan/actions.ts`, which write the note first.
 */
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { currentWeekTitle } from 'trail-core';
import { t } from '../../lang/I18nManager';
import { toolbarButton } from '../../ui/toolbar';
import { readPersons } from '../../crm/read-crm';
import { eligiblePersons, resolveActivePerson } from '../../crm/persons';
import { renderWeekNav } from '../../ui/week-nav';
import { MEAL_PLAN_VIEW_TYPE } from '../../meals/view-types';
import type { EntryScope } from '../meal-plan/entries';
import type { MealPlanViewDeps } from './deps';
import { WeekPanel } from './week-panel';

export class MealPlanView extends ItemView {
  private unsubscribe: (() => void) | null = null;
  private readonly panel: WeekPanel;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly deps: MealPlanViewDeps
  ) {
    super(leaf);
    this.panel = new WeekPanel(
      this.app,
      {
        getSettings: () => this.deps.getSettings(),
        saveSettings: () => this.deps.saveSettings(),
        openMeal: (path) => this.deps.openMeal(path),
      },
      () => this.render()
    );
  }

  getViewType(): string {
    return MEAL_PLAN_VIEW_TYPE;
  }

  getDisplayText(): string {
    return t('planning.mealPlan.title');
  }

  getIcon(): string {
    return 'calendar';
  }

  onOpen(): Promise<void> {
    this.addAction('pencil', t('planning.mealPlan.openNote'), () => {
      const { week, person } = this.viewScope();
      this.deps.openWeekNote(week, person);
    });

    this.unsubscribe = this.deps.subscribeToChanges(() => this.render());
    this.render();

    // In the background rather than before the first paint: the grid is
    // useful immediately from what state already holds, and the sync fires a
    // change event of its own if it found anything.
    void this.deps.syncWeek(this.viewScope().week);
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    return Promise.resolve();
  }

  /**
   * Whose week is on screen. Both fall back rather than being stored resolved.
   *
   * Not called `scope`: Obsidian's own `View` declares a `scope` member for
   * keyboard handling, and shadowing it with a method is a type error.
   */
  private viewScope(): EntryScope {
    const settings = this.deps.getSettings();
    const eligible = eligiblePersons(readPersons(this.app, settings), settings.eligiblePersonTags);

    return {
      // An empty stored week means the current one, resolved now. Storing the
      // resolved title would mean reopening in January on a week from
      // December.
      week: settings.state.mealPlanViewedWeek || currentWeekTitle(),
      person: resolveActivePerson(eligible, settings.state.mealPlanActivePerson),
    };
  }

  private async setViewedWeek(week: string): Promise<void> {
    this.deps.getSettings().state.mealPlanViewedWeek = week;
    await this.deps.saveSettings();
    await this.deps.syncWeek(week);
    this.render();
  }

  private async setActivePerson(person: string): Promise<void> {
    this.deps.getSettings().state.mealPlanActivePerson = person;
    await this.deps.saveSettings();
    // The new person's note for this week may never have been read.
    await this.deps.syncWeek(this.viewScope().week);
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('culi-meal-plan-view');

    const settings = this.deps.getSettings();
    const scope = this.viewScope();
    const eligible = eligiblePersons(readPersons(this.app, settings), settings.eligiblePersonTags);

    this.renderToolbar(
      contentEl,
      scope,
      eligible.map((person) => person.title)
    );

    this.panel.render(contentEl, scope);
  }

  private renderToolbar(container: HTMLElement, scope: EntryScope, persons: string[]): void {
    const bar = container.createDiv({ cls: ['culi-toolbar', 'culi-mpv-top-bar'] });

    // A vault with no People notes still plans meals, under an empty person.
    // The selector is simply not offered, rather than the view refusing to
    // render, which is what the inherited version does.
    if (persons.length > 0) {
      const select = bar.createEl('select', {
        cls: 'culi-mpv-person-select',
        attr: { 'aria-label': t('planning.mealPlan.person') },
      });
      for (const person of persons) {
        const option = select.createEl('option', { text: person, value: person });
        if (person === scope.person) option.selected = true;
      }
      select.addEventListener('change', () => void this.setActivePerson(select.value));
    }

    renderWeekNav(bar, {
      week: scope.week,
      onChange: (week) => void this.setViewedWeek(week),
    });

    toolbarButton(bar, {
      icon: 'plus',
      label: t('planning.mealPlan.addMeal'),
      onClick: () => this.panel.pickAndAdd(scope, undefined),
    });

    toolbarButton(bar, {
      icon: 'eraser',
      label: t('planning.mealPlan.clearWeek'),
      onClick: () => this.panel.confirmClear(scope),
    });
  }
}
