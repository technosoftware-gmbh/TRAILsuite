/**
 * Default settings, plus the locale-aware folder seeding a fresh install
 * starts from.
 *
 * The folder defaults are a transcription rather than a product opinion. The
 * vault NODAtrail was designed against already runs a numbered PARA tree, so
 * these are its folder names, and every one of them is still a setting.
 *
 *   0 Plan/     1 Daily  2 Weekly  3 Monthly  4 Quarterly  5 Yearly
 *   1 Areas/    2 Goals/  3 Projects/  4 Resources/  6 Archive/
 *   Finance/    Purchases  Bills  Recurring  Budgets
 *   CRM/        People  Companies
 *
 * `5 Notes` is deliberately absent: it is a free note store rather than a PARA
 * category, and a plugin that claimed it would start claiming notes nobody
 * filed.
 *
 * `Finance/` is top level beside `Trips/`, `Places/` and `Eating/` rather than
 * inside an area, because a bill is not a project and because writing notes
 * into `1 Areas/6 Finanzen` would be writing into somebody's filing rather than
 * beside it. A bill note links to its document wherever that document lives.
 */
import {
  CRM_CONTRACT,
  DISPLAY_CONTRACT,
  ORDER_CONTRACT,
  joinFolder,
} from '@technosoftware/trail-core';
import { NODAtrailSettings } from './types';
import { I18nManager, t } from '../lang/I18nManager';

