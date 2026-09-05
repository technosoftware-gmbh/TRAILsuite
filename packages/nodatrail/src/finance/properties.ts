/**
 * The one mapping from settings to the property names each money parser needs.
 *
 * One place, so four readers, four writers, the budget rollup and the health
 * check cannot disagree about which setting names a bill's due date.
 */
import type {
  BillProperties,
  AccountBudgetProperties,
  PurchaseProperties,
  RecurringProperties,
} from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';

export function purchaseProperties(settings: NODAtrailSettings): PurchaseProperties {
  return {
    typePropertyName: settings.typePropertyName,
    typeValue: settings.purchaseTypeValue,
    companyProperty: settings.purchaseCompanyProperty,
    areaProperty: settings.purchaseAreaProperty,
    projectProperty: settings.purchaseProjectProperty,
    categoryProperty: settings.purchaseCategoryProperty,
    statusProperty: settings.purchaseStatusProperty,
    dateProperty: settings.purchaseDateProperty,
    deliveryDateProperty: settings.purchaseDeliveryDateProperty,
    amountProperty: settings.purchaseAmountProperty,
    currencyProperty: settings.purchaseCurrencyProperty,
    discountProperty: settings.purchaseDiscountProperty,
    shippingProperty: settings.purchaseShippingProperty,
    vatRateProperty: settings.purchaseVatRateProperty,
    vatAmountProperty: settings.purchaseVatAmountProperty,
    itemsProperty: settings.purchaseItemsProperty,
    itemNameField: settings.purchaseItemNameField,
    itemPriceField: settings.purchaseItemPriceField,
    itemQuantityField: settings.purchaseItemQuantityField,
    itemDiscountField: settings.purchaseItemDiscountField,
    itemNoteField: settings.purchaseItemNoteField,
    documentProperty: settings.purchaseDocumentProperty,
    referenceProperty: settings.purchaseReferenceProperty,
    billProperty: settings.purchaseBillProperty,
    deliveriesProperty: settings.purchaseDeliveriesProperty,
    deliveryDateField: settings.purchaseDeliveryDateField,
    deliveryItemsField: settings.purchaseDeliveryItemsField,
    deliveryItemNameField: settings.purchaseDeliveryItemNameField,
    deliveryItemQuantityField: settings.purchaseDeliveryItemQuantityField,
    deliveryNoteField: settings.purchaseDeliveryNoteField,
  };
}

export function billProperties(settings: NODAtrailSettings): BillProperties {
  return {
    typePropertyName: settings.typePropertyName,
    typeValue: settings.billTypeValue,
    companyProperty: settings.billCompanyProperty,
    areaProperty: settings.billAreaProperty,
    categoryProperty: settings.billCategoryProperty,
    amountProperty: settings.billAmountProperty,
    currencyProperty: settings.billCurrencyProperty,
    issueDateProperty: settings.billIssueDateProperty,
    dueDateProperty: settings.billDueDateProperty,
    paidDateProperty: settings.billPaidDateProperty,
    referenceProperty: settings.billReferenceProperty,
    documentProperty: settings.billDocumentProperty,
    directionProperty: settings.billDirectionProperty,
    recurringProperty: settings.billRecurringProperty,
    purchaseProperty: settings.billPurchaseProperty,
    statusProperty: settings.billStatusProperty,
    accountProperty: settings.ledgerAccountProperty,
    linesProperty: settings.billLinesProperty,
    lineAccountField: settings.billLineAccountField,
    lineAmountField: settings.billLineAmountField,
    lineNoteField: settings.billLineNoteField,
    paidFromProperty: settings.paidFromProperty,
  };
}

export function recurringProperties(settings: NODAtrailSettings): RecurringProperties {
  return {
    typePropertyName: settings.typePropertyName,
    typeValue: settings.recurringTypeValue,
    companyProperty: settings.recurringCompanyProperty,
    areaProperty: settings.recurringAreaProperty,
    categoryProperty: settings.recurringCategoryProperty,
    amountProperty: settings.recurringAmountProperty,
    currencyProperty: settings.recurringCurrencyProperty,
    cadenceProperty: settings.recurringCadenceProperty,
    intervalProperty: settings.recurringIntervalProperty,
    startDateProperty: settings.recurringStartProperty,
    endDateProperty: settings.recurringEndProperty,
    statusProperty: settings.recurringStatusProperty,
    documentProperty: settings.recurringDocumentProperty,
    referenceProperty: settings.recurringReferenceProperty,
    accountProperty: settings.recurringAccountProperty,
  };
}

export function budgetProperties(settings: NODAtrailSettings): AccountBudgetProperties {
  return {
    typePropertyName: settings.typePropertyName,
    typeValue: settings.budgetTypeValue,
    periodProperty: settings.budgetPeriodProperty,
    currencyProperty: settings.budgetCurrencyProperty,
    linesProperty: settings.budgetLinesProperty,
    lineAccountField: settings.budgetLineAccountField,
    lineAmountField: settings.budgetLineAmountField,
    lineRhythmField: settings.budgetLineRhythmField,
    lineMonthField: settings.budgetLineMonthField,
    lineNoteField: settings.budgetLineNoteField,
    lineOverridesField: settings.budgetLineOverridesField,
  };
}
