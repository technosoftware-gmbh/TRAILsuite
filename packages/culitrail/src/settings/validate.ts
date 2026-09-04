/**
 * Turns raw plugin data (whatever is in data.json, which a user can hand
 * edit) into a fully typed CULItrailSettings, filling in defaults for anything
 * missing or of the wrong type.
 *
 * This is the only way a settings object is ever built, which is what lets
 * the rest of the codebase treat every field as present and correctly typed
 * rather than guarding at each call site.
 */
import {
  BadgeColor,
  CULItrailSettings,
  CustomBadge,
  DashboardActivityRangeWeeks,
  GallerySavedState,
  OrdersSavedState,
  MealPlanEntry,
  ReheatAppliance,
} from './types';
import { DEFAULT_SETTINGS, getLocalizedAppliances, getLocalizedDefaults } from './defaults';

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return !!val && typeof val === 'object' && !Array.isArray(val);
}

function str(val: unknown, fallback: string): string {
  return typeof val === 'string' ? val : fallback;
}

function bool(val: unknown, fallback: boolean): boolean {
  return typeof val === 'boolean' ? val : fallback;
}

/** One of a fixed set of string values, falling back when the saved value is not among them. */
function oneOf<T extends string>(val: unknown, allowed: readonly T[], fallback: T): T {
  return typeof val === 'string' && (allowed as readonly string[]).includes(val)
    ? (val as T)
    : fallback;
}

/** The numeric twin of oneOf(), for the handful of settings whose vocabulary is numbers rather than strings. */
function oneOfNum<T extends number>(val: unknown, allowed: readonly T[], fallback: T): T {
  return typeof val === 'number' && (allowed as readonly number[]).includes(val)
    ? (val as T)
    : fallback;
}

function strArray(val: unknown, fallback: string[]): string[] {
  if (!Array.isArray(val)) return fallback;
  return val.filter((v): v is string => typeof v === 'string');
}

/**
 * Translation keys that a saved badge may still name under an older spelling.
 *
 * A built-in badge persists its `labelKey` into `data.json` as a string, so
 * renaming one in the translation tables leaves every vault that had already
 * saved its header pointing at a key that no longer resolves. `t()` answers an
 * unknown key with the key itself, so the header renders
 * `BADGES.BUILTIN.REHEAT` where a word should be -- which is at least visible,
 * and is how this was found.
 *
 * Rewritten on load rather than aliased in the tables. An alias would mean the
 * translation files carry a name nothing else uses, forever, and the next
 * rename would add a second one.
 */
const RENAMED_LABEL_KEYS: Readonly<Record<string, string>> = {
  'badges.builtin.reheat': 'badges.builtin.cook',
};

/** What identifies one built-in badge across versions. Stable; the label is not. */
function builtinKey(badge: CustomBadge): string {
  return badge.derived ?? badge.labelKey ?? badge.property;
}

/**
 * Adds a missing built-in badge to the end of a saved list, but only where
 * doing so is invisible.
 *
 * The problem: a built-in added in a later version would never reach a vault
 * that has already saved its badge order, because the saved list wins outright,
 * and the editor offers no way to get one back.
 *
 * The constraint: there is no version marker, so a built-in that is absent
 * because the data predates it cannot be told from one somebody removed by hand.
 *
 * The rule that satisfies both: restore only built-ins that ship **disabled**.
 * Those render nothing until switched on, so re-adding one changes no header and
 * costs nothing if the guess was wrong, while a built-in that ships enabled is
 * left absent, so removing one by hand sticks. A future built-in that wants to
 * reach existing vaults therefore ships disabled, which is a good default for
 * another reason: nobody's arranged header should gain a chip unasked.
 *
 * Appended, never reordered. The badge list *is* the header's layout, and an
 * arrangement somebody made is not ours to rewrite.
 */
function withMissingBuiltins(saved: CustomBadge[]): CustomBadge[] {
  const present = new Set(saved.filter((badge) => badge.builtin).map(builtinKey));
  const missing = DEFAULT_SETTINGS.headerBadges.filter(
    (badge) => badge.builtin && !badge.enabled && !present.has(builtinKey(badge))
  );

  return missing.length === 0 ? saved : [...saved, ...missing];
}

