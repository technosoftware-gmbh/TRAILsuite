/**
 * A plan note rendered as its week.
 *
 * A `TextFileView` for the same reason the order note's view is one: Obsidian
 * then hands it the file's text and treats the tab as the file itself, so
 * navigation, the file menu and the tab title all behave the way they do for a
 * Markdown note. It never writes `this.data` back.
 *
 * **The grid below is the same one the meal-plan view shows**, down to the
 * dragging and the card menus, because there is no version of this question
 * that deserves a second answer. What differs is the chrome: this tab is one
 * week and one person, stated rather than chosen, so there is no week nav and
 * no person picker above it.
 *
 * The week it shows comes from the note, and it syncs that week on open, since
 * the grid renders from state and state is a mirror.
 */
import { Menu, TextFileView, TFile, WorkspaceLeaf } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { toolbarButton } from '../../ui/toolbar';
import { MEAL_PLAN_NOTE_VIEW_TYPE } from '../../meals/view-types';
import { frontmatterOf } from '../../shared/vault-scan';
import { hasPlanEntries, parsePlanNote } from '../meal-plan/plan-note';
import { planProperties, weekOfPath } from '../meal-plan/read-plans';
import type { EntryScope } from '../meal-plan/entries';
import type { PlanNoteViewDeps } from './deps';
import { WeekPanel } from './week-panel';

export class PlanNoteView extends TextFileView {
  private unsubscribe: (() => void) | null = null;
  private readonly panel: WeekPanel;
  /** The week last synced, so switching notes in one leaf does not re-sync forever. */
  private synced = '';

  constructor(
    leaf: WorkspaceLeaf,
    private readonly deps: PlanNoteViewDeps
  ) {
    super(leaf);
    this.navigation = true;
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
    return MEAL_PLAN_NOTE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.file?.basename ?? t('planning.mealPlan.title');
  }

  getIcon(): string {
    return 'calendar';
  }

  getViewData(): string {
    return this.data;
  }

  setViewData(data: string, _clear: boolean): void {
    this.data = data;
    this.render();
  }

  clear(): void {
    this.data = '';
    this.contentEl.empty();
  }

  onOpen(): Promise<void> {
    this.addAction('pencil', t('meals.view.editAsMarkdown'), () => {
      if (this.file) this.deps.editAsMarkdown(this.leaf, this.file);
    });

    // Every write here goes through the note, and this view is a rendering of
    // exactly that, so it has to catch up with what it just wrote.
    this.registerEvent(
      this.app.metadataCache.on('changed', (file: TFile) => {
        if (file.path === this.file?.path) this.render();
      })
    );

    this.unsubscribe = this.deps.subscribeToChanges(() => this.render());
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    return Promise.resolve();
  }

  onPaneMenu(menu: Menu, source: string): void {
    if (source === 'more-options' && this.file) {
      const file = this.file;
      menu.addItem((item) =>
        item
          .setTitle(t('meals.view.editAsMarkdown'))
          .setIcon('pencil')
          .onClick(() => this.deps.editAsMarkdown(this.leaf, file))
      );
      menu.addSeparator();
    }
    super.onPaneMenu(menu, source);
  }

  /**
   * Whose week this tab is.
   *
   * Read out of the metadata cache rather than parsed from `this.data`, so it
   * is the same frontmatter every other reader sees. A note that states
   * neither still resolves a week from its filename, which is the fallback the
   * reader uses everywhere.
   */
  private noteScope(): EntryScope | null {
    if (!this.file) return null;

    const settings = this.deps.getSettings();
    const properties = planProperties(settings);
    const frontmatter = frontmatterOf(this.app, this.file) ?? {};

    const content = hasPlanEntries(frontmatter, properties)
      ? parsePlanNote({ frontmatter, properties })
      : { week: null, personTitle: null, entries: [] };

    const week = content.week ?? weekOfPath(this.file.path);
    if (!week) return null;

    return { week, person: content.personTitle ?? '' };
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.addClass('culi-meal-plan-view');

    const scope = this.noteScope();
    if (!scope) {
      // A note in the plans folder whose week nobody can work out. Saying so
      // beats an empty grid that looks like a week with nothing planned.
      this.contentEl.createDiv({
        cls: 'culi-mpv-col-empty',
        text: t('planning.mealPlan.noWeek'),
      });
      return;
    }

    this.renderHeader(scope);
    this.panel.render(this.contentEl, scope);

    // After the first paint rather than before it: the grid is useful
    // immediately from what state already holds, and the sync fires a change
    // of its own if it found anything.
    if (this.synced !== scope.week) {
      this.synced = scope.week;
      void this.deps.syncWeek(scope.week);
    }
  }

  private renderHeader(scope: EntryScope): void {
    const bar = this.contentEl.createDiv({ cls: 'culi-mpv-top-bar' });

    bar.createSpan({ cls: 'culi-mpv-note-week', text: scope.week });
    if (scope.person) {
      bar.createSpan({ cls: 'culi-mpv-note-person', text: scope.person });
    }

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