export const DEFAULT_SETTINGS: NODAtrailSettings = {
  rootFolder: '',
  showRibbonIcon: true,
  // Locked on a fresh install as much as on an old one: every property name
  // below is what existing notes are read by, and a vault that needs different
  // ones turns this on once and off again.
  unlockPropertyNames: false,
  language: 'auto',

  planRootFolder: '0 Plan',
  dailyPath: '0 Plan/1 Daily/{YYYY}/{YYYY}-{MM}-{DD}.md',
  weeklyPath: '0 Plan/2 Weekly/{GGGG}/{GGGG}-W{WW}.md',
  monthlyPath: '0 Plan/3 Monthly/{YYYY}/{YYYY}-{MM}.md',
  quarterlyPath: '0 Plan/4 Quarterly/{YYYY}/{YYYY}-Q{Q}.md',
  yearlyPath: '0 Plan/5 Yearly/{YYYY}.md',

  areasFolder: '1 Areas',
  goalsFolder: '2 Goals',
  projectsFolder: '3 Projects',
  resourcesFolder: '4 Resources',
  archiveFolder: '6 Archive',

  financeFolder: 'Finance',
  purchasesFolder: 'Finance/Purchases',
  billsFolder: 'Finance/Bills',
  recurringFolder: 'Finance/Recurring',
  budgetsFolder: 'Finance/Budgets',
  accountsFolder: 'Finance/Accounts',
  journalFolder: 'Finance/Journal',
  // A year of bills is a few hundred notes and a month of them is a handful,
  // which is the size a folder is still worth opening. A budget and a standing
  // charge are a handful per year already, so a month folder there would hold
  // one note and cost a click.
  billSubfolder: '{YYYY}/{MM}',
  purchaseSubfolder: '{YYYY}/{MM}',
  budgetSubfolder: '{YYYY}',
  recurringSubfolder: '{YYYY}',
  // A journal note is one a month by construction, so the year is the only
  // level that could hold anything.
  journalSubfolder: '{YYYY}',
  documentSubfolder: '_documents',
  taskFolders: '0 Plan, 1 Areas, 2 Goals, 3 Projects',

  crmFolder: 'CRM',
  // The seven values below come from trail-core's CRM_CONTRACT rather than
  // being spelled here, because APERtrail and CULItrail ship the identical ones
  // and all three have to find each other's Person and Company notes in a fresh
  // vault. tests/crm-contract.test.ts fails if this stops matching.
  personsFolder: CRM_CONTRACT.personsFolder,
  companiesFolder: CRM_CONTRACT.companiesFolder,
  personTypeValue: CRM_CONTRACT.personTypeValue,
  companyTypeValue: CRM_CONTRACT.companyTypeValue,
  personTagProperty: CRM_CONTRACT.personTagProperty,
  companyTagProperty: CRM_CONTRACT.companyTagProperty,
  personRolesProperty: CRM_CONTRACT.personRolesProperty,
  companyRolesProperty: CRM_CONTRACT.companyRolesProperty,
  eligiblePersonTags: '',
  // Blank on purpose: see the note on these in `types.ts`. Blank is not "no
  // heading", it is "the heading this vault's language calls it".
  dayFocusHeading: '',
  dayScheduleHeading: '',
  dayNotesHeading: '',
  // Off, so the view keeps the seven days it already had. A working week is a
  // preference about somebody's job, not a default about calendars.
  weekWorkdaysOnly: false,
  weekLunchStart: '12:00',
  weekLunchEnd: '13:00',
  closedProperty: 'closed',
  areasArchiveFolder: 'Areas',
  goalsArchiveFolder: 'Goals',
  projectsArchiveFolder: 'Projects',
  resourcesArchiveFolder: 'Resources',
  projectFolderPerNote: true,
  archiveYearFolders: true,
  imageSubfolder: '_resources',
  projectDefaultImageName: 'Default',
  dayMeetingMarker: '👥',
  dayMeetingTentativeMarker: '❓',
  dayMeetingUnansweredMarker: '✉️',
  dayMeetingDeclinedMarker: '🚫',
  dayNoteMarker: '📝',
  dayIdeaMarker: '💡',
  // Blank on purpose: see the note on these in `types.ts`. Narrowing an
  // unclassified vault's pickers to nothing would be worse than not narrowing.
  billVendorRole: '',
  billCustomerRole: '',

  homeCurrency: 'CHF',
  currencyOptions: 'CHF, EUR, USD',
  billDueSoonDays: 7,
  expenseCategories:
    'housing, utilities, insurance, health, transport, food, household, leisure, education, tax, fees, savings, gifts, other',

  typePropertyName: CRM_CONTRACT.typePropertyName,
  createdProperty: 'created',
  modifiedProperty: 'modified',
  imageProperty: 'image',
  iconProperty: 'icon',
  priorityProperty: 'priority',
  deadlineProperty: 'deadline',
  archivedProperty: 'archived',

  areaTypeValue: 'area',
  goalTypeValue: 'goal',
  projectTypeValue: 'project',
  resourceTypeValue: 'resource',
  dayTypeValue: 'day',
  weekTypeValue: 'week',
  monthTypeValue: 'month',
  // The vault's one existing quarter note says `month`, which is a note that is
  // wrong rather than a default that should be. The health check reports it and
  // a command fixes it; nothing here rewrites it.
  quarterTypeValue: 'quarter',
  yearTypeValue: 'year',
  purchaseTypeValue: 'purchase',
  billTypeValue: 'bill',
  recurringTypeValue: 'recurring',
  budgetTypeValue: 'budget',
  accountTypeValue: 'account',
  journalTypeValue: 'journal',

  accountNumberProperty: 'number',
  accountKindProperty: 'kind',
  accountGroupProperty: 'group',
  accountCurrencyProperty: 'currency',
  accountOpeningProperty: 'opening',
  accountOpeningDateProperty: 'openingDate',
  accountClosedProperty: 'closed',
  accountIbanProperty: 'iban',
  accountBankNumberProperty: 'bankAccount',
  accountPersonProperty: 'person',
  importRules: [],
  displayLocale: DISPLAY_CONTRACT.displayLocale,
  exchangeRates: [],
  ledgerAccountProperty: 'account',
  paidFromProperty: 'paidFrom',

  goalAreaProperty: 'area',
  goalStatusProperty: 'status',
  achievedProperty: 'achieved',
  projectGoalsProperty: 'goals',
  projectAreaProperty: 'area',
  projectStatusProperty: 'status',
  completedProperty: 'completed',
  resourceAreaProperty: 'area',
  resourceTopicProperty: 'topic',
  resourceSourceProperty: 'source',
  resourceTagProperty: 'tags',

  purchaseCompanyProperty: 'company',
  purchaseAreaProperty: 'area',
  purchaseProjectProperty: 'project',
  purchaseCategoryProperty: 'category',
  purchaseStatusProperty: 'status',
  purchaseDateProperty: 'orderDate',
  purchaseDeliveryDateProperty: 'deliveryDate',
  purchaseAmountProperty: 'amount',
  purchaseCurrencyProperty: 'currency',
  purchaseDiscountProperty: 'discount',
  purchaseShippingProperty: 'shipping',
  purchaseVatRateProperty: 'vatRate',
  purchaseVatAmountProperty: 'vatAmount',
  purchaseItemsProperty: 'items',
  purchaseDocumentProperty: 'document',
  purchaseReferenceProperty: 'reference',
  purchaseBillProperty: 'bill',
  purchaseItemNameField: 'name',
  purchaseItemPriceField: 'price',
  purchaseItemQuantityField: 'quantity',
  purchaseItemDiscountField: 'discount',
  purchaseItemNoteField: 'note',
  purchaseDeliveriesProperty: 'deliveries',
  purchaseDeliveryDateField: 'date',
  purchaseDeliveryItemsField: 'items',
  purchaseDeliveryItemNameField: 'name',
  purchaseDeliveryItemQuantityField: 'quantity',
  purchaseDeliveryNoteField: 'note',

  billCompanyProperty: 'company',
  billAreaProperty: 'area',
  billCategoryProperty: 'category',
  billAmountProperty: 'amount',
  billCurrencyProperty: 'currency',
  billIssueDateProperty: 'issueDate',
  billDueDateProperty: 'dueDate',
  billPaidDateProperty: 'paidDate',
  billReferenceProperty: 'reference',
  billDocumentProperty: 'document',
  billDirectionProperty: 'direction',
  billRecurringProperty: 'recurring',
  billPurchaseProperty: 'purchase',
  billStatusProperty: 'status',
  billLinesProperty: 'lines',
  billLineAccountField: 'account',
  billLineAmountField: 'amount',
  billLineNoteField: 'note',

  recurringCompanyProperty: 'company',
  recurringAreaProperty: 'area',
  recurringCategoryProperty: 'category',
  recurringAmountProperty: 'amount',
  recurringCurrencyProperty: 'currency',
  recurringCadenceProperty: 'cadence',
  recurringIntervalProperty: 'interval',
  recurringStartProperty: 'startDate',
  recurringEndProperty: 'endDate',
  recurringStatusProperty: 'status',
  recurringDocumentProperty: 'document',
  recurringReferenceProperty: 'reference',
  recurringAccountProperty: 'account',

  companyAccountProperty: 'account',
  companyCategoryProperty: 'category',
  companyPaymentProviderProperty: 'paymentProvider',

  // CULItrail's own defaults, held in trail-core's ORDER_CONTRACT so both sides
  // ship one set of values rather than two lists of literals that nothing
  // compares. Adopted from the sibling's settings when it is installed; when it
  // is not, these are what an order note written by a fresh CULItrail looks
  // like. tests/order-contract.test.ts fails if this stops matching.
  ordersFolder: ORDER_CONTRACT.ordersFolder,
  orderTypeValue: ORDER_CONTRACT.orderTypeValue,
  orderCompanyProperty: ORDER_CONTRACT.orderCompanyProperty,
  orderDateProperty: ORDER_CONTRACT.orderDateProperty,
  orderPriceProperty: ORDER_CONTRACT.orderPriceProperty,
  orderPriceCurrencyProperty: ORDER_CONTRACT.orderPriceCurrencyProperty,

  budgetPeriodProperty: 'period',
  budgetCurrencyProperty: 'currency',
  budgetLinesProperty: 'lines',
  budgetLineAccountField: 'account',
  budgetLineAmountField: 'amount',
  budgetLineRhythmField: 'rhythm',
  budgetLineMonthField: 'month',
  budgetLineNoteField: 'note',
  budgetLineOverridesField: 'months',
};

