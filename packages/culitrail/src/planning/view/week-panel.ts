/**
 * One week's grid, and everything you can do to it.
 *
 * Extracted because two surfaces show the same week on the same terms: the
 * meal-plan view, which browses whichever week you point it at, and a plan note
 * opened as itself, which shows the one week it is. The difference between them
 * is the toolbar above this and nothing below it, so a second copy of the
 * action wiring would only be a second place for the two to drift.
 *
 * It renders from state, and state is a mirror of the notes. Nothing here
 * writes state directly: every change goes through `meal-plan/actions.ts`,
 * which writes the note first.
 */
import { App, Notice } from 'obsidian';
import { t } from '../../lang/I18nManager';
import type { CULItrailSettings, MealPlanEntry } from '../../settings/types';
import {
  addEntry,
  clearWeek,
  removeEntry,
  rescheduleEntry,
  setEntryEaten,
  setEntryLeftovers,
  setEntryRating,
  setEntrySlot,
} from '../meal-plan/actions';
import { entriesInScope, type EntryScope } from '../meal-plan/entries';
import { ClearWeekModal } from './clear-week-modal';
import type { DropPoint } from './drag';
import { MealPickerModal } from './meal-picker';
import { showMealSlotPopover } from './meal-slot-popover';
import { renderWeekGrid } from './week-grid';

export interface WeekPanelDeps {
  getSettings: () => CULItrailSettings;
  saveSettings: () => Promise<void>;
  openMeal: (path: string) => void;
}

export class WeekPanel {
  constructor(
    private readonly app: App,
    private readonly deps: WeekPanelDeps,
    /** Called after every change, so the surface above can repaint itself whole. */
    private readonly repaint: () => void
  ) {}

  render(container: HTMLElement, scope: EntryScope): void {
    const settings = this.deps.getSettings();
    const entries = entriesInScope(settings.state.mealPlan, scope);

    renderWeekGrid(container, this.app, entries, settings, {
      openMeal: (path) => this.deps.openMeal(path),
      remove: (id) => this.run(() => removeEntry(this.app, settings, id)),
      setSlot: (id, slot) => this.run(() => setEntrySlot(this.app, settings, id, slot)),
      setRating: (id, rating) => this.run(() => setEntryRating(this.app, settings, id, rating)),
      setLeftovers: (id, value) => this.run(() => setEntryLeftovers(this.app, settings, id, value)),
      setEaten: (id, value) => this.run(() => setEntryEaten(this.app, settings, id, value)),
      addTo: (day) => this.pickAndAdd(scope, day),
      drop: (payload, day, at) => {
        if (payload.kind === 'entry') {
          // A card moved inside the grid keeps whatever slot it already had, so
          // there is nothing to ask about.
          this.run(() => rescheduleEntry(this.app, settings, payload.id, day));
          return;
        }

        this.run(async () => {
          const added = await addEntry(this.app, settings, scope, {
            mealPath: payload.path,
            day,
          });
          // Asked at the point it landed, because a meal dropped on a day
          // almost always wants a slot and the alternative is finding the
          // card's menu afterwards.
          if (added) this.askForSlot(added.id, at);
        });
      },
    });
  }

  /** Opens the picker and adds what it returns to this week. */
  pickAndAdd(scope: EntryScope, day: string | undefined): void {
    const settings = this.deps.getSettings();

    new MealPickerModal(this.app, settings, (picked) => {
      const spec =
        picked.kind === 'meal'
          ? { mealPath: picked.file.path, day }
          : { mealPath: '', label: picked.label, day };

      this.run(() => addEntry(this.app, settings, scope, spec));
    }).open();
  }

  /**
   * Clearing a week asks first, and asks a second question while it is there.
   *
   * Somebody clearing a plan they have already shopped for should not lose the
   * list they are about to use.
   */
  confirmClear(scope: EntryScope): void {
    const settings = this.deps.getSettings();
    const planned: MealPlanEntry[] = entriesInScope(settings.state.mealPlan, scope);
    if (planned.length === 0) return;

    new ClearWeekModal(this.app, planned.length, () => {
      void clearWeek(this.app, settings, scope)
        .then((count) => {
          new Notice(t('planning.mealPlan.cleared', { count }));
          return this.deps.saveSettings();
        })
        .then(() => this.repaint());
    }).open();
  }

  /**
   * Offers the four slots for an entry that has just landed without one.
   *
   * Deferred a frame, because the repaint that follows the drop would otherwise
   * happen after the popover is positioned and shift what it is pointing at.
   */
  private askForSlot(id: string, at: DropPoint): void {
    window.requestAnimationFrame(() => {
      showMealSlotPopover({ kind: 'point', x: at.x, y: at.y }, (slot) => {
        // No slot chosen is a real answer and needs no write: a new entry has
        // none already.
        if (slot) this.run(() => setEntrySlot(this.app, this.deps.getSettings(), id, slot));
      });
    });
  }

  /** Runs an action, then saves and repaints once. */
  private run(action: () => Promise<unknown>): void {
    void action()
      .then(() => this.deps.saveSettings())
      .then(() => this.repaint());
  }
}
