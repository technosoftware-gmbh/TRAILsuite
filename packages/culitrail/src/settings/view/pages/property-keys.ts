/**
 * The property-keys page: every frontmatter name CULItrail reads or writes, in
 * one place.
 *
 * These 83 rows used to be spread across four tabs, grouped by the feature that
 * happened to read them: a meal's diet on Meal view, an order's VAT rate on
 * Orders, a plan entry's slot on Planning. That is a sensible grouping for
 * somebody changing what the plugin does, and a poor one for somebody matching
 * a vault it did not create, which is the only reason anybody edits these at
 * all. So they are one page now, grouped by the note that carries them, with a
 * filter box for the times you know the name and not the group.
 *
 * The group headings are the ones the tabs already used, so a vault owner who
 * knew where a row lived still recognizes the block it moved into.
 *
 * Every row goes through `identifierRow`, which is what keeps it read-only
 * until the switch at the top is on: renaming one changes what the plugin asks
 * each note for, and every note carrying the old name goes quiet, with no error
 * anywhere, because a property no note has is not an error.
 *
 * The rows are written out one by one rather than looped over a catalogue. A
 * loop would read better and would also make `settings[key] = value` the only
 * assignment in the file, which is exactly what
 * `tests/settings-coverage.test.ts` and `tests/property-name-lock.test.ts` look
 * for by name: both would go quiet, and a setting could lose its row or its
 * lock without either noticing. The verbosity is the check.
 */
import { t } from '../../../lang/I18nManager';
import { identifierRow, propertyNameLockRow } from '../identifier-row';
import { filterRow, sectionCard } from '../rows';
import type { SettingsTabContext } from '../settings-tab';

/** How many names this page holds, for the row that opens it. */
export const PROPERTY_KEY_COUNT = 83;