/**
 * Badges are kept as saved, minus anything structurally unusable.
 *
 * A badge with no `property`, `formula` or `derived` can never render a value,
 * and a separator or newline needs none of them, hence the type check rather
 * than a blanket required-field check.
 */
const BADGE_COLORS = new Set<string>(['default', 'green', 'blue', 'purple', 'yellow', 'red']);

/**
 * The per-value colour map, with anything unusable dropped.
 *
 * A colour outside the vocabulary is dropped rather than kept, because it
 * reaches the DOM as `culi-badge-<whatever>` – a class with no rule behind it,
 * which renders as an unstyled pill and reads as a bug in the badge rather
 * than a typo in a setting. The vocabulary is closed for that reason: a name
 * outside it is one no renderer here has a rule for.
 */
function valueColors(val: unknown): Record<string, BadgeColor> | undefined {
  if (!isPlainObject(val)) return undefined;

  const kept: Record<string, BadgeColor> = {};
  for (const [key, color] of Object.entries(val)) {
    if (typeof color === 'string' && BADGE_COLORS.has(color)) kept[key] = color as BadgeColor;
  }
  return Object.keys(kept).length > 0 ? kept : undefined;
}

function badges(val: unknown): CustomBadge[] {
  if (!Array.isArray(val)) return DEFAULT_SETTINGS.headerBadges;
  const kept = val
    .filter((entry): entry is CustomBadge => {
      if (!isPlainObject(entry)) return false;
      if (entry.type === 'separator' || entry.type === 'newline') return true;
      return (
        typeof entry.property === 'string' ||
        typeof entry.formula === 'string' ||
        typeof entry.derived === 'string'
      );
    })
    .map((entry) => {
      // Before anything else looks at it: `builtinKey` identifies a built-in by
      // its `labelKey`, so a stale one would also make the badge unrecognisable
      // to `withMissingBuiltins` and quietly gain it a duplicate.
      const renamed = typeof entry.labelKey === 'string' && RENAMED_LABEL_KEYS[entry.labelKey];
      if (renamed) entry = { ...entry, labelKey: renamed };

      const cleaned = valueColors(entry.valueColors);
      // Deleted rather than left as an empty object, so a map somebody cleared
      // does not survive in `data.json` as `{}` and read as "configured".
      if (cleaned) return { ...entry, valueColors: cleaned };
      const { valueColors: _dropped, ...rest } = entry;
      return rest;
    });
  // An empty list is a legitimate choice (every badge disabled and removed),
  // but an array that validated down to nothing from a non-empty input means
  // the data was corrupt, so restore the built-ins rather than shipping a
  // blank header.
  if (kept.length === 0 && val.length > 0) return DEFAULT_SETTINGS.headerBadges;

  // An empty saved list is left empty: somebody who cleared their header meant
  // it, and re-adding the built-ins would undo that on every load.
  return kept.length === 0 ? kept : withMissingBuiltins(kept);
}

/**
 * The appliance list from a hand-edited `data.json`.
 *
 * An entry needs both an id and a label to be usable: an id with no label has
 * nothing to show, and a label with no id has nothing a rename can preserve. An
 * empty list is honoured rather than replaced with the defaults, unlike the
 * badges: a household with exactly one appliance is a real
 * configuration, and a list that refilled itself would be unclearable. A list
 * that was not a list at all falls back, since that is corruption rather than a
 * choice.
 */
function appliances(val: unknown): ReheatAppliance[] {
  if (!Array.isArray(val)) return getLocalizedAppliances();

  const seen = new Set<string>();
  const kept: ReheatAppliance[] = [];
  for (const entry of val) {
    if (!isPlainObject(entry)) continue;
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const label = typeof entry.label === 'string' ? entry.label.trim() : '';
    // A duplicate id would make two rows edit each other, since everything
    // downstream resolves an appliance by id.
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    kept.push({ id, label });
  }
  return kept;
}

