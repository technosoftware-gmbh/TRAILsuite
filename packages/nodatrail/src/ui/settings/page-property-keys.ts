/**
 * The Property keys sub-page: every frontmatter name NODAtrail reads or writes,
 * grouped by the note type that carries it.
 *
 * Built from a table rather than a hundred hand-written builder chains. That is
 * not only brevity: it is what makes it impossible to add a row that skips the
 * lock, because there is exactly one call to `renderPropertyRow` in the file
 * and every row goes through it.
 *
 * **The labels reuse the strings the rest of the UI already has.** A row naming
 * `billDueDateProperty` is labelled with the same "Due date" the bill editor
 * uses, so a German vault reads the page in German without either translation
 * table growing a hundred entries whose only job is to name a settings row.
 */
import { t } from '../../lang/I18nManager';
import { NODAtrailSettings, StringSettingKey } from '../../settings/types';
import {
  renderClearablePropertyRow,
  renderPropertyLockRow,
  renderPropertyRow,
} from './property-row';
import { sectionCard } from './rows';

/** A vault-facing key and the string that names it on screen. */
interface Row {
  key: StringSettingKey;
  label: string;
  /** True for the two stamps, whose blank value means "do not write that stamp". */
  clearable?: boolean;
}

interface Section {
  heading: string;
  rows: Row[];
}

/**
 * The page, as data.
 *
 * A function rather than a constant because every label is a `t()` call, and a
 * module-level constant would resolve them once at import time, before the
 * catalogue is loaded.
 */
