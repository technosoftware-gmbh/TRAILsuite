/**
 * The nutrition half of the meal editor.
 *
 * Two shapes, because a meal states its nutrition in one of two ways. A note
 * with a per-100 g breakdown gets the two energy figures, the two nutrient
 * lists, the serving weight and a live readout of what one serving works out
 * to; a note without one gets the four per-serving figures typed directly, and
 * a button that turns them into a breakdown.
 *
 * **The lists are lists, not a fixed set of boxes.** Eight boxes were a
 * statement about this form rather than about food: a packet declaring fibre,
 * or iron, or nothing but salt had nowhere to put what it said. So each list
 * suggests the nutrients a declaration carries and accepts a name it has never
 * heard of, and a row nothing here recognises comes back out of the form exactly
 * as it went in.
 *
 * What each row means, and what a typed name resolves to, is in
 * `../nutrition-form.ts`, where it can be tested. This attaches inputs to it.
 */
import { MACRONUTRIENT_IDS, MICRONUTRIENT_IDS, type NutrientEntry } from 'trail-core';
import { t } from '../../../lang/I18nManager';
import { nutrientDisplayName } from '../../../lang/vocabulary';
import { renderListEditor } from '../../../ui/list-editor';
import { blankEntry, renamedEntry, seedBreakdown, unusedNutrientIds } from '../nutrition-form';
import { deriveServingNutrition, round2 } from '../per-serving';
import type { MealDraft } from '../types';
import { fieldLabel, numberFieldRow, parseNumberField } from './fields';

/** A figure as a reader wants it: two decimals at most, no trailing zeros. */
function show(value: number | null): string {
  if (value === null) return '-';
  return String(round2(value));
}

interface NutrientListSpec {
  /** The ids this list suggests, which is the declaration's own set for it. */
  known: readonly string[];
  /** Distinct per list, because a `<datalist>` is addressed by id. */
  datalistId: string;
  addLabel: string;
  emptyText: string;
  entries: NutrientEntry[];
  /** Hands the list back to the draft, which owns it. */
  assign: (entries: NutrientEntry[]) => void;
  onRecompute: () => void;
}

/**
 * One row: the nutrient, its unit, its figure, and a way to be rid of it.
 *
 * The name is a text field with a `<datalist>` rather than a dropdown, and that
 * is the whole design in one control. A dropdown of known nutrients could not
 * express a row for something the table has never heard of, and this vault's
 * meals are exactly the kind of data that grows a row nobody anticipated. The
 * datalist offers the declaration's nutrients to anybody who wants one and
 * stays out of the way of anybody who does not.
 *
 * The field shows the display name and reads back an id, so `Fett` typed into a
 * German vault becomes `fat` in the note and reads back as `Fett`. That is the
 * same canonicalisation the frontmatter reader performs, and doing it here as
 * well is what stops the form and the note disagreeing about what a row is
 * called.
 */
function renderNutrientRow(row: HTMLElement, entry: NutrientEntry, spec: NutrientListSpec): void {
  const name = row.createEl('input', {
    cls: 'culi-list-input culi-nutrient-name',
    attr: {
      type: 'text',
      list: spec.datalistId,
      placeholder: t('meals.editor.nutrientName'),
      'aria-label': t('meals.editor.nutrientName'),
    },
  });
  name.value = nutrientDisplayName(entry.name);

  const unit = row.createEl('input', {
    cls: 'culi-list-input culi-nutrient-unit',
    attr: {
      type: 'text',
      placeholder: t('meals.editor.nutrientUnit'),
      'aria-label': t('meals.editor.nutrientUnit'),
    },
  });
  unit.value = entry.unit;

  // On `input` rather than on `change`, so a name half typed when somebody
  // presses Save is still in the draft. The unit follows the nutrient only while
  // the field is empty, which is what makes an added row arrive with `g` in it
  // without ever overwriting what a packet said.
  name.addEventListener('input', () => {
    const renamed = renamedEntry(entry, name.value);
    entry.name = renamed.name;
    entry.unit = renamed.unit;
    unit.value = renamed.unit;
  });
  unit.addEventListener('input', () => (entry.unit = unit.value));

  const value = row.createEl('input', {
    cls: 'culi-list-input culi-nutrient-value',
    attr: {
      type: 'text',
      placeholder: t('meals.editor.nutrientValue'),
      'aria-label': t('meals.editor.nutrientValue'),
    },
  });
  // A decimal keypad on a phone, but a text field so a comma separator survives
  // as far as parseNumberField(). Same reasoning as numberFieldRow's cells.
  value.inputMode = 'decimal';
  value.value = entry.value !== null ? String(entry.value) : '';
  value.addEventListener('input', () => {
    entry.value = parseNumberField(value.value);
    spec.onRecompute();
  });
}

/**
 * A whole list, redrawn from scratch whenever a row is added, removed or moved.
 *
 * Rebuilt rather than patched because the reorder buttons and the datalist both
 * depend on the list's contents, and only this container is rebuilt, so nothing
 * a person is typing elsewhere in the form is disturbed. Typing inside a row
 * does **not** redraw: that would take the cursor out of the field on every
 * keystroke.
 */
