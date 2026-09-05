/**
 * Default settings for CULItrail, plus the locale-aware defaults a fresh
 * install starts from.
 *
 * The defaults mirror the shape of the CULItrail sample vault:
 *
 *   Eating/
 *     Meals/          one note per meal
 *     Meal Plans/     one note per person per ISO week
 *     Orders/         one note per order
 *     Deliveries/     one note per delivery
 *   CRM/
 *     People/ Companies/
 *
 * `rootFolder` is an optional common parent above both. It defaults to empty,
 * meaning the vault root, so a vault dedicated to eating gets the clean
 * two-folder tree above; set it to e.g. `4 Resources/Eating` and the whole
 * tree moves underneath that in one step.
 */
import {
  CRM_CONTRACT,
  DISPLAY_CONTRACT,
  ORDER_CONTRACT,
  joinFolder as joinOneFolder,
} from '@technosoftware/trail-core';
import { CULItrailSettings, CustomBadge, ReheatAppliance } from './types';
import { I18nManager, t } from '../lang/I18nManager';

/**
 * Joins folder segments, dropping empty ones so an empty root means "the vault
 * root" rather than a leading slash.
 *
 * Variadic, which is the only reason it is still spelled here: the settings
 * derivation joins three segments at a time. The normalising is
 * `trail-core`'s, folded one segment at a time.
 */
export function joinFolder(...segments: (string | undefined)[]): string {
  return segments.reduce<string>((path, segment) => joinOneFolder(path, segment ?? ''), '');
}

/**
 * The appliances a ready meal can be reheated in.
 *
 * Ids first and labels second: the id is written into nothing by the plugin but
 * is what a note's sub-heading can be matched against and what a rename has to
 * preserve, and the label is what a reader sees. English labels here are the
 * pre-I18n fallback; `getLocalizedAppliances()` below is what a fresh install
 * actually seeds, for the §G.1 reason that a default freezing into `data.json`
 * as an English literal can never afterwards be told from a typed value.
 */
/**
 * The four appliances that ship, their ids and their names.
 *
 * Moved to `trail-core` with the reheating reader: the ids are written into
 * notes and the names are matched against headings already there, so both are
 * the note format rather than this plugin's defaults. Re-exported here because
 * the settings layer is where the rest of the plugin looks for them.
 */
import {
  APPLIANCE_LABELS_DE,
  APPLIANCE_LABELS_EN,
  DEFAULT_APPLIANCES,
  DEFAULT_APPLIANCE_IDS,
  type DefaultApplianceId,
} from '@technosoftware/trail-core';

export { APPLIANCE_LABELS_DE, APPLIANCE_LABELS_EN, DEFAULT_APPLIANCES, DEFAULT_APPLIANCE_IDS };
export type { DefaultApplianceId };

/**
 * The appliance list a fresh install seeds, with labels in the active locale.
 *
 * A separate resolver from `getLocalizedDefaults()` because that one returns a
 * record of plain strings and this is a list of objects. Same try/catch shape:
 * falls back to the English labels when the I18n manager is not initialized,
 * which is the case in unit tests and during the first moments of plugin load.
 */
export function getLocalizedAppliances(): ReheatAppliance[] {
  return DEFAULT_APPLIANCE_IDS.map((id) => {
    let label = APPLIANCE_LABELS_EN[id];
    try {
      if (I18nManager.getInstance()) label = t(`settings.reheating.applianceLabels.${id}`);
    } catch {
      label = APPLIANCE_LABELS_EN[id];
    }
    return { id, label };
  });
}

/**
 * The six badges the meal header ships with.
 *
 * Each carries `labelKey` rather than a literal `label`, so its text follows
 * the locale rather than freezing into `data.json` in whatever language the
 * vault happened to be in the first time settings were saved. Editing a
 * built-in's label in the UI sets `label`, which then wins.
 */
