# Settings reference

Every setting NODAtrail has, grouped broadly the way `src/settings/types.ts`
groups them and with the default `src/settings/defaults.ts` ships. **Nothing
generates this file**, so `defaults.ts` is the truth and this is a transcription
of it: when the two disagree, the one a fresh install obeys is the source.

A key ending in `Property`, `TypeValue` or `Field` names something inside a
note, and every such row is read-only on the settings page until
`unlockPropertyNames` is turned on. Renaming one changes what the plugin asks
each note for, and every note carrying the old name stops answering with no
error anywhere. Nothing is migrated.

The folder defaults below are what the English catalogue ships. A fresh install
resolves them through the active locale first, and prefers a folder the vault
already has. See [`architecture.md`](architecture.md) section 1.1.

## Vault setup

| Setting | Default |
|---|---|
| `rootFolder` | `''` |
| `showRibbonIcon` | `true` |
| `unlockPropertyNames` | `false` |
| `language` | `'auto'` |

## Plan folders

| Setting | Default |
|---|---|
| `planRootFolder` | `'0 Plan'` |
| `dailyPath` | `'0 Plan/1 Daily/{YYYY}/{YYYY}-{MM}-{DD}.md'` |
| `weeklyPath` | `'0 Plan/2 Weekly/{GGGG}/{GGGG}-W{WW}.md'` |
| `monthlyPath` | `'0 Plan/3 Monthly/{YYYY}/{YYYY}-{MM}.md'` |
| `quarterlyPath` | `'0 Plan/4 Quarterly/{YYYY}/{YYYY}-Q{Q}.md'` |
| `yearlyPath` | `'0 Plan/5 Yearly/{YYYY}.md'` |

## PARA folders

| Setting | Default |
|---|---|
| `areasFolder` | `'1 Areas'` |
| `goalsFolder` | `'2 Goals'` |
| `projectsFolder` | `'3 Projects'` |
| `resourcesFolder` | `'4 Resources'` |
| `archiveFolder` | `'6 Archive'` |

## Finance folders

| Setting | Default |
|---|---|
| `financeFolder` | `'Finance'` |
| `purchasesFolder` | `'Finance/Purchases'` |
| `billsFolder` | `'Finance/Bills'` |
| `recurringFolder` | `'Finance/Recurring'` |
| `budgetsFolder` | `'Finance/Budgets'` |
| `accountsFolder` | `'Finance/Accounts'` |
| `journalFolder` | `'Finance/Journal'` |
| `billSubfolder` | `'{YYYY}/{MM}'` |
| `purchaseSubfolder` | `'{YYYY}/{MM}'` |
| `budgetSubfolder` | `'{YYYY}'` |
| `recurringSubfolder` | `'{YYYY}'` |
| `journalSubfolder` | `'{YYYY}'` |
| `documentSubfolder` | `'_documents'` |
| `taskFolders` | `'0 Plan, 1 Areas, 2 Goals, 3 Projects'` |

## CRM, shared with the sibling plugins

| Setting | Default |
|---|---|
| `crmFolder` | `'CRM'` |
| `personsFolder` | `CRM_CONTRACT.personsFolder` |
| `companiesFolder` | `CRM_CONTRACT.companiesFolder` |
| `personTypeValue` | `CRM_CONTRACT.personTypeValue` |
| `companyTypeValue` | `CRM_CONTRACT.companyTypeValue` |
| `personTagProperty` | `CRM_CONTRACT.personTagProperty` |
| `companyTagProperty` | `CRM_CONTRACT.companyTagProperty` |
| `personRolesProperty` | `CRM_CONTRACT.personRolesProperty` |
| `companyRolesProperty` | `CRM_CONTRACT.companyRolesProperty` |
| `eligiblePersonTags` | `''` |
| `billVendorRole` | `''` |
| `billCustomerRole` | `''` |

## The day note

A blank heading is not "no heading": it means the heading this vault's
language calls it. `headingsFor` returns every language's spelling, so a note
written before Obsidian's language changed is still found rather than given a
second heading beside the first.

| Setting | Default |
|---|---|
| `dayFocusHeading` | `''` |
| `dayScheduleHeading` | `''` |
| `dayNotesHeading` | `''` |
| `dayMeetingMarker` | `'👥'` |
| `dayMeetingTentativeMarker` | `'❓'` |
| `dayMeetingUnansweredMarker` | `'✉️'` |
| `dayMeetingDeclinedMarker` | `'🚫'` |
| `dayNoteMarker` | `'📝'` |
| `dayIdeaMarker` | `'💡'` |
| `weekWorkdaysOnly` | `false` |
| `weekLunchStart` | `'12:00'` |
| `weekLunchEnd` | `'13:00'` |

