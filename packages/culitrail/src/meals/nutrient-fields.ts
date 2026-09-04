/**
 * The three sub-key names a nutrient list entry is written with.
 *
 * `trail-core`'s `readNutrientList` and `nutrientListValue` take the names as an
 * argument and assume nothing, because what a property is called is a vault's
 * decision rather than the core's. This is the one place that turns the three
 * settings into the shape they expect, so a reader and a writer cannot end up
 * disagreeing about which key holds the figure.
 *
 * Here rather than under `editor/` because the editor is not the only thing that
 * will read these lists: a view showing a label reads the same entries with the
 * same names.
 *
 * App-free.
 */
import type { NutrientFieldNames } from 'trail-core';
import type { CULItrailSettings } from '../settings/types';

export function nutrientFieldNames(settings: CULItrailSettings): NutrientFieldNames {
  return {
    name: settings.nutrientNameField,
    unit: settings.nutrientUnitField,
    value: settings.nutrientValueField,
  };
}