function mealPlanEntries(val: unknown): MealPlanEntry[] {
  if (!Array.isArray(val)) return [];
  return val.filter(
    (entry): entry is MealPlanEntry =>
      isPlainObject(entry) && typeof entry.id === 'string' && typeof entry.mealPath === 'string'
  );
}

function ordersSavedState(val: unknown): OrdersSavedState {
  const d = DEFAULT_SETTINGS.ordersSavedState;
  const o: Record<string, unknown> = isPlainObject(val) ? val : {};
  return {
    sortField: oneOf(
      o.sortField,
      ['order-date', 'delivery-date', 'company', 'total'] as const,
      d.sortField
    ),
    sortDirection: oneOf(o.sortDirection, ['asc', 'desc'] as const, d.sortDirection),
    company: typeof o.company === 'string' ? o.company : null,
    year: typeof o.year === 'string' ? o.year : null,
    withoutDelivery: bool(o.withoutDelivery, d.withoutDelivery),
    search: str(o.search, d.search),
  };
}

function gallerySavedState(val: unknown): GallerySavedState {
  const d = DEFAULT_SETTINGS.gallerySavedState;
  const g: Record<string, unknown> = isPlainObject(val) ? val : {};
  return {
    sortField: oneOf(
      g.sortField,
      ['title', 'date-added', 'date-modified', 'last-eaten', 'times-eaten'] as const,
      d.sortField
    ),
    sortDirection: oneOf(g.sortDirection, ['asc', 'desc'] as const, d.sortDirection),
    folder: typeof g.folder === 'string' ? g.folder : null,
    favoriteOnly: bool(g.favoriteOnly, d.favoriteOnly),
    tag: typeof g.tag === 'string' ? g.tag : null,
    diet: typeof g.diet === 'string' ? g.diet : null,
    neverEaten: bool(g.neverEaten, d.neverEaten),
    excludeAllergens: bool(g.excludeAllergens, d.excludeAllergens),
    search: str(g.search, d.search),
  };
}