export type FolderDefaultKey =
  | 'rootFolder'
  | 'planRootFolder'
  | 'dailyPath'
  | 'weeklyPath'
  | 'monthlyPath'
  | 'quarterlyPath'
  | 'yearlyPath'
  | 'areasFolder'
  | 'goalsFolder'
  | 'projectsFolder'
  | 'resourcesFolder'
  | 'archiveFolder'
  | 'areasArchiveFolder'
  | 'goalsArchiveFolder'
  | 'projectsArchiveFolder'
  | 'resourcesArchiveFolder'
  | 'financeFolder'
  | 'purchasesFolder'
  | 'billsFolder'
  | 'recurringFolder'
  | 'budgetsFolder'
  | 'accountsFolder'
  | 'journalFolder'
  | 'crmFolder'
  | 'personsFolder'
  | 'companiesFolder';

export type FolderDefaults = Record<FolderDefaultKey, string>;

/** The module roots a vault can move independently. Everything else hangs off one of them. */
export interface SavedFolderRoots {
  rootFolder?: string;
  planRootFolder?: string;
  financeFolder?: string;
  crmFolder?: string;
}

/**
 * Whether a folder is already in the vault, so seeding can prefer it.
 *
 * A predicate rather than a vault, because this file is pure and is unit
 * tested. `main.ts` passes one backed by `app.vault`; a test passes a set.
 */
