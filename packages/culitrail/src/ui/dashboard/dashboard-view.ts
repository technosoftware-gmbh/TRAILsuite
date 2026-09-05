/**
 * The dashboard: what is being eaten, what the library looks like, and what is
 * planned for the week.
 *
 * Every card is a summary with a way through to the view that owns the data,
 * because a second place to edit something is a second place for it to
 * disagree with the notes. The orders card was the exception and is gone: a
 * three-row preview of a record that is searched rather than skimmed earned
 * less than the width it took, and the top bar reaches the orders view in one
 * click.
 *
 * Laid out as one twelve-column grid rather than nested rows, so column
 * arithmetic lives in one place.
 */
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { currentWeekTitle } from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import { buildGalleryEntries } from '../../meals/gallery/build-entries';
import type { GalleryEntry } from '../../meals/view-model/gallery-entry';
import { DASHBOARD_VIEW_TYPE } from '../../meals/view-types';
import { renderActivitySection } from './activity-section';
import { renderGreeting } from './greeting';
import { renderLibrarySection } from './library-section';
import { renderNewMealsCard } from './new-meals-card';
import { renderQuickActions } from './quick-actions';
import { dashboardGrid } from './section';
import { renderTodaySection } from './today-section';
import type { DashboardViewDeps } from './deps';

export class DashboardView extends ItemView {
  private unsubscribe: (() => void) | null = null;

  /**
   * Guards against two renders overlapping.
   *
   * The grocery half of a render reads a note, so a render is asynchronous, and
   * metadata changes arrive in bursts. Without this a burst paints the view
   * several times and a later paint can finish first.
   */
  private rendering = false;
  private renderAgain = false;

  /**
   * Bumped on every paint and on close.
   *
   * The new-meals strip resolves pictures asynchronously after its cards are
   * on screen. Comparing against the generation it started in is how that pass
   * knows to stop writing into DOM a later paint has already replaced.
   */
  private generation = 0;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly deps: DashboardViewDeps
  ) {
    super(leaf);
    this.navigation = true;
  }

  getViewType(): string {
    return DASHBOARD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return t('dashboard.title');
  }

  getIcon(): string {
    return 'chef-hat';
  }

  onOpen(): Promise<void> {
    this.unsubscribe = this.deps.subscribeToChanges(() => void this.render());
    this.registerEvent(this.app.metadataCache.on('changed', () => void this.render()));
    return this.render();
  }

  onClose(): Promise<void> {
    this.generation++;
    this.unsubscribe?.();
    this.unsubscribe = null;
    return Promise.resolve();
  }

  private async render(): Promise<void> {
    if (this.rendering) {
      this.renderAgain = true;
      return;
    }

    this.rendering = true;
    try {
      do {
        this.renderAgain = false;
        await this.paint();
      } while (this.renderAgain);
    } finally {
      this.rendering = false;
    }
  }

  private async paint(): Promise<void> {
    this.generation++;
    const generation = this.generation;

    const settings = this.deps.getSettings();

    // The plan card browses its own week, falling back to the current one on a
    // first open.
    const planWeek = settings.state.mealPlanViewedWeek || currentWeekTitle();

    // Before anything is read, so the plan reflects the notes rather than
    // whatever state was last saved. The sync is a no-op when they agree.
    await this.deps.syncWeek(planWeek);

    const entries: GalleryEntry[] = await buildGalleryEntries(this.app, settings);

    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('culi-dashboard-view');

    // Actions, then the search, then the greeting: the order all three
    // dashboards now share. See quick-actions.ts.
    renderQuickActions(contentEl, this.deps);
    renderGreeting(contentEl);

    const grid = dashboardGrid(contentEl);

    renderActivitySection(grid, this.deps, entries);
    renderLibrarySection(grid, this.deps, entries);
    renderTodaySection(grid, {
      app: this.app,
      deps: this.deps,
      week: planWeek,
      onPersonChange: (person) => void this.setActivePerson(person),
    });
    renderNewMealsCard(grid, this.app, this.deps, entries, () => generation !== this.generation);
  }

  /**
   * Remembers whose plan the dashboard is showing.
   *
   * The same field the meal-plan view uses, on purpose: switching person in one
   * place and finding the other still on the previous person would be a bug
   * nobody could describe.
   */
  private async setActivePerson(person: string): Promise<void> {
    this.deps.getSettings().state.mealPlanActivePerson = person;
    await this.deps.saveSettings();
    await this.render();
  }
}