export function mergeSettings(raw: unknown): CULItrailSettings {
  const r: Record<string, unknown> = isPlainObject(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  const s: Record<string, unknown> = isPlainObject(r.state) ? r.state : {};

  // Locale-aware defaults rather than DEFAULT_SETTINGS directly, so a first
  // load in a German vault seeds German folder names and German body headings
  // instead of English ones that would then have to be changed by hand.
  //
  // The saved roots are handed in so a vault that relocated its tree gets any
  // newly added sub-folder under THOSE roots rather than under the pristine
  // defaults.
  const f = getLocalizedDefaults({
    rootFolder: typeof r.rootFolder === 'string' ? r.rootFolder : undefined,
    eatingFolder: typeof r.eatingFolder === 'string' ? r.eatingFolder : undefined,
    crmFolder: typeof r.crmFolder === 'string' ? r.crmFolder : undefined,
  });

  return {
    rootFolder: str(r.rootFolder, f.rootFolder),

    eatingFolder: str(r.eatingFolder, f.eatingFolder),
    mealsFolder: str(r.mealsFolder, f.mealsFolder),
    additionalMealFolders: strArray(r.additionalMealFolders, d.additionalMealFolders),
    mealPlansFolder: str(r.mealPlansFolder, f.mealPlansFolder),
    ordersFolder: str(r.ordersFolder, f.ordersFolder),
    deliveriesFolder: str(r.deliveriesFolder, f.deliveriesFolder),

    crmFolder: str(r.crmFolder, f.crmFolder),
    personsFolder: str(r.personsFolder, f.personsFolder),
    companiesFolder: str(r.companiesFolder, f.companiesFolder),

    mealPlanPath: str(r.mealPlanPath, f.mealPlanPath),

    typePropertyName: str(r.typePropertyName, d.typePropertyName),
    mealTypeValue: str(r.mealTypeValue, d.mealTypeValue),
    orderTypeValue: str(r.orderTypeValue, d.orderTypeValue),
    deliveryTypeValue: str(r.deliveryTypeValue, d.deliveryTypeValue),
    personTypeValue: str(r.personTypeValue, d.personTypeValue),
    companyTypeValue: str(r.companyTypeValue, d.companyTypeValue),

    // Read back like any other toggle rather than forced to false on load: a
    // settings page left open across a reload should not re-lock under the
    // cursor half way through a rename.
    unlockPropertyNames: bool(r.unlockPropertyNames, d.unlockPropertyNames),

    // `str()` keeps an empty string rather than filling the default back in,
    // which is what lets a blank name mean "do not write that stamp".
    createdProperty: str(r.createdProperty, d.createdProperty),
    modifiedProperty: str(r.modifiedProperty, d.modifiedProperty),

    personTagProperty: str(r.personTagProperty, d.personTagProperty),
    companyTagProperty: str(r.companyTagProperty, d.companyTagProperty),
    personRolesProperty: str(r.personRolesProperty, d.personRolesProperty),
    companyRolesProperty: str(r.companyRolesProperty, d.companyRolesProperty),

    companyCurrencyProperty: str(r.companyCurrencyProperty, d.companyCurrencyProperty),
    companyPaymentMethodProperty: str(
      r.companyPaymentMethodProperty,
      d.companyPaymentMethodProperty
    ),
    companyInvoiceTimingProperty: str(
      r.companyInvoiceTimingProperty,
      d.companyInvoiceTimingProperty
    ),
    companyShippingFeeProperty: str(r.companyShippingFeeProperty, d.companyShippingFeeProperty),
    companyFreeShippingFromProperty: str(
      r.companyFreeShippingFromProperty,
      d.companyFreeShippingFromProperty
    ),
    companyDiscountTableProperty: str(
      r.companyDiscountTableProperty,
      d.companyDiscountTableProperty
    ),
    companyLinesProperty: str(r.companyLinesProperty, d.companyLinesProperty),
    eligiblePersonTags: str(r.eligiblePersonTags, d.eligiblePersonTags),
    supplierProperty: str(r.supplierProperty, d.supplierProperty),

    enableDashboard: bool(r.enableDashboard, d.enableDashboard),
    showRibbonIcons: bool(r.showRibbonIcons, d.showRibbonIcons),
    openGalleryOnFolderClick: bool(r.openGalleryOnFolderClick, d.openGalleryOnFolderClick),
    openGalleryOnFolderClickSubfolders: bool(
      r.openGalleryOnFolderClickSubfolders,
      d.openGalleryOnFolderClickSubfolders
    ),
    dashboardActivityRangeWeeks: oneOfNum<DashboardActivityRangeWeeks>(
      r.dashboardActivityRangeWeeks,
      [1, 2, 4, 8, 12] as const,
      d.dashboardActivityRangeWeeks
    ),
    gallerySavedState: gallerySavedState(r.gallerySavedState),
    ordersSavedState: ordersSavedState(r.ordersSavedState),

    autoOpenMealView: bool(r.autoOpenMealView, d.autoOpenMealView),
    cleanNoteBody: bool(r.cleanNoteBody, d.cleanNoteBody),
    useFirstBodyImageWhenFrontmatterEmpty: bool(
      r.useFirstBodyImageWhenFrontmatterEmpty,
      d.useFirstBodyImageWhenFrontmatterEmpty
    ),
    defaultMealImage: str(r.defaultMealImage, d.defaultMealImage),

    notesHeading: str(r.notesHeading, f.notesHeading),
    reheatingHeading: str(r.reheatingHeading, f.reheatingHeading),
    reheatAppliances: appliances(r.reheatAppliances),
    reheatTempField: str(r.reheatTempField, d.reheatTempField),
    reheatTimeField: str(r.reheatTimeField, d.reheatTimeField),
    nutritionHeading: str(r.nutritionHeading, d.nutritionHeading),
    micronutrientHeading: str(r.micronutrientHeading, d.micronutrientHeading),

    headerBadges: badges(r.headerBadges),
    showTagsInHeader: bool(r.showTagsInHeader, d.showTagsInHeader),
    prefixTagsWithHash: bool(r.prefixTagsWithHash, d.prefixTagsWithHash),
    showFullTagPath: bool(r.showFullTagPath, d.showFullTagPath),

    nutritionDisplay: oneOf(
      r.nutritionDisplay,
      ['per-serving', 'total'] as const,
      d.nutritionDisplay
    ),
    nutritionSource: oneOf(
      r.nutritionSource,
      ['meal-total', 'per-serving'] as const,
      d.nutritionSource
    ),

    imageProperty: str(r.imageProperty, d.imageProperty),
    servingsProperty: str(r.servingsProperty, d.servingsProperty),
    favoriteProperty: str(r.favoriteProperty, d.favoriteProperty),
    prepTimeProperty: str(r.prepTimeProperty, d.prepTimeProperty),
    reheatTimeProperty: str(r.reheatTimeProperty, d.reheatTimeProperty),
    totalTimeProperty: str(r.totalTimeProperty, d.totalTimeProperty),
    dietProperty: str(r.dietProperty, d.dietProperty),
    allergensProperty: str(r.allergensProperty, d.allergensProperty),
    caloriesProperty: str(r.caloriesProperty, d.caloriesProperty),
    proteinProperty: str(r.proteinProperty, d.proteinProperty),
    fatProperty: str(r.fatProperty, d.fatProperty),
    carbsProperty: str(r.carbsProperty, d.carbsProperty),
    priceProperty: str(r.priceProperty, d.priceProperty),
    kjProperty: str(r.kjProperty, d.kjProperty),
    servingSizeProperty: str(r.servingSizeProperty, d.servingSizeProperty),
    mealLineProperty: str(r.mealLineProperty, d.mealLineProperty),
    mealPriceCurrencyProperty: str(r.mealPriceCurrencyProperty, d.mealPriceCurrencyProperty),

    // The static defaults rather than the locale-aware ones: a frontmatter key
    // is not translated, so there is nothing here for `getLocalizedDefaults()`
    // to have an opinion about.
    caloriesPer100gProperty: str(r.caloriesPer100gProperty, d.caloriesPer100gProperty),
    kjPer100gProperty: str(r.kjPer100gProperty, d.kjPer100gProperty),
    macronutrientsProperty: str(r.macronutrientsProperty, d.macronutrientsProperty),
    micronutrientsProperty: str(r.micronutrientsProperty, d.micronutrientsProperty),
    nutrientNameField: str(r.nutrientNameField, d.nutrientNameField),
    nutrientUnitField: str(r.nutrientUnitField, d.nutrientUnitField),
    nutrientValueField: str(r.nutrientValueField, d.nutrientValueField),

    mealPlanTypeValue: str(r.mealPlanTypeValue, d.mealPlanTypeValue),
    mealPlanWeekProperty: str(r.mealPlanWeekProperty, d.mealPlanWeekProperty),
    mealPlanPersonProperty: str(r.mealPlanPersonProperty, d.mealPlanPersonProperty),
    mealPlanEntriesProperty: str(r.mealPlanEntriesProperty, d.mealPlanEntriesProperty),
    planEntryMealField: str(r.planEntryMealField, d.planEntryMealField),
    planEntryDayField: str(r.planEntryDayField, d.planEntryDayField),
    planEntrySlotField: str(r.planEntrySlotField, d.planEntrySlotField),
    planEntryEatenField: str(r.planEntryEatenField, d.planEntryEatenField),
    planEntryRatingField: str(r.planEntryRatingField, d.planEntryRatingField),
    planEntryTimeField: str(r.planEntryTimeField, d.planEntryTimeField),
    planEntryNoteField: str(r.planEntryNoteField, d.planEntryNoteField),
    planEntryLeftoversField: str(r.planEntryLeftoversField, d.planEntryLeftoversField),
    planEntryIdField: str(r.planEntryIdField, d.planEntryIdField),
    mealSlotFieldName: str(r.mealSlotFieldName, d.mealSlotFieldName),
    autoOpenMealPlanView: bool(r.autoOpenMealPlanView, d.autoOpenMealPlanView),

    eatingHistoryEnabled: bool(r.eatingHistoryEnabled, d.eatingHistoryEnabled),
    eatingHistoryHeading: str(r.eatingHistoryHeading, f.eatingHistoryHeading),
    eatingHistoryFrontmatterProperty: str(
      r.eatingHistoryFrontmatterProperty,
      d.eatingHistoryFrontmatterProperty
    ),
    lastEatenProperty: str(r.lastEatenProperty, d.lastEatenProperty),
    eatenCountProperty: str(r.eatenCountProperty, d.eatenCountProperty),

    myAllergens: strArray(r.myAllergens, d.myAllergens),
    mealDietOptions: strArray(r.mealDietOptions, d.mealDietOptions),
    mealAllergenOptions: strArray(r.mealAllergenOptions, d.mealAllergenOptions),
    mealLineOptions: strArray(r.mealLineOptions, d.mealLineOptions),
    mealSupplierRole: str(r.mealSupplierRole, d.mealSupplierRole),

    orderCompanyProperty: str(r.orderCompanyProperty, d.orderCompanyProperty),
    orderDateProperty: str(r.orderDateProperty, d.orderDateProperty),
    orderDeliveryDateProperty: str(r.orderDeliveryDateProperty, d.orderDeliveryDateProperty),
    orderPriceProperty: str(r.orderPriceProperty, d.orderPriceProperty),
    orderDiscountProperty: str(r.orderDiscountProperty, d.orderDiscountProperty),
    orderShippingProperty: str(r.orderShippingProperty, d.orderShippingProperty),
    orderPriceCurrencyProperty: str(r.orderPriceCurrencyProperty, d.orderPriceCurrencyProperty),
    displayLocale: str(r.displayLocale, d.displayLocale),
    orderDefaultCurrency: str(r.orderDefaultCurrency, d.orderDefaultCurrency),
    orderSelectionsProperty: str(r.orderSelectionsProperty, d.orderSelectionsProperty),
    orderSelectionPersonField: str(r.orderSelectionPersonField, d.orderSelectionPersonField),
    orderSelectionMealsField: str(r.orderSelectionMealsField, d.orderSelectionMealsField),
    orderSelectionItemsField: str(r.orderSelectionItemsField, d.orderSelectionItemsField),
    orderItemMealField: str(r.orderItemMealField, d.orderItemMealField),
    orderItemPriceField: str(r.orderItemPriceField, d.orderItemPriceField),
    orderItemQuantityField: str(r.orderItemQuantityField, d.orderItemQuantityField),
    orderItemDiscountField: str(r.orderItemDiscountField, d.orderItemDiscountField),
    orderVatRateProperty: str(r.orderVatRateProperty, d.orderVatRateProperty),
    orderVatAmountProperty: str(r.orderVatAmountProperty, d.orderVatAmountProperty),
    orderSelectionPropertyPrefix: str(
      r.orderSelectionPropertyPrefix,
      d.orderSelectionPropertyPrefix
    ),
    autoOpenOrderView: bool(r.autoOpenOrderView, d.autoOpenOrderView),
    autoOpenDeliveryView: bool(r.autoOpenDeliveryView, d.autoOpenDeliveryView),

    deliveryDatePropertyName: str(r.deliveryDatePropertyName, d.deliveryDatePropertyName),
    deliveryOrdersProperty: str(r.deliveryOrdersProperty, d.deliveryOrdersProperty),
    deliveryItemsProperty: str(r.deliveryItemsProperty, d.deliveryItemsProperty),
    deliveryItemMealField: str(r.deliveryItemMealField, d.deliveryItemMealField),
    deliveryItemQuantityField: str(r.deliveryItemQuantityField, d.deliveryItemQuantityField),

    state: {
      mealPlan: mealPlanEntries(s.mealPlan),
      mealPlanActivePerson: str(s.mealPlanActivePerson, d.state.mealPlanActivePerson),
      mealPlanViewedWeek: str(s.mealPlanViewedWeek, d.state.mealPlanViewedWeek),
    },
  };
}