export function renderPropertyKeysPage(container: HTMLElement, context: SettingsTabContext): void {
  const { settings } = context;

  const top = sectionCard(container, undefined, t('settings.propertyKeys.intro'));
  propertyNameLockRow(top, context);

  // Created before the filter row is wired, because the filter searches this
  // element and the element has to exist to be searched. It still draws after
  // the card above it, which is the order that matters on screen.
  const rows = container.createDiv({ cls: 'culi-settings-rows' });
  filterRow(
    top,
    {
      name: t('settings.propertyKeys.search'),
      desc: t('settings.propertyKeys.searchNote'),
      placeholder: t('settings.propertyKeys.searchPlaceholder'),
    },
    rows
  );

  const identification = rows.createDiv({ cls: 'culi-settings-group' });
  const identificationCard = sectionCard(
    identification,
    t('settings.library.identification'),
    t('settings.library.identificationNote')
  );

  identifierRow(
    identificationCard,
    context,
    { name: t('settings.library.typePropertyName') },
    () => settings.typePropertyName,
    (value) => (settings.typePropertyName = value)
  );
  identifierRow(
    identificationCard,
    context,
    { name: t('settings.library.mealTypeValue') },
    () => settings.mealTypeValue,
    (value) => (settings.mealTypeValue = value)
  );
  identifierRow(
    identificationCard,
    context,
    { name: t('settings.planning.mealPlanTypeValue') },
    () => settings.mealPlanTypeValue,
    (value) => (settings.mealPlanTypeValue = value)
  );
  identifierRow(
    identificationCard,
    context,
    { name: t('settings.orders.orderTypeValue') },
    () => settings.orderTypeValue,
    (value) => (settings.orderTypeValue = value)
  );
  identifierRow(
    identificationCard,
    context,
    { name: t('settings.orders.deliveryTypeValue') },
    () => settings.deliveryTypeValue,
    (value) => (settings.deliveryTypeValue = value)
  );
  identifierRow(
    identificationCard,
    context,
    { name: t('settings.orders.personTypeValue') },
    () => settings.personTypeValue,
    (value) => (settings.personTypeValue = value)
  );
  identifierRow(
    identificationCard,
    context,
    { name: t('settings.orders.companyTypeValue') },
    () => settings.companyTypeValue,
    (value) => (settings.companyTypeValue = value)
  );

  const noteHeader = rows.createDiv({ cls: 'culi-settings-group' });
  const noteHeaderCard = sectionCard(
    noteHeader,
    t('settings.library.noteHeader'),
    t('settings.library.noteHeaderNote')
  );

  identifierRow(
    noteHeaderCard,
    context,
    {
      name: t('settings.library.createdProperty'),
      desc: t('settings.library.createdPropertyDesc'),
    },
    () => settings.createdProperty,
    (value) => (settings.createdProperty = value)
  );
  identifierRow(
    noteHeaderCard,
    context,
    {
      name: t('settings.library.modifiedProperty'),
      desc: t('settings.library.modifiedPropertyDesc'),
    },
    () => settings.modifiedProperty,
    (value) => (settings.modifiedProperty = value)
  );

  const meal = rows.createDiv({ cls: 'culi-settings-group' });
  const mealCard = sectionCard(
    meal,
    t('settings.mealView.properties'),
    t('settings.mealView.propertiesNote')
  );

  identifierRow(
    mealCard,
    context,
    { name: t('settings.mealView.imageProperty') },
    () => settings.imageProperty,
    (value) => (settings.imageProperty = value)
  );
  identifierRow(
    mealCard,
    context,
    { name: t('settings.mealView.servingsProperty') },
    () => settings.servingsProperty,
    (value) => (settings.servingsProperty = value)
  );
  identifierRow(
    mealCard,
    context,
    { name: t('settings.mealView.servingSizeProperty') },
    () => settings.servingSizeProperty,
    (value) => (settings.servingSizeProperty = value)
  );
  identifierRow(
    mealCard,
    context,
    { name: t('settings.mealView.favoriteProperty') },
    () => settings.favoriteProperty,
    (value) => (settings.favoriteProperty = value)
  );
  identifierRow(
    mealCard,
    context,
    { name: t('settings.mealView.prepTimeProperty') },
    () => settings.prepTimeProperty,
    (value) => (settings.prepTimeProperty = value)
  );
  identifierRow(
    mealCard,
    context,
    { name: t('settings.mealView.reheatTimeProperty') },
    () => settings.reheatTimeProperty,
    (value) => (settings.reheatTimeProperty = value)
  );
  identifierRow(
    mealCard,
    context,
    { name: t('settings.mealView.totalTimeProperty') },
    () => settings.totalTimeProperty,
    (value) => (settings.totalTimeProperty = value)
  );
  identifierRow(
    mealCard,
    context,
    { name: t('settings.mealView.dietProperty') },
    () => settings.dietProperty,
    (value) => (settings.dietProperty = value)
  );
  identifierRow(
    mealCard,
    context,
    { name: t('settings.mealView.allergensProperty') },
    () => settings.allergensProperty,
    (value) => (settings.allergensProperty = value)
  );
  identifierRow(
    mealCard,
    context,
    { name: t('settings.mealView.caloriesProperty') },
    () => settings.caloriesProperty,
    (value) => (settings.caloriesProperty = value)
  );
  identifierRow(
    mealCard,
    context,
    { name: t('settings.mealView.proteinProperty') },
    () => settings.proteinProperty,
    (value) => (settings.proteinProperty = value)
  );
  identifierRow(
    mealCard,
    context,
    { name: t('settings.mealView.fatProperty') },
    () => settings.fatProperty,
    (value) => (settings.fatProperty = value)
  );
  identifierRow(
    mealCard,
    context,
    { name: t('settings.mealView.carbsProperty') },
    () => settings.carbsProperty,
    (value) => (settings.carbsProperty = value)
  );
  identifierRow(
    mealCard,
    context,
    { name: t('settings.mealView.priceProperty') },
    () => settings.priceProperty,
    (value) => (settings.priceProperty = value)
  );
  identifierRow(
    mealCard,
    context,
    { name: t('settings.mealView.lineProperty') },
    () => settings.mealLineProperty,
    (value) => (settings.mealLineProperty = value)
  );
  identifierRow(
    mealCard,
    context,
    { name: t('settings.mealView.priceCurrencyProperty') },
    () => settings.mealPriceCurrencyProperty,
    (value) => (settings.mealPriceCurrencyProperty = value)
  );
  identifierRow(
    mealCard,
    context,
    {
      name: t('settings.orders.supplierProperty'),
      desc: t('settings.orders.supplierPropertyDesc'),
    },
    () => settings.supplierProperty,
    (value) => (settings.supplierProperty = value)
  );

  const per100g = rows.createDiv({ cls: 'culi-settings-group' });
  const per100gCard = sectionCard(
    per100g,
    t('settings.mealView.per100g'),
    t('settings.mealView.per100gNote')
  );

  identifierRow(
    per100gCard,
    context,
    { name: t('settings.mealView.caloriesPer100gProperty') },
    () => settings.caloriesPer100gProperty,
    (value) => (settings.caloriesPer100gProperty = value)
  );
  identifierRow(
    per100gCard,
    context,
    { name: t('settings.mealView.kjPer100gProperty') },
    () => settings.kjPer100gProperty,
    (value) => (settings.kjPer100gProperty = value)
  );
  identifierRow(
    per100gCard,
    context,
    { name: t('settings.mealView.macronutrientsProperty') },
    () => settings.macronutrientsProperty,
    (value) => (settings.macronutrientsProperty = value)
  );
  identifierRow(
    per100gCard,
    context,
    { name: t('settings.mealView.micronutrientsProperty') },
    () => settings.micronutrientsProperty,
    (value) => (settings.micronutrientsProperty = value)
  );

  const nutrientFields = rows.createDiv({ cls: 'culi-settings-group' });
  const nutrientFieldsCard = sectionCard(
    nutrientFields,
    t('settings.mealView.nutrientFields'),
    t('settings.mealView.nutrientFieldsNote')
  );

  identifierRow(
    nutrientFieldsCard,
    context,
    { name: t('settings.mealView.nutrientNameField') },
    () => settings.nutrientNameField,
    (value) => (settings.nutrientNameField = value)
  );
  identifierRow(
    nutrientFieldsCard,
    context,
    { name: t('settings.mealView.nutrientUnitField') },
    () => settings.nutrientUnitField,
    (value) => (settings.nutrientUnitField = value)
  );
  identifierRow(
    nutrientFieldsCard,
    context,
    { name: t('settings.mealView.nutrientValueField') },
    () => settings.nutrientValueField,
    (value) => (settings.nutrientValueField = value)
  );

  const writtenOnly = rows.createDiv({ cls: 'culi-settings-group' });
  const writtenOnlyCard = sectionCard(
    writtenOnly,
    t('settings.mealView.writtenOnly'),
    t('settings.mealView.writtenOnlyNote')
  );

  identifierRow(
    writtenOnlyCard,
    context,
    { name: t('settings.mealView.kjProperty') },
    () => settings.kjProperty,
    (value) => (settings.kjProperty = value)
  );

  const reheating = rows.createDiv({ cls: 'culi-settings-group' });
  const reheatingCard = sectionCard(
    reheating,
    t('settings.reheating.section'),
    t('settings.reheating.sectionNote')
  );

  identifierRow(
    reheatingCard,
    context,
    {
      name: t('settings.reheating.tempField'),
      desc: t('settings.reheating.tempFieldDesc'),
    },
    () => settings.reheatTempField,
    (value) => (settings.reheatTempField = value)
  );
  identifierRow(
    reheatingCard,
    context,
    {
      name: t('settings.reheating.timeField'),
      desc: t('settings.reheating.timeFieldDesc'),
    },
    () => settings.reheatTimeField,
    (value) => (settings.reheatTimeField = value)
  );

  const eating = rows.createDiv({ cls: 'culi-settings-group' });
  const eatingCard = sectionCard(
    eating,
    t('settings.planning.eatingHistory'),
    t('settings.planning.eatingHistoryNote')
  );

  identifierRow(
    eatingCard,
    context,
    { name: t('settings.planning.eatingHistoryProperty') },
    () => settings.eatingHistoryFrontmatterProperty,
    (value) => (settings.eatingHistoryFrontmatterProperty = value)
  );
  identifierRow(
    eatingCard,
    context,
    { name: t('settings.planning.lastEatenProperty') },
    () => settings.lastEatenProperty,
    (value) => (settings.lastEatenProperty = value)
  );
  identifierRow(
    eatingCard,
    context,
    { name: t('settings.planning.eatenCountProperty') },
    () => settings.eatenCountProperty,
    (value) => (settings.eatenCountProperty = value)
  );

  const mealPlan = rows.createDiv({ cls: 'culi-settings-group' });
  const mealPlanCard = sectionCard(
    mealPlan,
    t('settings.planning.mealPlan'),
    t('settings.planning.mealPlanNote')
  );

  identifierRow(
    mealPlanCard,
    context,
    { name: t('settings.planning.weekProperty') },
    () => settings.mealPlanWeekProperty,
    (value) => (settings.mealPlanWeekProperty = value)
  );
  identifierRow(
    mealPlanCard,
    context,
    { name: t('settings.planning.personProperty') },
    () => settings.mealPlanPersonProperty,
    (value) => (settings.mealPlanPersonProperty = value)
  );
  identifierRow(
    mealPlanCard,
    context,
    { name: t('settings.planning.entriesProperty') },
    () => settings.mealPlanEntriesProperty,
    (value) => (settings.mealPlanEntriesProperty = value)
  );

  const planEntries = rows.createDiv({ cls: 'culi-settings-group' });
  const planEntriesCard = sectionCard(
    planEntries,
    t('settings.planning.entryFields'),
    t('settings.planning.entryFieldsNote')
  );

  identifierRow(
    planEntriesCard,
    context,
    { name: t('settings.planning.entryMealField') },
    () => settings.planEntryMealField,
    (value) => (settings.planEntryMealField = value)
  );
  identifierRow(
    planEntriesCard,
    context,
    { name: t('settings.planning.entryDayField') },
    () => settings.planEntryDayField,
    (value) => (settings.planEntryDayField = value)
  );
  identifierRow(
    planEntriesCard,
    context,
    { name: t('settings.planning.entrySlotField') },
    () => settings.planEntrySlotField,
    (value) => (settings.planEntrySlotField = value)
  );
  identifierRow(
    planEntriesCard,
    context,
    { name: t('settings.planning.entryEatenField') },
    () => settings.planEntryEatenField,
    (value) => (settings.planEntryEatenField = value)
  );
  identifierRow(
    planEntriesCard,
    context,
    { name: t('settings.planning.entryRatingField') },
    () => settings.planEntryRatingField,
    (value) => (settings.planEntryRatingField = value)
  );
  identifierRow(
    planEntriesCard,
    context,
    { name: t('settings.planning.entryTimeField') },
    () => settings.planEntryTimeField,
    (value) => (settings.planEntryTimeField = value)
  );
  identifierRow(
    planEntriesCard,
    context,
    { name: t('settings.planning.entryNoteField') },
    () => settings.planEntryNoteField,
    (value) => (settings.planEntryNoteField = value)
  );
  identifierRow(
    planEntriesCard,
    context,
    { name: t('settings.planning.entryLeftoversField') },
    () => settings.planEntryLeftoversField,
    (value) => (settings.planEntryLeftoversField = value)
  );
  identifierRow(
    planEntriesCard,
    context,
    { name: t('settings.planning.entryIdField') },
    () => settings.planEntryIdField,
    (value) => (settings.planEntryIdField = value)
  );

  const planReading = rows.createDiv({ cls: 'culi-settings-group' });
  const planReadingCard = sectionCard(
    planReading,
    t('settings.planning.reading'),
    t('settings.planning.readingNote')
  );

  identifierRow(
    planReadingCard,
    context,
    {
      name: t('settings.planning.mealSlotFieldName'),
      desc: t('settings.planning.mealSlotFieldNameDesc'),
    },
    () => settings.mealSlotFieldName,
    (value) => (settings.mealSlotFieldName = value)
  );

  const order = rows.createDiv({ cls: 'culi-settings-group' });
  const orderCard = sectionCard(
    order,
    t('settings.orders.orderNote'),
    t('settings.orders.orderNoteNote')
  );

  identifierRow(
    orderCard,
    context,
    { name: t('settings.orders.companyProperty') },
    () => settings.orderCompanyProperty,
    (value) => (settings.orderCompanyProperty = value)
  );
  identifierRow(
    orderCard,
    context,
    { name: t('settings.orders.orderDateProperty') },
    () => settings.orderDateProperty,
    (value) => (settings.orderDateProperty = value)
  );
  identifierRow(
    orderCard,
    context,
    { name: t('settings.orders.deliveryDateProperty') },
    () => settings.orderDeliveryDateProperty,
    (value) => (settings.orderDeliveryDateProperty = value)
  );
  identifierRow(
    orderCard,
    context,
    { name: t('settings.orders.priceProperty') },
    () => settings.orderPriceProperty,
    (value) => (settings.orderPriceProperty = value)
  );
  identifierRow(
    orderCard,
    context,
    { name: t('settings.orders.priceCurrencyProperty') },
    () => settings.orderPriceCurrencyProperty,
    (value) => (settings.orderPriceCurrencyProperty = value)
  );
  identifierRow(
    orderCard,
    context,
    {
      name: t('settings.orders.discountProperty'),
      desc: t('settings.orders.discountPropertyDesc'),
    },
    () => settings.orderDiscountProperty,
    (value) => (settings.orderDiscountProperty = value)
  );
  identifierRow(
    orderCard,
    context,
    { name: t('settings.orders.shippingProperty') },
    () => settings.orderShippingProperty,
    (value) => (settings.orderShippingProperty = value)
  );

  const vat = rows.createDiv({ cls: 'culi-settings-group' });
  const vatCard = sectionCard(vat, t('settings.orders.vat'), t('settings.orders.vatNote'));

  identifierRow(
    vatCard,
    context,
    { name: t('settings.orders.vatRateProperty') },
    () => settings.orderVatRateProperty,
    (value) => (settings.orderVatRateProperty = value)
  );
  identifierRow(
    vatCard,
    context,
    { name: t('settings.orders.vatAmountProperty') },
    () => settings.orderVatAmountProperty,
    (value) => (settings.orderVatAmountProperty = value)
  );

  const selections = rows.createDiv({ cls: 'culi-settings-group' });
  const selectionsCard = sectionCard(
    selections,
    t('settings.orders.selections'),
    t('settings.orders.selectionsNote')
  );

  identifierRow(
    selectionsCard,
    context,
    { name: t('settings.orders.selectionsProperty') },
    () => settings.orderSelectionsProperty,
    (value) => (settings.orderSelectionsProperty = value)
  );
  identifierRow(
    selectionsCard,
    context,
    { name: t('settings.orders.selectionPersonField') },
    () => settings.orderSelectionPersonField,
    (value) => (settings.orderSelectionPersonField = value)
  );
  identifierRow(
    selectionsCard,
    context,
    { name: t('settings.orders.selectionMealsField') },
    () => settings.orderSelectionMealsField,
    (value) => (settings.orderSelectionMealsField = value)
  );
  identifierRow(
    selectionsCard,
    context,
    {
      name: t('settings.orders.selectionItemsField'),
      desc: t('settings.orders.selectionItemsFieldDesc'),
    },
    () => settings.orderSelectionItemsField,
    (value) => (settings.orderSelectionItemsField = value)
  );
  identifierRow(
    selectionsCard,
    context,
    { name: t('settings.orders.itemMealField') },
    () => settings.orderItemMealField,
    (value) => (settings.orderItemMealField = value)
  );
  identifierRow(
    selectionsCard,
    context,
    { name: t('settings.orders.itemPriceField') },
    () => settings.orderItemPriceField,
    (value) => (settings.orderItemPriceField = value)
  );
  identifierRow(
    selectionsCard,
    context,
    { name: t('settings.orders.itemQuantityField') },
    () => settings.orderItemQuantityField,
    (value) => (settings.orderItemQuantityField = value)
  );
  identifierRow(
    selectionsCard,
    context,
    {
      name: t('settings.orders.itemDiscountField'),
      desc: t('settings.orders.itemDiscountFieldDesc'),
    },
    () => settings.orderItemDiscountField,
    (value) => (settings.orderItemDiscountField = value)
  );

  const delivery = rows.createDiv({ cls: 'culi-settings-group' });
  const deliveryCard = sectionCard(
    delivery,
    t('settings.orders.deliveries'),
    t('settings.orders.deliveriesNote')
  );

  identifierRow(
    deliveryCard,
    context,
    { name: t('settings.orders.deliveryNoteDateProperty') },
    () => settings.deliveryDatePropertyName,
    (value) => (settings.deliveryDatePropertyName = value)
  );
  identifierRow(
    deliveryCard,
    context,
    { name: t('settings.orders.deliveryOrdersProperty') },
    () => settings.deliveryOrdersProperty,
    (value) => (settings.deliveryOrdersProperty = value)
  );
  identifierRow(
    deliveryCard,
    context,
    { name: t('settings.orders.deliveryItemsProperty') },
    () => settings.deliveryItemsProperty,
    (value) => (settings.deliveryItemsProperty = value)
  );
  identifierRow(
    deliveryCard,
    context,
    { name: t('settings.orders.deliveryItemMealField') },
    () => settings.deliveryItemMealField,
    (value) => (settings.deliveryItemMealField = value)
  );
  identifierRow(
    deliveryCard,
    context,
    { name: t('settings.orders.deliveryItemQuantityField') },
    () => settings.deliveryItemQuantityField,
    (value) => (settings.deliveryItemQuantityField = value)
  );

  const crm = rows.createDiv({ cls: 'culi-settings-group' });
  const crmCard = sectionCard(crm, t('settings.orders.crm'), t('settings.orders.crmNote'));

  identifierRow(
    crmCard,
    context,
    { name: t('settings.orders.personTagProperty') },
    () => settings.personTagProperty,
    (value) => (settings.personTagProperty = value)
  );
  identifierRow(
    crmCard,
    context,
    { name: t('settings.orders.companyTagProperty') },
    () => settings.companyTagProperty,
    (value) => (settings.companyTagProperty = value)
  );
  identifierRow(
    crmCard,
    context,
    { name: t('settings.orders.personRolesProperty') },
    () => settings.personRolesProperty,
    (value) => (settings.personRolesProperty = value)
  );
  identifierRow(
    crmCard,
    context,
    { name: t('settings.orders.companyRolesProperty') },
    () => settings.companyRolesProperty,
    (value) => (settings.companyRolesProperty = value)
  );

  const companyTerms = rows.createDiv({ cls: 'culi-settings-group' });
  const companyTermsCard = sectionCard(
    companyTerms,
    t('settings.orders.companyTerms'),
    t('settings.orders.companyTermsNote')
  );

  identifierRow(
    companyTermsCard,
    context,
    { name: t('settings.orders.companyCurrencyProperty') },
    () => settings.companyCurrencyProperty,
    (value) => (settings.companyCurrencyProperty = value)
  );
  identifierRow(
    companyTermsCard,
    context,
    { name: t('settings.orders.companyPaymentMethodProperty') },
    () => settings.companyPaymentMethodProperty,
    (value) => (settings.companyPaymentMethodProperty = value)
  );
  identifierRow(
    companyTermsCard,
    context,
    { name: t('settings.orders.companyInvoiceTimingProperty') },
    () => settings.companyInvoiceTimingProperty,
    (value) => (settings.companyInvoiceTimingProperty = value)
  );
  identifierRow(
    companyTermsCard,
    context,
    { name: t('settings.orders.companyShippingFeeProperty') },
    () => settings.companyShippingFeeProperty,
    (value) => (settings.companyShippingFeeProperty = value)
  );
  identifierRow(
    companyTermsCard,
    context,
    {
      name: t('settings.orders.companyFreeShippingFromProperty'),
      desc: t('settings.orders.companyFreeShippingFromPropertyDesc'),
    },
    () => settings.companyFreeShippingFromProperty,
    (value) => (settings.companyFreeShippingFromProperty = value)
  );
  identifierRow(
    companyTermsCard,
    context,
    {
      name: t('settings.orders.companyDiscountTableProperty'),
      desc: t('settings.orders.companyDiscountTablePropertyDesc'),
    },
    () => settings.companyDiscountTableProperty,
    (value) => (settings.companyDiscountTableProperty = value)
  );
  identifierRow(
    companyTermsCard,
    context,
    {
      name: t('settings.orders.companyLinesProperty'),
      desc: t('settings.orders.companyLinesPropertyDesc'),
    },
    () => settings.companyLinesProperty,
    (value) => (settings.companyLinesProperty = value)
  );
}