export type FolderExists = (path: string) => boolean;

/**
 * Folder defaults resolved through the active locale, preferring a folder the
 * vault already has.
 *
 * The plain localised seeding the sibling plugins do would put `1 Bereiche`
 * into a German-locale install whose vault calls that folder `1 Areas`, and the
 * plugin would then find nothing while looking perfectly configured. Nothing
 * about that failure is visible on the settings page.
 *
 * So each folder has two candidates, the localised name and the English one,
 * and the English one wins when it exists in the vault and the localised one
 * does not. It never renames, never moves, and never overrides a value already
 * saved. A vault with neither folder gets the localised name, which is the
 * behaviour the other two plugins have.
 *
 * The saved roots are handed in so a vault that has already moved its tree gets
 * any sub-folder setting added LATER under THAT root rather than under the
 * pristine default.
 */
export function getLocalizedFolderDefaults(
  saved: SavedFolderRoots = {},
  exists: FolderExists = () => false
): FolderDefaults {
  const english = englishDefaults(saved);

  let localized: FolderDefaults;
  try {
    I18nManager.getInstance();
    localized = localizedDefaults(saved);
  } catch {
    // No catalogue loaded: unit tests, and the first moments of plugin load.
    return english;
  }

  const resolved = {} as FolderDefaults;
  for (const key of Object.keys(english) as FolderDefaultKey[]) {
    resolved[key] = preferExisting(localized[key], english[key], exists);
  }
  return resolved;
}

/**
 * The localised candidate unless the vault visibly means the English one.
 *
 * Path templates carry tokens, so the folder to test is the part before the
 * first token. That is enough to tell `0 Plan/1 Täglich/...` from
 * `0 Plan/1 Daily/...` without expanding a date.
 */
function preferExisting(localized: string, english: string, exists: FolderExists): string {
  if (localized === english) return localized;

  const localizedFolder = folderPartOf(localized);
  const englishFolder = folderPartOf(english);
  if (!englishFolder) return localized;

  return !exists(localizedFolder) && exists(englishFolder) ? english : localized;
}

/** A path or template reduced to the folder that can be tested for existence. */
function folderPartOf(value: string): string {
  const beforeToken = value.split('{')[0] ?? value;
  const trimmed = beforeToken.replace(/\/$/, '');
  return trimmed.endsWith('.md') ? trimmed.slice(0, trimmed.lastIndexOf('/')) : trimmed;
}

