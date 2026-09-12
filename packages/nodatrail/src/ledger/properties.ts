/** The settings that name an account note's properties, in the shape `trail-core` wants. */
import type { AccountProperties } from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';

export function accountProperties(settings: NODAtrailSettings): AccountProperties {
  return {
    numberProperty: settings.accountNumberProperty,
    kindProperty: settings.accountKindProperty,
    groupProperty: settings.accountGroupProperty,
    currencyProperty: settings.accountCurrencyProperty,
    openingProperty: settings.accountOpeningProperty,
    openingDateProperty: settings.accountOpeningDateProperty,
    closedProperty: settings.accountClosedProperty,
    ibanProperty: settings.accountIbanProperty,
    bankAccountProperty: settings.accountBankNumberProperty,
    personProperty: settings.accountPersonProperty,
  };
}