## PARA notes and the archive

`archiveYearFolders` is why the archive path is
`6 Archive/<Category>/<Year>/` rather than `6 Archive/<Category>/`. It is on by
default because a category folder that only ever grows is one nobody opens
twice.

| Setting | Default |
|---|---|
| `closedProperty` | `'closed'` |
| `projectFolderPerNote` | `true` |
| `imageSubfolder` | `'_resources'` |
| `projectDefaultImageName` | `'Default'` |
| `archiveYearFolders` | `true` |
| `areasArchiveFolder` | `'Areas'` |
| `goalsArchiveFolder` | `'Goals'` |
| `projectsArchiveFolder` | `'Projects'` |
| `resourcesArchiveFolder` | `'Resources'` |

## Display

| Setting | Default |
|---|---|
| `homeCurrency` | `'CHF'` |
| `currencyOptions` | `'CHF, EUR, USD'` |
| `billDueSoonDays` | `7` |
| `expenseCategories` | `'housing, utilities, insurance, health, transport, food, household, leisure, education, tax, fees, savings, gifts, other'` |

## Shared property names

| Setting | Default |
|---|---|
| `typePropertyName` | `CRM_CONTRACT.typePropertyName` |
| `createdProperty` | `'created'` |
| `modifiedProperty` | `'modified'` |
| `imageProperty` | `'image'` |
| `iconProperty` | `'icon'` |
| `priorityProperty` | `'priority'` |
| `deadlineProperty` | `'deadline'` |
| `archivedProperty` | `'archived'` |

## Type values

| Setting | Default |
|---|---|
| `areaTypeValue` | `'area'` |
| `goalTypeValue` | `'goal'` |
| `projectTypeValue` | `'project'` |
| `resourceTypeValue` | `'resource'` |
| `dayTypeValue` | `'day'` |
| `weekTypeValue` | `'week'` |
| `monthTypeValue` | `'month'` |
| `quarterTypeValue` | `'quarter'` |
| `yearTypeValue` | `'year'` |
| `purchaseTypeValue` | `'purchase'` |
| `billTypeValue` | `'bill'` |
| `recurringTypeValue` | `'recurring'` |
| `budgetTypeValue` | `'budget'` |
| `accountTypeValue` | `'account'` |
| `journalTypeValue` | `'journal'` |

## PARA property names

| Setting | Default |
|---|---|
| `goalAreaProperty` | `'area'` |
| `goalStatusProperty` | `'status'` |
| `achievedProperty` | `'achieved'` |
| `projectGoalsProperty` | `'goals'` |
| `projectAreaProperty` | `'area'` |
| `projectStatusProperty` | `'status'` |
| `completedProperty` | `'completed'` |
| `resourceAreaProperty` | `'area'` |
| `resourceTopicProperty` | `'topic'` |
| `resourceSourceProperty` | `'source'` |
| `resourceTagProperty` | `'tags'` |

## Purchase

| Setting | Default |
|---|---|
| `purchaseCompanyProperty` | `'company'` |
| `purchaseAreaProperty` | `'area'` |
| `purchaseProjectProperty` | `'project'` |
| `purchaseCategoryProperty` | `'category'` |
| `purchaseStatusProperty` | `'status'` |
| `purchaseDateProperty` | `'orderDate'` |
| `purchaseDeliveryDateProperty` | `'deliveryDate'` |
| `purchaseAmountProperty` | `'amount'` |
| `purchaseCurrencyProperty` | `'currency'` |
| `purchaseDiscountProperty` | `'discount'` |
| `purchaseShippingProperty` | `'shipping'` |
| `purchaseVatRateProperty` | `'vatRate'` |
| `purchaseVatAmountProperty` | `'vatAmount'` |
| `purchaseItemsProperty` | `'items'` |
| `purchaseDeliveriesProperty` | `'deliveries'` |
| `purchaseDeliveryDateField` | `'date'` |
| `purchaseDeliveryItemsField` | `'items'` |
| `purchaseDeliveryItemNameField` | `'name'` |
| `purchaseDeliveryItemQuantityField` | `'quantity'` |
| `purchaseDeliveryNoteField` | `'note'` |
| `purchaseDocumentProperty` | `'document'` |
| `purchaseReferenceProperty` | `'reference'` |
| `purchaseBillProperty` | `'bill'` |
| `purchaseItemNameField` | `'name'` |
| `purchaseItemPriceField` | `'price'` |
| `purchaseItemQuantityField` | `'quantity'` |
| `purchaseItemDiscountField` | `'discount'` |
| `purchaseItemNoteField` | `'note'` |