function renderNutrientList(host: HTMLElement, spec: NutrientListSpec): void {
  host.empty();

  const suggestions = host.createEl('datalist', { attr: { id: spec.datalistId } });
  for (const id of unusedNutrientIds(spec.known, spec.entries)) {
    suggestions.createEl('option', { value: nutrientDisplayName(id) });
  }

  renderListEditor<NutrientEntry>(host, {
    items: spec.entries,
    emptyText: spec.emptyText,
    addLabel: spec.addLabel,
    // Unnamed, because the row is where a nutrient is chosen and guessing which
    // one somebody wants next would put a figure against the wrong name as often
    // as the right one. An unnamed row is not written to the note.
    onAdd: () => blankEntry(''),
    onChange: (items) => {
      spec.assign(items);
      spec.entries = items;
      renderNutrientList(host, spec);
      spec.onRecompute();
    },
    renderItem: (row, entry) => renderNutrientRow(row, entry, spec),
  });
}

function renderPer100gFields(
  container: HTMLElement,
  draft: MealDraft,
  onRecompute: () => void
): void {
  fieldLabel(container, t('meals.editor.per100gLabel'));

  numberFieldRow(container, [
    {
      label: t('meals.editor.calories'),
      placeholder: '133',
      value: draft.per100g.caloriesPer100g,
      onChange: (value) => {
        draft.per100g.caloriesPer100g = value;
        onRecompute();
      },
    },
    {
      label: t('meals.editor.energy'),
      placeholder: '558',
      value: draft.per100g.kjPer100g,
      onChange: (value) => {
        draft.per100g.kjPer100g = value;
        onRecompute();
      },
    },
  ]);

  fieldLabel(container, t('meals.editor.macronutrients'));
  renderNutrientList(container.createDiv({ cls: 'culi-nutrient-list' }), {
    known: MACRONUTRIENT_IDS,
    datalistId: 'culi-macronutrient-names',
    addLabel: t('meals.editor.addNutrient'),
    emptyText: t('meals.editor.noNutrients'),
    entries: draft.per100g.macronutrients,
    assign: (entries) => (draft.per100g.macronutrients = entries),
    onRecompute,
  });

  fieldLabel(container, t('meals.editor.micronutrients'));
  renderNutrientList(container.createDiv({ cls: 'culi-nutrient-list' }), {
    known: MICRONUTRIENT_IDS,
    datalistId: 'culi-micronutrient-names',
    addLabel: t('meals.editor.addNutrient'),
    emptyText: t('meals.editor.noNutrients'),
    entries: draft.per100g.micronutrients,
    assign: (entries) => (draft.per100g.micronutrients = entries),
    onRecompute,
  });

  numberFieldRow(container, [
    {
      label: t('meals.editor.servingGrams'),
      placeholder: '440',
      value: draft.servingGrams,
      onChange: (value) => {
        draft.servingGrams = value;
        onRecompute();
      },
    },
  ]);
}

function renderTotalsFields(container: HTMLElement, draft: MealDraft): void {
  fieldLabel(container, t('meals.editor.perServingLabel'));

  numberFieldRow(container, [
    {
      label: t('meals.editor.calories'),
      placeholder: '585',
      value: draft.totals.calories,
      onChange: (value) => (draft.totals.calories = value),
    },
    {
      label: t('meals.editor.protein'),
      placeholder: '32',
      value: draft.totals.protein,
      onChange: (value) => (draft.totals.protein = value),
    },
    {
      label: t('meals.editor.fat'),
      placeholder: '12',
      value: draft.totals.fat,
      onChange: (value) => (draft.totals.fat = value),
    },
    {
      label: t('meals.editor.carbs'),
      placeholder: '92',
      value: draft.totals.carbs,
      onChange: (value) => (draft.totals.carbs = value),
    },
  ]);
}

/**
 * Renders whichever half applies, and re-renders when the draft switches
 * from one to the other.
 *
 * `redraw` rebuilds this container rather than the whole modal, so pressing
 * the breakdown button does not scroll somebody back to the description they
 * were part way through typing.
 */
export function renderNutritionFields(container: HTMLElement, draft: MealDraft): void {
  const redraw = (): void => {
    container.empty();
    renderNutritionFields(container, draft);
  };

  if (draft.hasPer100g) {
    const computed = container.createDiv({ cls: 'culi-edit-computed' });

    // Through the same function the save derives with, so what this promises is
    // what lands in the note. It shows a dash rather than a zero for a meal with
    // no serving weight, because there is nothing to multiply by and a zero
    // would read as a portion containing no energy.
    const update = (): void => {
      const serving = deriveServingNutrition(draft.per100g, draft.servingGrams);
      computed.setText(
        t('meals.editor.computedTotals', {
          calories: show(serving.calories),
          protein: show(serving.protein),
          fat: show(serving.fat),
          carbs: show(serving.carbs),
        })
      );
    };

    renderPer100gFields(container, draft, update);
    // Moved under the fields it describes, having been created first so the
    // callbacks above can close over it.
    container.appendChild(computed);
    update();
    return;
  }

  renderTotalsFields(container, draft);

  const button = container.createEl('button', {
    cls: 'culi-edit-secondary',
    text: t('meals.editor.addPer100g'),
  });
  button.addEventListener('click', () => {
    draft.per100g = seedBreakdown(draft.totals, draft.servingGrams);
    draft.hasPer100g = true;
    redraw();
  });
}
