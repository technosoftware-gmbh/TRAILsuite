/**
 * How a meal note is drawn, and what the parser looks for in it.
 *
 * The property names this section used to carry are on the property-keys page
 * now. What is left is the part somebody actually revisits: the headings the
 * parser looks for, what the view does with the note body, and the two list
 * editors, each a page of its own because a list editor inside a settings row
 * is a page whether or not it says so.
 */
import { t } from '../../../lang/I18nManager';
import type { NutritionDisplay, NutritionSource } from '../../types';
import { dropdownRow, linesRow, navRow, sectionCard, textRow, toggleRow } from '../rows';
import type { SettingsTabContext } from '../settings-tab';

export const BADGES_PAGE_ID = 'badges';
export const APPLIANCES_PAGE_ID = 'appliances';

export function renderMealViewSection(
  container: HTMLElement,
  context: SettingsTabContext,
  open: (pageId: string) => void
): void {
  const { settings } = context;

  const headings = sectionCard(
    container,
    t('settings.mealView.headings'),
    t('settings.mealView.headingsNote')
  );

  textRow(
    headings,
    context,
    { name: t('settings.mealView.notesHeading') },
    () => settings.notesHeading,
    (value) => (settings.notesHeading = value)
  );
  // The mirror image of the property page's "written, never read back" group:
  // those properties are emitted and never looked at again, these two headings
  // are looked for and never emitted. Both groups exist so a setting that does
  // only half the job says which half on the page rather than only in a comment
  // nobody editing settings can see.
  const readOnly = sectionCard(
    container,
    t('settings.mealView.readOnly'),
    t('settings.mealView.readOnlyNote')
  );

  textRow(
    readOnly,
    context,
    { name: t('settings.mealView.nutritionHeading') },
    () => settings.nutritionHeading,
    (value) => (settings.nutritionHeading = value)
  );
  textRow(
    readOnly,
    context,
    { name: t('settings.mealView.micronutrientHeading') },
    () => settings.micronutrientHeading,
    (value) => (settings.micronutrientHeading = value)
  );

  const reheating = sectionCard(
    container,
    t('settings.reheating.section'),
    t('settings.reheating.sectionNote')
  );

  textRow(
    reheating,
    context,
    { name: t('settings.reheating.heading') },
    () => settings.reheatingHeading,
    (value) => (settings.reheatingHeading = value)
  );
  navRow(reheating, {
    name: t('settings.reheating.appliances'),
    desc: t('settings.reheating.appliancesNote'),
    value: t('settings.page.itemCount', { count: settings.reheatAppliances.length }),
    open: () => open(APPLIANCES_PAGE_ID),
  });

  const rendering = sectionCard(container, t('settings.mealView.rendering'));

  toggleRow(
    rendering,
    context,
    { name: t('settings.mealView.cleanNoteBody'), desc: t('settings.mealView.cleanNoteBodyDesc') },
    () => settings.cleanNoteBody,
    (value) => (settings.cleanNoteBody = value)
  );
  toggleRow(
    rendering,
    context,
    {
      name: t('settings.mealView.useFirstBodyImage'),
      desc: t('settings.mealView.useFirstBodyImageDesc'),
    },
    () => settings.useFirstBodyImageWhenFrontmatterEmpty,
    (value) => (settings.useFirstBodyImageWhenFrontmatterEmpty = value)
  );
  textRow(
    rendering,
    context,
    {
      name: t('settings.mealView.defaultMealImage'),
      desc: t('settings.mealView.defaultMealImageDesc'),
    },
    () => settings.defaultMealImage,
    (value) => (settings.defaultMealImage = value)
  );
  navRow(rendering, {
    name: t('settings.badges.title'),
    desc: t('settings.badges.note'),
    value: t('settings.page.itemCount', { count: settings.headerBadges.length }),
    open: () => open(BADGES_PAGE_ID),
  });

  const tags = sectionCard(container, t('settings.mealView.tags'));

  toggleRow(
    tags,
    context,
    { name: t('settings.mealView.showTagsInHeader'), refreshOnChange: true },
    () => settings.showTagsInHeader,
    (value) => (settings.showTagsInHeader = value)
  );
  if (settings.showTagsInHeader) {
    toggleRow(
      tags,
      context,
      { name: t('settings.mealView.prefixTagsWithHash') },
      () => settings.prefixTagsWithHash,
      (value) => (settings.prefixTagsWithHash = value)
    );
    toggleRow(
      tags,
      context,
      {
        name: t('settings.mealView.showFullTagPath'),
        desc: t('settings.mealView.showFullTagPathDesc'),
      },
      () => settings.showFullTagPath,
      (value) => (settings.showFullTagPath = value)
    );
  }

  const nutrition = sectionCard(
    container,
    t('settings.mealView.nutrition'),
    t('settings.mealView.nutritionNote')
  );

  dropdownRow<NutritionSource>(
    nutrition,
    context,
    {
      name: t('settings.mealView.nutritionSource'),
      desc: t('settings.mealView.nutritionSourceDesc'),
    },
    [
      { value: 'per-serving', label: t('settings.mealView.perServing') },
      { value: 'meal-total', label: t('settings.mealView.wholeMeal') },
    ],
    () => settings.nutritionSource,
    (value) => (settings.nutritionSource = value)
  );
  dropdownRow<NutritionDisplay>(
    nutrition,
    context,
    {
      name: t('settings.mealView.nutritionDisplay'),
      desc: t('settings.mealView.nutritionDisplayDesc'),
    },
    [
      { value: 'per-serving', label: t('settings.mealView.perServing') },
      { value: 'total', label: t('settings.mealView.wholeMeal') },
    ],
    () => settings.nutritionDisplay,
    (value) => (settings.nutritionDisplay = value)
  );

  const allergens = sectionCard(
    container,
    t('settings.mealView.allergens'),
    t('settings.mealView.allergensNote')
  );

  linesRow(
    allergens,
    context,
    { name: t('settings.mealView.myAllergens'), desc: t('settings.mealView.myAllergensDesc') },
    () => settings.myAllergens,
    (value) => (settings.myAllergens = value)
  );
}
