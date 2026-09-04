/**
 * The folders page: where CULItrail's notes live.
 *
 * A folder row and a property row look identical and are nothing alike to get
 * wrong, which is why they are two pages rather than two halves of one.
 * Repointing a folder moves where the plugin looks and every note is found
 * again the moment it points somewhere real; that is why these rows need no
 * lock and the ones next door do.
 */
import { t } from '../../../lang/I18nManager';
import { linesRow, sectionCard, textRow } from '../rows';
import type { SettingsTabContext } from '../settings-tab';

/** How many folder rows the page holds, for the row that opens it. */
export const FOLDER_COUNT = 11;

export function renderFoldersPage(container: HTMLElement, context: SettingsTabContext): void {
  const { settings } = context;

  const library = sectionCard(
    container,
    t('settings.library.folders'),
    t('settings.library.foldersNote')
  );

  textRow(
    library,
    context,
    { name: t('settings.library.rootFolder'), desc: t('settings.library.rootFolderDesc') },
    () => settings.rootFolder,
    (value) => (settings.rootFolder = value)
  );
  textRow(
    library,
    context,
    { name: t('settings.library.eatingFolder') },
    () => settings.eatingFolder,
    (value) => (settings.eatingFolder = value)
  );
  textRow(
    library,
    context,
    { name: t('settings.library.mealsFolder') },
    () => settings.mealsFolder,
    (value) => (settings.mealsFolder = value)
  );
  linesRow(
    library,
    context,
    {
      name: t('settings.library.additionalMealFolders'),
      desc: t('settings.library.additionalMealFoldersDesc'),
    },
    () => settings.additionalMealFolders,
    (value) => (settings.additionalMealFolders = value)
  );
  textRow(
    library,
    context,
    { name: t('settings.library.mealPlansFolder') },
    () => settings.mealPlansFolder,
    (value) => (settings.mealPlansFolder = value)
  );

  const orders = sectionCard(
    container,
    t('settings.orders.deliveries'),
    t('settings.orders.deliveriesNote')
  );

  textRow(
    orders,
    context,
    { name: t('settings.library.ordersFolder') },
    () => settings.ordersFolder,
    (value) => (settings.ordersFolder = value)
  );
  textRow(
    orders,
    context,
    { name: t('settings.orders.deliveriesFolder') },
    () => settings.deliveriesFolder,
    (value) => (settings.deliveriesFolder = value)
  );

  // The CRM folders are half of the shared contract with APERtrail: these
  // names are copied verbatim from its own defaults, in both locales, and that
  // agreement is the whole mechanism behind two plugins reading one set of
  // Person and Company notes.
  const crm = sectionCard(container, t('settings.orders.crm'), t('settings.orders.crmNote'));

  textRow(
    crm,
    context,
    { name: t('settings.orders.crmFolder') },
    () => settings.crmFolder,
    (value) => (settings.crmFolder = value)
  );
  textRow(
    crm,
    context,
    { name: t('settings.orders.personsFolder') },
    () => settings.personsFolder,
    (value) => (settings.personsFolder = value)
  );
  textRow(
    crm,
    context,
    { name: t('settings.orders.companiesFolder') },
    () => settings.companiesFolder,
    (value) => (settings.companiesFolder = value)
  );

  // The three fields on the meal form that have a vocabulary rather than free
  // text. Left empty they change nothing: the editor still offers whatever the
  // vault already says.
  const vocabularies = sectionCard(
    container,
    t('settings.library.vocabularies'),
    t('settings.library.vocabulariesNote')
  );

  linesRow(
    vocabularies,
    context,
    { name: t('settings.library.mealDietOptions') },
    () => settings.mealDietOptions,
    (value) => (settings.mealDietOptions = value)
  );
  linesRow(
    vocabularies,
    context,
    { name: t('settings.library.mealAllergenOptions') },
    () => settings.mealAllergenOptions,
    (value) => (settings.mealAllergenOptions = value)
  );
  linesRow(
    vocabularies,
    context,
    {
      name: t('settings.library.mealLineOptions'),
      desc: t('settings.library.mealLineOptionsDesc'),
    },
    () => settings.mealLineOptions,
    (value) => (settings.mealLineOptions = value)
  );
  textRow(
    vocabularies,
    context,
    {
      name: t('settings.library.mealSupplierRole'),
      desc: t('settings.library.mealSupplierRoleDesc'),
    },
    () => settings.mealSupplierRole,
    (value) => (settings.mealSupplierRole = value)
  );

  const paths = sectionCard(
    container,
    t('settings.library.notePaths'),
    t('settings.library.notePathsNote')
  );

  textRow(
    paths,
    context,
    { name: t('settings.library.mealPlanPath') },
    () => settings.mealPlanPath,
    (value) => (settings.mealPlanPath = value)
  );
}