export const BUILTIN_BADGES: CustomBadge[] = [
  {
    type: 'badge',
    property: 'diet',
    labelKey: 'badges.builtin.diet',
    icon: 'leaf',
    color: 'green',
    // The four values this vault uses, and the reason the map exists: one
    // green pill for all of them says nothing the word does not already say.
    // Vegetarisch and Vegan share a hue on purpose – they are the same answer
    // to "what is in it" at two depths, and spending a fourth categorical hue
    // on that depth would claim there are four answers rather than three. A
    // vault using other values falls back to `color` until somebody names them
    // here.
    valueColors: {
      Vegetarisch: 'green',
      Vegan: 'green',
      Fleisch: 'red',
      Fisch: 'blue',
    },
    valueType: 'auto',
    splitArray: true,
    enabled: true,
    builtin: true,
  },
  {
    type: 'badge',
    property: 'prepTime',
    labelKey: 'badges.builtin.prep',
    icon: 'clock',
    color: 'default',
    valueType: 'minutes',
    splitArray: false,
    enabled: true,
    builtin: true,
  },
  {
    type: 'badge',
    property: 'reheatTime',
    labelKey: 'badges.builtin.cook',
    icon: 'clock',
    color: 'default',
    valueType: 'minutes',
    splitArray: false,
    enabled: true,
    builtin: true,
  },
  {
    // No property of its own: a meal that states neither prepTime nor
    // reheatTime shows no Total, and one that states both shows their sum
    // without anything having been written into the note.
    type: 'badge',
    property: 'total',
    labelKey: 'badges.builtin.total',
    icon: 'clock',
    color: 'default',
    valueType: 'minutes',
    splitArray: false,
    enabled: true,
    formula: '(prepTime || 0) + (reheatTime || 0) || null',
    builtin: true,
  },
  {
    type: 'badge',
    property: 'lastEaten',
    labelKey: 'badges.builtin.lastEaten',
    icon: 'calendar-check',
    color: 'default',
    valueType: 'auto',
    splitArray: false,
    enabled: true,
    builtin: true,
  },
  {
    // Computed from the eating-history records rather than read: see
    // `view-model/cook-streak.ts` for what it counts and why it is weeks.
    //
    // `enabled: false`, unlike every other built-in. A badge that appeared on
    // upgrade in a header somebody had already arranged would be a change to
    // their layout that they did not ask for, and this one only says anything
    // for a meal eaten two weeks running, so most vaults would see it move
    // things around on a handful of notes and nowhere else. It is one toggle
    // away on the Meal view tab.
    type: 'badge',
    property: '',
    derived: 'eatingStreak',
    labelKey: 'badges.builtin.streak',
    icon: 'flame',
    color: 'yellow',
    valueType: 'auto',
    splitArray: false,
    enabled: false,
    builtin: true,
  },
];