function sections(): Section[] {
  return [
    {
      heading: t('settings.properties.sharedSection'),
      rows: [
        { key: 'typePropertyName', label: t('settings.properties.typePropertyName') },
        {
          key: 'createdProperty',
          label: t('settings.properties.createdProperty'),
          clearable: true,
        },
        {
          key: 'modifiedProperty',
          label: t('settings.properties.modifiedProperty'),
          clearable: true,
        },
        { key: 'imageProperty', label: t('settings.properties.imageProperty') },
        { key: 'iconProperty', label: t('settings.properties.iconProperty') },
        { key: 'priorityProperty', label: t('settings.properties.priorityProperty') },
        { key: 'deadlineProperty', label: t('settings.properties.deadlineProperty') },
        { key: 'archivedProperty', label: t('settings.properties.archivedProperty') },
      ],
    },
    {
      heading: t('types.area'),
      rows: [{ key: 'areaTypeValue', label: t('settings.properties.typePropertyName') }],
    },
    {
      heading: t('types.goal'),
      rows: [
        { key: 'goalTypeValue', label: t('settings.properties.typePropertyName') },
        { key: 'goalAreaProperty', label: t('finance.area') },
        { key: 'goalStatusProperty', label: t('common.status') },
        { key: 'achievedProperty', label: t('para.achieved') },
      ],
    },
    {
      heading: t('types.project'),
      rows: [
        { key: 'projectTypeValue', label: t('settings.properties.typePropertyName') },
        { key: 'projectGoalsProperty', label: t('para.goals') },
        { key: 'projectAreaProperty', label: t('finance.area') },
        { key: 'projectStatusProperty', label: t('common.status') },
        { key: 'completedProperty', label: t('para.completed') },
        { key: 'closedProperty', label: t('para.closed') },
      ],
    },
    {
      heading: t('types.resource'),
      rows: [
        { key: 'resourceTypeValue', label: t('settings.properties.typePropertyName') },
        { key: 'resourceAreaProperty', label: t('finance.area') },
        { key: 'resourceTopicProperty', label: t('finance.category') },
        { key: 'resourceSourceProperty', label: t('finance.document') },
        { key: 'resourceTagProperty', label: t('common.all') },
      ],
    },
    {
      heading: t('plan.title'),
      rows: [
        { key: 'dayTypeValue', label: t('types.day') },
        { key: 'weekTypeValue', label: t('types.week') },
        { key: 'monthTypeValue', label: t('types.month') },
        { key: 'quarterTypeValue', label: t('types.quarter') },
        { key: 'yearTypeValue', label: t('types.year') },
      ],
    },
    {
      heading: t('types.purchase'),
      rows: [
        { key: 'purchaseTypeValue', label: t('settings.properties.typePropertyName') },
        { key: 'purchaseCompanyProperty', label: t('finance.company') },
        { key: 'purchaseAreaProperty', label: t('finance.area') },
        { key: 'purchaseProjectProperty', label: t('finance.project') },
        { key: 'purchaseCategoryProperty', label: t('finance.category') },
        { key: 'purchaseStatusProperty', label: t('common.status') },
        { key: 'purchaseDateProperty', label: t('finance.orderDate') },
        { key: 'purchaseDeliveryDateProperty', label: t('finance.deliveryDate') },
        { key: 'purchaseAmountProperty', label: t('finance.amount') },
        { key: 'purchaseCurrencyProperty', label: t('finance.currency') },
        { key: 'purchaseDiscountProperty', label: t('finance.discount') },
        { key: 'purchaseShippingProperty', label: t('finance.shipping') },
        { key: 'purchaseVatRateProperty', label: t('finance.vatRate') },
        { key: 'purchaseVatAmountProperty', label: t('finance.vatAmount') },
        { key: 'purchaseItemsProperty', label: t('finance.items') },
        { key: 'purchaseDeliveriesProperty', label: t('finance.deliveries') },
        // The four sub-keys of a consignment get rows too. APERtrail's copy of
        // the coverage suite exempts a sub-key from a row; this package's does
        // not, and refuses to let anything ending in Field be exempted at all.
        // That is this plugin's own line and the reason these are here.
        { key: 'purchaseDeliveryDateField', label: t('finance.deliveryArrivedOn') },
        { key: 'purchaseDeliveryItemsField', label: t('finance.items') },
        { key: 'purchaseDeliveryItemNameField', label: t('finance.deliveryItemName') },
        { key: 'purchaseDeliveryItemQuantityField', label: t('finance.deliveryItemQuantity') },
        { key: 'purchaseDeliveryNoteField', label: t('finance.deliveryNote') },
        { key: 'purchaseDocumentProperty', label: t('finance.document') },
        { key: 'purchaseReferenceProperty', label: t('finance.reference') },
        { key: 'purchaseBillProperty', label: t('types.bill') },
        { key: 'purchaseItemNameField', label: t('finance.itemName') },
        { key: 'purchaseItemPriceField', label: t('finance.price') },
        { key: 'purchaseItemQuantityField', label: t('finance.quantity') },
        { key: 'purchaseItemDiscountField', label: t('finance.discount') },
        { key: 'purchaseItemNoteField', label: t('common.edit') },
      ],
    },
    {
      heading: t('types.account'),
      rows: [
        { key: 'accountTypeValue', label: t('settings.properties.typePropertyName') },
        { key: 'accountNumberProperty', label: t('ledger.number') },
        { key: 'accountKindProperty', label: t('ledger.kind') },
        { key: 'accountGroupProperty', label: t('ledger.group') },
        { key: 'accountCurrencyProperty', label: t('finance.currency') },
        { key: 'accountOpeningProperty', label: t('ledger.opening') },
        { key: 'accountOpeningDateProperty', label: t('ledger.openingDate') },
        { key: 'accountClosedProperty', label: t('ledger.closed') },
        { key: 'accountIbanProperty', label: t('ledger.iban') },
        { key: 'accountBankNumberProperty', label: t('ledger.bankAccount') },
        { key: 'accountPersonProperty', label: t('ledger.person') },
      ],
    },
    {
      heading: t('types.journal'),
      rows: [
        { key: 'journalTypeValue', label: t('settings.properties.typePropertyName') },
        { key: 'ledgerAccountProperty', label: t('ledger.account') },
        { key: 'paidFromProperty', label: t('ledger.paidFrom') },
      ],
    },
    {
      heading: t('types.bill'),
      rows: [
        { key: 'billTypeValue', label: t('settings.properties.typePropertyName') },
        { key: 'billCompanyProperty', label: t('finance.company') },
        { key: 'billAreaProperty', label: t('finance.area') },
        { key: 'billCategoryProperty', label: t('finance.category') },
        { key: 'billAmountProperty', label: t('finance.amount') },
        { key: 'billCurrencyProperty', label: t('finance.currency') },
        { key: 'billIssueDateProperty', label: t('finance.issueDate') },
        { key: 'billDueDateProperty', label: t('finance.dueDate') },
        { key: 'billPaidDateProperty', label: t('finance.paidDate') },
        { key: 'billReferenceProperty', label: t('finance.reference') },
        { key: 'billDocumentProperty', label: t('finance.document') },
        { key: 'billDirectionProperty', label: t('finance.direction') },
        { key: 'billRecurringProperty', label: t('types.recurring') },
        { key: 'billPurchaseProperty', label: t('types.purchase') },
        { key: 'billStatusProperty', label: t('common.status') },
        { key: 'billLinesProperty', label: t('finance.items') },
        { key: 'billLineAccountField', label: t('ledger.account') },
        { key: 'billLineAmountField', label: t('finance.amount') },
        { key: 'billLineNoteField', label: t('ledger.legText') },
      ],
    },
    {
      heading: t('types.recurring'),
      rows: [
        { key: 'recurringTypeValue', label: t('settings.properties.typePropertyName') },
        { key: 'recurringCompanyProperty', label: t('finance.company') },
        { key: 'recurringAreaProperty', label: t('finance.area') },
        { key: 'recurringCategoryProperty', label: t('finance.category') },
        { key: 'recurringAmountProperty', label: t('finance.amount') },
        { key: 'recurringCurrencyProperty', label: t('finance.currency') },
        { key: 'recurringCadenceProperty', label: t('cadence.monthly') },
        { key: 'recurringIntervalProperty', label: t('finance.interval') },
        { key: 'recurringStartProperty', label: t('finance.startDate') },
        { key: 'recurringEndProperty', label: t('finance.endDate') },
        { key: 'recurringStatusProperty', label: t('common.status') },
        { key: 'recurringDocumentProperty', label: t('finance.document') },
        { key: 'recurringReferenceProperty', label: t('finance.reference') },
        { key: 'recurringAccountProperty', label: t('ledger.bookedTo') },
      ],
    },
    {
      heading: t('crm.companies'),
      rows: [
        { key: 'companyAccountProperty', label: t('ledger.bookedTo') },
        { key: 'companyCategoryProperty', label: t('finance.category') },
        { key: 'companyPaymentProviderProperty', label: t('crm.paymentProvider') },
      ],
    },
    {
      heading: t('settings.properties.ordersSection'),
      rows: [
        { key: 'orderTypeValue', label: t('settings.properties.typePropertyName') },
        { key: 'orderCompanyProperty', label: t('finance.company') },
        { key: 'orderDateProperty', label: t('finance.orderDate') },
        { key: 'orderPriceProperty', label: t('finance.amount') },
        { key: 'orderPriceCurrencyProperty', label: t('finance.currency') },
      ],
    },
    {
      heading: t('types.budget'),
      rows: [
        { key: 'budgetTypeValue', label: t('settings.properties.typePropertyName') },
        { key: 'budgetPeriodProperty', label: t('common.period') },
        { key: 'budgetCurrencyProperty', label: t('finance.currency') },
        { key: 'budgetLinesProperty', label: t('finance.items') },
        { key: 'budgetLineAccountField', label: t('ledger.account') },
        { key: 'budgetLineRhythmField', label: t('cadence.monthly') },
        { key: 'budgetLineMonthField', label: t('period.month') },
        { key: 'budgetLineOverridesField', label: t('ledger.overrides') },
        { key: 'budgetLineAmountField', label: t('finance.amount') },
        { key: 'budgetLineNoteField', label: t('common.edit') },
      ],
    },
    {
      heading: t('settings.folders.crmSection'),
      rows: [
        { key: 'personTypeValue', label: t('settings.folders.personsFolder') },
        { key: 'companyTypeValue', label: t('settings.folders.companiesFolder') },
        { key: 'personTagProperty', label: t('settings.folders.personsFolder') },
        { key: 'companyTagProperty', label: t('settings.folders.companiesFolder') },
        { key: 'personRolesProperty', label: t('settings.folders.personsFolder') },
        { key: 'companyRolesProperty', label: t('settings.folders.companiesFolder') },
      ],
    },
  ];
}

export interface PropertyPageDeps {
  settings: NODAtrailSettings;
  save: () => Promise<void>;
  refresh: () => void;
}

export function renderPropertyKeysPage(containerEl: HTMLElement, deps: PropertyPageDeps): void {
  const { settings, save, refresh } = deps;

  containerEl.createEl('p', {
    cls: 'nod-settings-intro',
    text: t('settings.properties.description'),
  });
  renderPropertyLockRow(containerEl, settings, save, refresh);

  for (const section of sections()) {
    const card = sectionCard(containerEl, section.heading);

    for (const row of section.rows) {
      const value = settings[row.key];
      const write = async (next: string) => {
        (settings as unknown as Record<string, unknown>)[row.key as string] = next;
        await save();
      };

      if (row.clearable) {
        renderClearablePropertyRow(card, settings, row.label, String(row.key), value, write);
      } else {
        renderPropertyRow(card, settings, row.label, String(row.key), value, write);
      }
    }
  }
}
