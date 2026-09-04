/**
 * Picking a meal to plan, or naming a meal that is not a meal.
 *
 * A fuzzy suggester rather than a list, because a meal library gets large
 * and the thing somebody wants is one they can already name. What they type
 * is offered back as a plain meal if nothing matches, so "leftovers" or
 * "dinner at Anna's" can go on the plan without inventing a meal note for
 * it.
 *
 * What arrived in the last delivery is offered first and marked, because a week
 * is planned out of the freezer rather than out of the catalogue.
 */
import { App, FuzzySuggestModal, TFile, type FuzzyMatch } from 'obsidian';
import { lastDeliveredTitles, readDeliveries } from '../../deliveries/read-deliveries';
import { t } from '../../lang/I18nManager';
import type { CULItrailSettings } from '../../settings/types';
import { readNotesOfType } from '../../vault/read-notes';
import { deliveredFirst } from '../view-model/picker-order';

export interface PickedMeal {
  kind: 'meal';
  file: TFile;
}

export interface PickedLabel {
  kind: 'label';
  label: string;
}

export type Picked = PickedMeal | PickedLabel;

interface Choice {
  label: string;
  picked: Picked;
  /** In the most recent delivery, so it is in the freezer now. */
  delivered: boolean;
}

export class MealPickerModal extends FuzzySuggestModal<Choice> {
  private readonly choices: Choice[];

  constructor(
    app: App,
    settings: CULItrailSettings,
    private readonly onPick: (picked: Picked) => void
  ) {
    super(app);
    this.setPlaceholder(t('planning.picker.placeholder'));

    const delivered = lastDeliveredTitles(readDeliveries(app, settings));

    // The order set here is the order the empty query shows, which is the
    // question the picker opens on. Once somebody types, the fuzzy score
    // decides and it should: a search for a name they can already spell is a
    // search for that meal, not for whatever happened to arrive on Tuesday.
    // The marker stays either way, so the freezer is still readable in results.
    this.choices = deliveredFirst(
      readNotesOfType(app, settings, 'meal').map((note) => ({
        label: note.title,
        picked: { kind: 'meal', file: note.file },
      })),
      delivered
    );
  }

  getItems(): Choice[] {
    return this.choices;
  }

  getItemText(choice: Choice): string {
    return choice.label;
  }

  /**
   * Offers what was typed when nothing matches.
   *
   * Appended rather than substituted, so a search that matches one meal
   * loosely still shows it. The extra row is only there when the query is
   * long enough to be a name somebody meant.
   */
  getSuggestions(query: string): FuzzyMatch<Choice>[] {
    const matches = super.getSuggestions(query);
    const typed = query.trim();
    if (!typed) return matches;

    const exact = matches.some((match) => match.item.label.toLowerCase() === typed.toLowerCase());
    if (exact) return matches;

    matches.push({
      item: {
        label: t('planning.picker.addAsMeal', { name: typed }),
        picked: { kind: 'label', label: typed },
        delivered: false,
      },
      match: { score: -1, matches: [] },
    });

    return matches;
  }

  /**
   * The row, plus a mark on the ones that just arrived.
   *
   * `super` first rather than rendering the label here, because the fuzzy
   * highlighting is what tells somebody why a row matched and reimplementing it
   * to add a badge would lose it.
   */
  renderSuggestion(match: FuzzyMatch<Choice>, el: HTMLElement): void {
    super.renderSuggestion(match, el);
    if (!match.item.delivered) return;

    el.addClass('culi-picker-row');
    el.createSpan({
      cls: 'culi-picker-delivered',
      text: t('planning.picker.lastDelivered'),
    });
  }

  onChooseItem(choice: Choice): void {
    this.onPick(choice.picked);
  }
}