export const DEFAULT_SETTINGS: CULItrailSettings = {
  rootFolder: '',

  eatingFolder: 'Eating',
  mealsFolder: 'Eating/Meals',
  additionalMealFolders: [],
  mealPlansFolder: 'Eating/Meal Plans',
  // From trail-core's ORDER_CONTRACT: NODAtrail reads order notes out of this
  // folder to price a card statement, so where they are is an agreement rather
  // than this plugin's choice alone. tests/order-contract.test.ts fails if it
  // stops matching.
  ordersFolder: ORDER_CONTRACT.ordersFolder,
  deliveriesFolder: 'Eating/Deliveries',

  crmFolder: 'CRM',
  // See the note on the type values below: these come from the shared contract.
  personsFolder: CRM_CONTRACT.personsFolder,
  companiesFolder: CRM_CONTRACT.companiesFolder,

  mealPlanPath: 'Eating/Meal Plans/{GGGG}/{GGGG}-W{WW}-{person}-MealPlan.md',

  typePropertyName: CRM_CONTRACT.typePropertyName,
  mealTypeValue: 'meal',
  orderTypeValue: ORDER_CONTRACT.orderTypeValue,
  deliveryTypeValue: 'delivery',
  // From trail-core's CRM_CONTRACT, not spelled here: APERtrail has to ship the
  // identical values for both plugins to find each other's Person and Company
  // notes in a fresh vault, and this agreement was prose in a CLAUDE.md until
  // one side drifted to `Person` and `Organisation` and nothing said so. An
  // existing vault still keeps whatever it has configured.
  // tests/crm-contract.test.ts fails if this stops matching.
  personTypeValue: CRM_CONTRACT.personTypeValue,
  companyTypeValue: CRM_CONTRACT.companyTypeValue,

  // Locked, on a fresh install as much as on an old one: the values above and
  // every property name below are what existing notes are read by, and a vault
  // that needs different ones turns this on once and off again.
  unlockPropertyNames: false,

  createdProperty: 'created',
  modifiedProperty: 'modified',

  personTagProperty: CRM_CONTRACT.personTagProperty,
  companyTagProperty: CRM_CONTRACT.companyTagProperty,
  personRolesProperty: CRM_CONTRACT.personRolesProperty,
  companyRolesProperty: CRM_CONTRACT.companyRolesProperty,

  // Not part of CRM_CONTRACT. The contract is the identity of a CRM note, which
  // both plugins have to agree on to find each other's notes at all; these are
  // what one company charges, which only a plugin that buys from it reads. They
  // join the contract the day APERtrail ships its own reader, not before.
  companyCurrencyProperty: 'currency',
  companyPaymentMethodProperty: 'paymentMethod',
  companyInvoiceTimingProperty: 'invoiceTiming',
  companyShippingFeeProperty: 'shippingFee',
  companyFreeShippingFromProperty: 'freeShippingFrom',
  companyDiscountTableProperty: 'discountTable',
  companyLinesProperty: 'lines',
  eligiblePersonTags: '',
  supplierProperty: 'supplier',

  enableDashboard: true,
  showRibbonIcons: true,
  openGalleryOnFolderClick: false,
  openGalleryOnFolderClickSubfolders: false,
  dashboardActivityRangeWeeks: 8,
  ordersSavedState: {
    // Newest first, because an order list is read for what was bought
    // recently far more often than for what was bought first.
    sortField: 'order-date',
    sortDirection: 'desc',
    company: null,
    year: null,
    withoutDelivery: false,
    search: '',
  },

  gallerySavedState: {
    sortField: 'title',
    sortDirection: 'asc',
    folder: null,
    favoriteOnly: false,
    tag: null,
    diet: null,
    neverEaten: false,
    excludeAllergens: false,
    search: '',
  },

  autoOpenMealView: true,
  cleanNoteBody: true,
  useFirstBodyImageWhenFrontmatterEmpty: true,
  defaultMealImage: '',

  notesHeading: 'Notes',
  reheatingHeading: 'Reheating',
  reheatAppliances: DEFAULT_APPLIANCES,
  reheatTempField: 'temp',
  reheatTimeField: 'time',
  nutritionHeading: 'Nutritional Information (Per 100g)',
  micronutrientHeading: 'Micronutrient Information (Per 100g)',

  headerBadges: BUILTIN_BADGES,
  showTagsInHeader: true,
  prefixTagsWithHash: true,
  showFullTagPath: false,

  nutritionDisplay: 'per-serving',
  nutritionSource: 'per-serving',

  imageProperty: 'image',
  servingsProperty: 'servings',
  favoriteProperty: 'favorite',
  prepTimeProperty: 'prepTime',
  reheatTimeProperty: 'reheatTime',
  totalTimeProperty: 'totalTime',
  dietProperty: 'diet',
  allergensProperty: 'allergens',
  caloriesProperty: 'calories',
  proteinProperty: 'protein',
  fatProperty: 'fat',
  carbsProperty: 'carbs',
  priceProperty: 'price',
  kjProperty: 'kj',
  servingSizeProperty: 'serving_size',
  mealLineProperty: 'line',
  mealPriceCurrencyProperty: 'priceCurrency',

  // English in a German vault as much as in an English one, and not on the
  // localized list below, like every other property and field name here: these
  // are frontmatter keys rather than anything a reader sees, and a vault whose
  // language setting changed must not end up with half its meals keyed
  // `macronutrients` and half `Makronaehrstoffe`, with neither half readable
  // from the other side of the switch.
  caloriesPer100gProperty: 'caloriesPer100g',
  kjPer100gProperty: 'kjPer100g',
  macronutrientsProperty: 'macronutrients',
  micronutrientsProperty: 'micronutrients',
  nutrientNameField: 'name',
  nutrientUnitField: 'unit',
  nutrientValueField: 'value',

  mealPlanTypeValue: 'mealPlan',
  mealPlanWeekProperty: 'week',
  mealPlanPersonProperty: 'person',
  mealPlanEntriesProperty: 'entries',
  planEntryMealField: 'meal',
  planEntryDayField: 'day',
  planEntrySlotField: 'slot',
  planEntryEatenField: 'eaten',
  planEntryRatingField: 'rating',
  planEntryTimeField: 'time',
  planEntryNoteField: 'note',
  planEntryLeftoversField: 'leftovers',
  planEntryIdField: 'id',
  mealSlotFieldName: 'meal',
  autoOpenMealPlanView: true,

  eatingHistoryEnabled: true,
  eatingHistoryHeading: 'Eating History',
  eatingHistoryFrontmatterProperty: 'eatingHistory',
  lastEatenProperty: 'lastEaten',
  eatenCountProperty: 'eatenCount',

  myAllergens: [],
  mealDietOptions: [],
  mealAllergenOptions: [],
  mealLineOptions: [],
  mealSupplierRole: '',

  // Company, date, price and currency are the four facts NODAtrail reads off an
  // order. They are contract values for that reason; the properties around them
  // that nothing else reads are this plugin's own.
  orderCompanyProperty: ORDER_CONTRACT.orderCompanyProperty,
  orderDateProperty: ORDER_CONTRACT.orderDateProperty,
  orderDeliveryDateProperty: 'deliveryDate',
  orderPriceProperty: ORDER_CONTRACT.orderPriceProperty,
  orderDiscountProperty: 'discount',
  orderShippingProperty: 'shipping',
  orderPriceCurrencyProperty: ORDER_CONTRACT.orderPriceCurrencyProperty,
  displayLocale: DISPLAY_CONTRACT.displayLocale,
  orderDefaultCurrency: 'CHF',
  orderSelectionsProperty: 'selections',
  orderSelectionPersonField: 'person',
  orderSelectionMealsField: 'meals',
  orderSelectionItemsField: 'items',
  orderItemMealField: 'meal',
  orderItemPriceField: 'price',
  orderItemQuantityField: 'quantity',
  orderItemDiscountField: 'discount',
  orderVatRateProperty: 'vatRate',
  orderVatAmountProperty: 'vatAmount',
  orderSelectionPropertyPrefix: 'selection',
  autoOpenOrderView: true,
  autoOpenDeliveryView: true,

  deliveryDatePropertyName: 'deliveryDate',
  deliveryOrdersProperty: 'orders',
  deliveryItemsProperty: 'items',
  deliveryItemMealField: 'meal',
  deliveryItemQuantityField: 'quantity',

  state: {
    mealPlan: [],
    mealPlanActivePerson: '',
    mealPlanViewedWeek: '',
  },
};