## Bill

| Setting | Default |
|---|---|
| `billCompanyProperty` | `'company'` |
| `billAreaProperty` | `'area'` |
| `billCategoryProperty` | `'category'` |
| `billAmountProperty` | `'amount'` |
| `billCurrencyProperty` | `'currency'` |
| `billIssueDateProperty` | `'issueDate'` |
| `billDueDateProperty` | `'dueDate'` |
| `billPaidDateProperty` | `'paidDate'` |
| `billReferenceProperty` | `'reference'` |
| `billDocumentProperty` | `'document'` |
| `billDirectionProperty` | `'direction'` |
| `billRecurringProperty` | `'recurring'` |
| `billPurchaseProperty` | `'purchase'` |
| `billStatusProperty` | `'status'` |
| `billLinesProperty` | `'lines'` |
| `billLineAccountField` | `'account'` |
| `billLineAmountField` | `'amount'` |
| `billLineNoteField` | `'note'` |

## Account

`importRules` and `exchangeRates` are lists rather than strings, and both are
edited on a page of their own rather than in a text row.

| Setting | Default |
|---|---|
| `accountNumberProperty` | `'number'` |
| `accountKindProperty` | `'kind'` |
| `accountGroupProperty` | `'group'` |
| `accountCurrencyProperty` | `'currency'` |
| `accountOpeningProperty` | `'opening'` |
| `accountOpeningDateProperty` | `'openingDate'` |
| `accountClosedProperty` | `'closed'` |
| `accountIbanProperty` | `'iban'` |
| `accountBankNumberProperty` | `'bankAccount'` |
| `accountPersonProperty` | `'person'` |
| `importRules` | `[]` |
| `displayLocale` | `''` |

`displayLocale` was `numberLocale` and defaulted to `'de-CH'`. It covers dates
as well now and is shared with the other two plugins through trail-core's
`DISPLAY_CONTRACT`, whose default is blank: a vault reads whatever this computer
says unless it names a tag. `mergeSettings()` carries a saved `numberLocale`
across, so a vault that took the old Swiss default keeps it.
| `exchangeRates` | `[]` |

## What ties a money note to the ledger

| Setting | Default |
|---|---|
| `ledgerAccountProperty` | `'account'` |
| `paidFromProperty` | `'paidFrom'` |

## Recurring cost

| Setting | Default |
|---|---|
| `recurringCompanyProperty` | `'company'` |
| `recurringAreaProperty` | `'area'` |
| `recurringCategoryProperty` | `'category'` |
| `recurringAmountProperty` | `'amount'` |
| `recurringCurrencyProperty` | `'currency'` |
| `recurringCadenceProperty` | `'cadence'` |
| `recurringIntervalProperty` | `'interval'` |
| `recurringStartProperty` | `'startDate'` |
| `recurringEndProperty` | `'endDate'` |
| `recurringStatusProperty` | `'status'` |
| `recurringDocumentProperty` | `'document'` |
| `recurringReferenceProperty` | `'reference'` |
| `recurringAccountProperty` | `'account'` |

## Company and person defaults

| Setting | Default |
|---|---|
| `companyAccountProperty` | `'account'` |
| `companyCategoryProperty` | `'category'` |
| `companyPaymentProviderProperty` | `'paymentProvider'` |

## Adopted from CULItrail

CULItrail's own defaults, adopted from its settings when it is installed and a
reasonable guess when it is not. They exist so an imported card charge can be
matched against the order that caused it, by reading that plugin's notes rather
than by importing a line of its code.

| Setting | Default |
|---|---|
| `ordersFolder` | `'Eating/Orders'` |
| `orderTypeValue` | `'order'` |
| `orderCompanyProperty` | `'company'` |
| `orderDateProperty` | `'orderDate'` |
| `orderPriceProperty` | `'price'` |
| `orderPriceCurrencyProperty` | `'priceCurrency'` |

## Budget

| Setting | Default |
|---|---|
| `budgetPeriodProperty` | `'period'` |
| `budgetCurrencyProperty` | `'currency'` |
| `budgetLinesProperty` | `'lines'` |
| `budgetLineAccountField` | `'account'` |
| `budgetLineAmountField` | `'amount'` |
| `budgetLineRhythmField` | `'rhythm'` |
| `budgetLineMonthField` | `'month'` |
| `budgetLineNoteField` | `'note'` |
| `budgetLineOverridesField` | `'months'` |