function englishDefaults(saved: SavedFolderRoots): FolderDefaults {
  const rootFolder = (saved.rootFolder ?? '').trim();
  const plan = saved.planRootFolder?.trim() || joinFolder(rootFolder, '0 Plan');
  const finance = saved.financeFolder?.trim() || joinFolder(rootFolder, 'Finance');
  const crm = saved.crmFolder?.trim() || joinFolder(rootFolder, 'CRM');

  return {
    rootFolder,
    planRootFolder: plan,
    dailyPath: `${joinFolder(plan, '1 Daily')}/{YYYY}/{YYYY}-{MM}-{DD}.md`,
    weeklyPath: `${joinFolder(plan, '2 Weekly')}/{GGGG}/{GGGG}-W{WW}.md`,
    monthlyPath: `${joinFolder(plan, '3 Monthly')}/{YYYY}/{YYYY}-{MM}.md`,
    quarterlyPath: `${joinFolder(plan, '4 Quarterly')}/{YYYY}/{YYYY}-Q{Q}.md`,
    yearlyPath: `${joinFolder(plan, '5 Yearly')}/{YYYY}.md`,
    areasFolder: joinFolder(rootFolder, '1 Areas'),
    goalsFolder: joinFolder(rootFolder, '2 Goals'),
    projectsFolder: joinFolder(rootFolder, '3 Projects'),
    resourcesFolder: joinFolder(rootFolder, '4 Resources'),
    archiveFolder: joinFolder(rootFolder, '6 Archive'),
    areasArchiveFolder: 'Areas',
    goalsArchiveFolder: 'Goals',
    projectsArchiveFolder: 'Projects',
    resourcesArchiveFolder: 'Resources',
    financeFolder: finance,
    purchasesFolder: joinFolder(finance, 'Purchases'),
    billsFolder: joinFolder(finance, 'Bills'),
    recurringFolder: joinFolder(finance, 'Recurring'),
    budgetsFolder: joinFolder(finance, 'Budgets'),
    accountsFolder: joinFolder(finance, 'Accounts'),
    journalFolder: joinFolder(finance, 'Journal'),
    crmFolder: crm,
    personsFolder: joinFolder(crm, 'People'),
    companiesFolder: joinFolder(crm, 'Companies'),
  };
}

function localizedDefaults(saved: SavedFolderRoots): FolderDefaults {
  const rootFolder = (saved.rootFolder ?? t('settings.folders.defaults.rootFolderPath')).trim();
  const plan =
    saved.planRootFolder?.trim() ||
    joinFolder(rootFolder, t('settings.folders.defaults.planFolderName'));
  const finance =
    saved.financeFolder?.trim() ||
    joinFolder(rootFolder, t('settings.folders.defaults.financeFolderName'));
  const crm =
    saved.crmFolder?.trim() || joinFolder(rootFolder, t('settings.folders.defaults.crmFolderName'));

  const name = (key: string) => t(`settings.folders.defaults.${key}`);

  return {
    rootFolder,
    planRootFolder: plan,
    dailyPath: `${joinFolder(plan, name('dailyFolderName'))}/{YYYY}/{YYYY}-{MM}-{DD}.md`,
    weeklyPath: `${joinFolder(plan, name('weeklyFolderName'))}/{GGGG}/{GGGG}-W{WW}.md`,
    monthlyPath: `${joinFolder(plan, name('monthlyFolderName'))}/{YYYY}/{YYYY}-{MM}.md`,
    quarterlyPath: `${joinFolder(plan, name('quarterlyFolderName'))}/{YYYY}/{YYYY}-Q{Q}.md`,
    yearlyPath: `${joinFolder(plan, name('yearlyFolderName'))}/{YYYY}.md`,
    areasFolder: joinFolder(rootFolder, name('areasFolderName')),
    goalsFolder: joinFolder(rootFolder, name('goalsFolderName')),
    projectsFolder: joinFolder(rootFolder, name('projectsFolderName')),
    resourcesFolder: joinFolder(rootFolder, name('resourcesFolderName')),
    archiveFolder: joinFolder(rootFolder, name('archiveFolderName')),
    areasArchiveFolder: name('areasArchiveFolderName'),
    goalsArchiveFolder: name('goalsArchiveFolderName'),
    projectsArchiveFolder: name('projectsArchiveFolderName'),
    resourcesArchiveFolder: name('resourcesArchiveFolderName'),
    financeFolder: finance,
    purchasesFolder: joinFolder(finance, name('purchasesFolderName')),
    billsFolder: joinFolder(finance, name('billsFolderName')),
    recurringFolder: joinFolder(finance, name('recurringFolderName')),
    budgetsFolder: joinFolder(finance, name('budgetsFolderName')),
    accountsFolder: joinFolder(finance, name('accountsFolderName')),
    journalFolder: joinFolder(finance, name('journalFolderName')),
    crmFolder: crm,
    personsFolder: joinFolder(crm, name('personsFolderName')),
    companiesFolder: joinFolder(crm, name('companiesFolderName')),
  };
}

/** The archive sub-folder one category is filed under. */
export function archiveSubfolder(archiveRoot: string, category: string): string {
  return joinFolder(archiveRoot, category);
}

/** A comma-separated setting as a list, blanks dropped. */
export function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}