/** The settings whose default depends on the active locale. */
export type LocalizedDefaultKey =
  | 'rootFolder'
  | 'eatingFolder'
  | 'mealsFolder'
  | 'mealPlansFolder'
  | 'ordersFolder'
  | 'deliveriesFolder'
  | 'crmFolder'
  | 'personsFolder'
  | 'companiesFolder'
  | 'mealPlanPath'
  | 'notesHeading'
  | 'reheatingHeading'
  | 'eatingHistoryHeading';

export type LocalizedDefaults = Record<LocalizedDefaultKey, string>;

/** The two roots a vault can move independently. Everything else hangs off one of them. */
export interface SavedRoots {
  rootFolder?: string;
  eatingFolder?: string;
  crmFolder?: string;
}

/**
 * Defaults resolved through the active locale.
 *
 * Every folder is derived from one of the two roots rather than being its own
 * independent literal, which is what keeps each tree relocatable as a unit.
 *
 * The saved roots are handed in so a vault that already moved its tree gets
 * any sub-folder setting added LATER under THAT root instead of under the
 * pristine default. The saved root is the vault owner's answer to "where does
 * this live", and it applies to sub-folders that did not exist when they
 * answered. Only the folder NAME still comes from the locale: the plugin
 * cannot know which language a vault names its folders in, and guessing from
 * a saved root would mean parsing it.
 *
 * Falls back to the English literals in DEFAULT_SETTINGS when the I18n
 * manager is not initialized, which is the case in unit tests and during the
 * first moments of plugin load.
 */
