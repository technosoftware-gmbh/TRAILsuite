/**
 * Editing a meal note.
 *
 * What a meal note holds, how one part of it is replaced without disturbing
 * the rest, and the arithmetic between a label's per-100 g figures and one
 * serving's. Written for CULItrail's editor and here rather than inside it,
 * because what a meal note holds is the note format rather than an editor's
 * model of it. A vault full of meals outlives every editor that has ever opened
 * one, and a format defined inside an editor is redefined every time the editor
 * is: a property comes back spelled one way after this release and another way
 * after the next. The plugin imports these definitions rather than keeping a
 * copy, so there is one answer to what a meal note holds.
 *
 * **The rule the whole of `body-edit.ts` exists to keep:** a save rewrites
 * exactly the span it is named for. A meal carries sections no editor here has
 * a feature for and formatting its owner chose, and a save that regenerated the
 * file would launder both.
 *
 * **A meal's per-100 g figures live in frontmatter.** They used to be eight
 * fixed fields in two body sections, which is a form's shape rather than a
 * note's: a label declaring fibre or iron had nowhere to put it. They are now a
 * vocabulary of nutrient ids (`nutrients.ts`), two lists and two energy scalars
 * (`nutrition-model.ts`), and a frontmatter reader and writer for them
 * (`nutrition-frontmatter.ts`). `nutrition.ts` keeps the old sections readable,
 * because the notes in a vault do not migrate the day the code does, and
 * `parseLegacyPer100gSections` is how one of those notes reaches the model. Its
 * two section renderers are deprecated and have no caller left; nothing new may
 * reach for them, and `removeSection` is what takes the section they wrote out
 * of a note that has been converted.
 *
 * What stays with a consumer: reading a note off a vault, writing one back, and
 * the form. Obsidian has `processFrontMatter()` and a modal; a host with only a
 * file would have `setFrontmatterValue` and a screen of its own.
 */
export { removeSection, replaceDescription, replaceSection, sectionSource } from './body-edit.js';
export { emptyPer100g } from './draft.js';
export type { MealDraft, Per100gNutrition, ServingTotals } from './draft.js';
export {
  MACRONUTRIENT_IDS,
  MICRONUTRIENT_IDS,
  NUTRIENT_ORDER,
  defaultUnitFor,
  inNutrientOrder,
  isKnownNutrientId,
  matchNutrient,
  nutrientLabel,
  nutrientLabelDe,
} from './nutrients.js';
export type {
  KnownNutrientId,
  MacronutrientId,
  MicronutrientId,
  NutrientEntry,
  NutrientMatch,
} from './nutrients.js';
export { nutrientListValue, readNutrientList } from './nutrition-frontmatter.js';
export type { NutrientFieldNames } from './nutrition-frontmatter.js';
export { emptyMealNutrition, isEmptyMealNutrition, nutrientValue } from './nutrition-model.js';
export type { MealNutritionPer100g, MealNutritionPerServing } from './nutrition-model.js';
export {
  parseLegacyPer100gSections,
  parseMicronutrientSection,
  parseNutritionSection,
  parsePer100g,
  renderMicronutrientSection,
  renderNutritionSection,
} from './nutrition.js';
export { deriveServingNutrition, per100g, perServing, round2 } from './per-serving.js';
export { isUnknownSupplier, supplierOptionValues } from './supplier.js';