export function getLocalizedDefaults(saved: SavedRoots = {}): LocalizedDefaults {
  let names: {
    root: string;
    eating: string;
    meals: string;
    mealPlans: string;
    orders: string;
    deliveries: string;
    crm: string;
    persons: string;
    companies: string;
    notes: string;
    reheating: string;
    eatingHistory: string;
  };

  try {
    I18nManager.getInstance();
    names = {
      root: t('settings.folders.defaults.rootFolderPath'),
      eating: t('settings.folders.defaults.eatingFolderName'),
      meals: t('settings.folders.defaults.mealsFolderName'),
      mealPlans: t('settings.folders.defaults.mealPlansFolderName'),
      orders: t('settings.folders.defaults.ordersFolderName'),
      deliveries: t('settings.folders.defaults.deliveriesFolderName'),
      crm: t('settings.folders.defaults.crmFolderName'),
      persons: t('settings.folders.defaults.personsFolderName'),
      companies: t('settings.folders.defaults.companiesFolderName'),
      notes: t('settings.headings.defaults.notes'),
      reheating: t('settings.headings.defaults.reheating'),
      eatingHistory: t('settings.headings.defaults.eatingHistory'),
    };
  } catch {
    names = {
      root: '',
      eating: 'Eating',
      meals: 'Meals',
      mealPlans: 'Meal Plans',
      orders: 'Orders',
      deliveries: 'Deliveries',
      crm: 'CRM',
      persons: 'People',
      companies: 'Companies',
      notes: DEFAULT_SETTINGS.notesHeading,
      reheating: DEFAULT_SETTINGS.reheatingHeading,
      eatingHistory: DEFAULT_SETTINGS.eatingHistoryHeading,
    };
  }

  const rootFolder = (saved.rootFolder ?? names.root).trim();
  const eatingFolder = saved.eatingFolder?.trim() || joinFolder(rootFolder, names.eating);
  const crmFolder = saved.crmFolder?.trim() || joinFolder(rootFolder, names.crm);

  const mealsFolder = joinFolder(eatingFolder, names.meals);
  const mealPlansFolder = joinFolder(eatingFolder, names.mealPlans);

  return {
    rootFolder,
    eatingFolder,
    mealsFolder,
    mealPlansFolder,
    ordersFolder: joinFolder(eatingFolder, names.orders),
    deliveriesFolder: joinFolder(eatingFolder, names.deliveries),
    crmFolder,
    personsFolder: joinFolder(crmFolder, names.persons),
    companiesFolder: joinFolder(crmFolder, names.companies),
    // The filename halves stay untranslated on purpose: they are written into
    // filenames that already exist in vaults, and a locale change must not
    // orphan a single week's note. Only the folder half follows the locale.
    mealPlanPath: `${mealPlansFolder}/{GGGG}/{GGGG}-W{WW}-{person}-MealPlan.md`,
    notesHeading: names.notes,
    reheatingHeading: names.reheating,
    eatingHistoryHeading: names.eatingHistory,
  };
}
