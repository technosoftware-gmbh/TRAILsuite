/**
 * Every setting NODAtrail has.
 *
 * Two conventions the whole file follows, and both are load bearing:
 *
 * **Settings keys carry no prefix.** `areasFolder`, not `paraAreasFolder`. The
 * module a setting belongs to is expressed by the settings page's grouping
 * rather than by the key. The `purchase*`, `bill*`, `recurring*` and `budget*`
 * prefixes that do appear are note-type qualifiers rather than module ones:
 * four different notes each carry a `company` and an `amount`, and one key
 * cannot name all four.
 *
 * **Every vault-facing name is a setting.** Every frontmatter property, every
 * field inside a nested structure and every type value, with a sensible
 * default, so a vault whose notes already use other names never has to rename
 * anything on disk. A key ending in `Property`, `TypeValue` or `Field` names
 * something inside a note, and `tests/property-name-lock.test.ts` goes by that
 * shape rather than by a list.
 */
/**
 * The settings whose value is a string.
 *
 * Every vault-facing name is one of these, and the helpers that read a setting
 * by key stringify it. Now that one setting holds a list, that has to be said
 * in the type rather than discovered when a folder is called `[object Object]`.
 */
export type StringSettingKey = {
  [K in keyof NODAtrailSettings]: NODAtrailSettings[K] extends string ? K : never;
}[keyof NODAtrailSettings];

/** What one unit of a currency is worth in the home currency. */
export interface ExchangeRateSetting {
  currency: string;
  rate: number;
}

/** One learned or hand written import rule. */
export interface ImportRuleSetting {
  /** Matched case insensitively against a statement line's text. */
  match: string;
  /** The account number a matching line belongs to. */
  account: number;
}

export interface NODAtrailSettings {
  // Vault setup ---------------------------------------------------------
  /** An optional common parent above every module root. Empty means the vault root. */
  rootFolder: string;
  showRibbonIcon: boolean;
  /** Locked on a fresh install as much as on an old one. See the settings page. */
  unlockPropertyNames: boolean;
  language: string;

  // Plan folders --------------------------------------------------------
  planRootFolder: string;
  /** Path templates. Tokens: {YYYY} {MM} {DD} {GGGG} {WW} {Q}. */
  dailyPath: string;
  weeklyPath: string;
  monthlyPath: string;
  quarterlyPath: string;
  yearlyPath: string;

  // PARA folders --------------------------------------------------------
  areasFolder: string;
  goalsFolder: string;
  projectsFolder: string;
  resourcesFolder: string;
  /** The archive root. Each category gets a sub-folder of its own beneath it. */
  archiveFolder: string;

  // Finance folders -----------------------------------------------------
  financeFolder: string;
  purchasesFolder: string;
  billsFolder: string;
  recurringFolder: string;
  budgetsFolder: string;
  /** Where the account notes live. About fifty notes that never grow in number. */
  accountsFolder: string;
  /** Where the journal notes live, one per month. */
  journalFolder: string;
  /**
   * Where a new note is filed beneath its module folder, as a template.
   *
   * Tokens: {YYYY} and {MM}, expanded against the date that note is about. A
   * blank template files everything flat. A token with no date behind it drops
   * its segment rather than expanding to nothing, so a note with no date lands
   * in the module folder itself rather than in a folder called `undefined`.
   */
  billSubfolder: string;
  purchaseSubfolder: string;
  budgetSubfolder: string;
  recurringSubfolder: string;
  journalSubfolder: string;
  /**
   * Where a document is filed relative to the note about it.
   *
   * `_documents` puts an invoice in a folder beside its bill note, the way an
   * attachment folder works. Blank leaves documents wherever they already are,
   * which is right for a vault that has its own filing and does not want a
   * plugin moving files about.
   */
  documentSubfolder: string;
  /** Comma separated. Deliberately not the whole vault. */
  taskFolders: string;

  // CRM, shared with the sibling plugins --------------------------------
  crmFolder: string;
  personsFolder: string;
  companiesFolder: string;
  personTypeValue: string;
  companyTypeValue: string;
  personTagProperty: string;
  companyTagProperty: string;
  /**
   * The frontmatter key holding what a Company is: `meals`, `hotel`,
   * `restaurant`. Shared with the other plugins through `CRM_CONTRACT`, because
   * a company that is two of those should say so once.
   */
  /**
   * The frontmatter key holding what a Person is: `vendor`, `customer`,
   * whatever a vault decides. Shared through `CRM_CONTRACT`, and a separate key
   * from the companies' so neither name has to lie about what it covers.
   */
  personRolesProperty: string;
  companyRolesProperty: string;
  /** Comma separated. Empty admits everyone, never nobody. */
  eligiblePersonTags: string;
  /**
   * Which role marks a company an invoice may come **from**, and which marks
   * one an invoice may go **to**. One role each, matched case-insensitively
   * against the company's `roles` list.
   *
   * **Blank offers every company**, which is what both ship as. A vault where
   * nothing is classified must not be a vault with two empty dropdowns, so the
   * narrowing begins only once somebody has said who is who. The same rule
   * CULItrail's supplier filter follows, and for the same reason.
   *
   * Settings rather than the literals `vendor` and `customer`, because the
   * words are the vault's own: the roles list is free text somebody types, and
   * a vault that says `Lieferant` should not have to rename forty notes to use
   * this.
   */
  billVendorRole: string;
  billCustomerRole: string;

  // The day note ---------------------------------------------------------
  /**
   * The three headings the capture dialog files an entry under.
   *
   * **Blank means the translated default**, which is why they ship blank rather
   * than carrying a German string. A default baked into `DEFAULT_SETTINGS` is
   * one language, and the vault that gets the wrong one has no indication why
   * -- the lesson the chart of accounts already taught, where a German vault
   * following Obsidian's own German got an English chart. Put the default in
   * the translation tables and it follows the reader; fill the field in and it
   * is yours for good.
   *
   * Written into a note, so they are the vault's own words rather than ours.
   */
  dayFocusHeading: string;
  dayScheduleHeading: string;
  dayNotesHeading: string;
  /** The week view shows Monday to Friday, with the weekend summarised beneath it. */
  weekWorkdaysOnly: boolean;
  /** `HH:MM`. The lunch band of a week column runs from the first up to, not including, the second. Blank leaves the day split in two. */
  weekLunchStart: string;
  weekLunchEnd: string;
  /**
   * What marks a line that is not a checkbox.
   *
   * A task needs no marker: it is a checkbox, in the format the Tasks plugin
   * and this suite's core already agree about. These three are NODAtrail's own
   * body convention and so are settings rather than literals in logic.
   *
   * Blank writes the line without a marker, which is a plain bullet and a
   * perfectly good answer for somebody who does not want emoji in their notes.
   */
  /**
   * Where an image chosen on a PARA form is written, under the note's own
   * folder. Blank writes it beside the note itself.
   *
   * `_resources` matches Obsidian's own `attachmentFolderPath` of `./_resources`
   * and what every image already in this vault does, so an image filed here and
   * one dragged in by hand land in the same place.
   */
  /**
   * Whether archiving files a note under a year inside its category folder.
   *
   * On for a vault that archives a hundred things a year, off for one that
   * archives ten. **Reading is unaffected either way**: the archive readers ask
   * for the category folder and `isUnderFolder` matches everything beneath it,
   * so turning this on or off never strands a note that is already filed.
   */
  /**
   * Whether a new project gets a folder of its own, named after it.
   *
   * On, a project's note, its documents and its picture sit together and
   * archiving moves all three. Off, a project is one file, which is what a
   * vault with a handful of them wants.
   *
   * **It decides what is written, never what is read.** A project already in a
   * grouping folder, or sitting loose in the projects root, is found either
   * way: the readers ask for the projects folder and `isUnderFolder` matches
   * everything beneath it.
   */
  /**
   * The sub-folder each archived kind is filed under, inside `archiveFolder`.
   *
   * Settings like every other folder name, and defaulted from the translation
   * tables so a German vault archives into `Projekte` rather than `Projects`.
   * `entity-types.ts` records why they were literals and why that stopped
   * holding.
   */
  /**
   * The day a goal or project was closed, as distinct from the day its work was
   * finished.
   *
   * `completed` and `achieved` record the claim -- the work is done. This
   * records the acceptance. They are routinely different days and the gap
   * between them is the thing worth being able to look at.
   */
  closedProperty: string;
  areasArchiveFolder: string;
  goalsArchiveFolder: string;
  projectsArchiveFolder: string;
  resourcesArchiveFolder: string;
  projectFolderPerNote: boolean;
  archiveYearFolders: boolean;
  imageSubfolder: string;
  /**
   * The word that marks a fallback picture in the projects folder's image
   * subfolder. `Default` claims every project; `CN-Default` claims the ones
   * whose title starts with `CN-`. Blank switches the convention off.
   */
  projectDefaultImageName: string;
  dayMeetingMarker: string;
  /**
   * The three markers for a meeting you did not simply say yes to.
   *
   * A calendar knows which of its meetings you are going to: an `.ics`
   * invitation carries your own `PARTSTAT`, and one real year of it reads 712
   * accepted, 486 declined, 328 never answered and 45 tentative. Written with
   * one marker they all look like meetings you are attending, and a day that
   * claims you are in four rooms at once is a day nobody trusts.
   *
   * `dayMeetingMarker` covers accepted and covers a meeting you wrote down
   * yourself, because to a reader those are the same thing: it is on, and you
   * are going. These three cover the rest.
   *
   * Blank means "write it like any other meeting", which is how somebody turns
   * the distinction off without the importer having to offer a switch for it.
   */
  dayMeetingTentativeMarker: string;
  dayMeetingUnansweredMarker: string;
  dayMeetingDeclinedMarker: string;
  dayNoteMarker: string;
  dayIdeaMarker: string;

  // Display -------------------------------------------------------------
  homeCurrency: string;
  currencyOptions: string;
  /** Inside this window a bill reads as due rather than merely open. */
  billDueSoonDays: number;
  /** Comma separated category ids. An id not in the list is still read and shown verbatim. */
  expenseCategories: string;

  // Shared property names -----------------------------------------------
  typePropertyName: string;
  createdProperty: string;
  modifiedProperty: string;
  imageProperty: string;
  iconProperty: string;
  priorityProperty: string;
  deadlineProperty: string;
  archivedProperty: string;

  // Type values ---------------------------------------------------------
  areaTypeValue: string;
  goalTypeValue: string;
  projectTypeValue: string;
  resourceTypeValue: string;
  dayTypeValue: string;
  weekTypeValue: string;
  monthTypeValue: string;
  quarterTypeValue: string;
  yearTypeValue: string;
  purchaseTypeValue: string;
  billTypeValue: string;
  recurringTypeValue: string;
  budgetTypeValue: string;
  accountTypeValue: string;
  journalTypeValue: string;

  // PARA property names -------------------------------------------------
  goalAreaProperty: string;
  goalStatusProperty: string;
  achievedProperty: string;
  projectGoalsProperty: string;
  /** Optional on a project. An explicit value wins over the area derived through its goals. */
  projectAreaProperty: string;
  projectStatusProperty: string;
  completedProperty: string;
  resourceAreaProperty: string;
  resourceTopicProperty: string;
  resourceSourceProperty: string;
  resourceTagProperty: string;

  // Purchase ------------------------------------------------------------
  purchaseCompanyProperty: string;
  purchaseAreaProperty: string;
  purchaseProjectProperty: string;
  purchaseCategoryProperty: string;
  purchaseStatusProperty: string;
  purchaseDateProperty: string;
  purchaseDeliveryDateProperty: string;
  purchaseAmountProperty: string;
  purchaseCurrencyProperty: string;
  purchaseDiscountProperty: string;
  purchaseShippingProperty: string;
  purchaseVatRateProperty: string;
  purchaseVatAmountProperty: string;
  purchaseItemsProperty: string;
  purchaseDocumentProperty: string;
  purchaseReferenceProperty: string;
  purchaseBillProperty: string;
  purchaseItemNameField: string;
  purchaseItemPriceField: string;
  purchaseItemQuantityField: string;
  purchaseItemDiscountField: string;
  purchaseItemNoteField: string;

  /**
   * The consignments a purchase arrived in, when it came in more than one.
   *
   * A sparse list on the purchase note: a purchase that arrived in one go, or
   * has not arrived, carries no such key. See trail-core's
   * `expense/purchase-delivery.ts` for why they live on the purchase rather
   * than as notes of their own, and for why the delivered / partly / ordered
   * status is derived from them and no longer written.
   */
  purchaseDeliveriesProperty: string;
  purchaseDeliveryDateField: string;
  purchaseDeliveryItemsField: string;
  purchaseDeliveryItemNameField: string;
  purchaseDeliveryItemQuantityField: string;
  purchaseDeliveryNoteField: string;

  // Bill ----------------------------------------------------------------
  billCompanyProperty: string;
  billAreaProperty: string;
  billCategoryProperty: string;
  billAmountProperty: string;
  billCurrencyProperty: string;
  billIssueDateProperty: string;
  billDueDateProperty: string;
  billPaidDateProperty: string;
  billReferenceProperty: string;
  billDocumentProperty: string;
  /**
   * Which way an invoice points: `incoming`, or `outgoing` for one the
   * household has sent. Absent means incoming, so the property is written only
   * on the invoices that are not.
   */
  billDirectionProperty: string;
  billRecurringProperty: string;
  billPurchaseProperty: string;
  billStatusProperty: string;
  billLinesProperty: string;
  billLineAccountField: string;
  billLineAmountField: string;
  billLineNoteField: string;

  // Account -------------------------------------------------------------
  /** Unique, and the sort order. Every posting names it. */
  accountNumberProperty: string;
  /** `asset`, `liability`, `income` or `expense`. Stored rather than read off the number band. */
  accountKindProperty: string;
  /** The group path the printed chart is assembled from, `/` separated. */
  accountGroupProperty: string;
  accountCurrencyProperty: string;
  accountOpeningProperty: string;
  accountOpeningDateProperty: string;
  accountClosedProperty: string;
  /** The IBAN, so a statement line naming an account resolves to the note. */
  accountIbanProperty: string;
  /** The number a statement prints, for the accounts that have no IBAN on the file. */
  accountBankNumberProperty: string;
  /** Whose account it is, as a link into the CRM. Blank for a shared one. */
  accountPersonProperty: string;

  /**
   * What a statement line's text says about which account it belongs to.
   *
   * Written by the import as accounts are assigned, so the second month of a
   * statement asks a fraction of what the first did. Listed on the settings
   * page so a rule that has started misfiring can be removed.
   */
  importRules: ImportRuleSetting[];

  /**
   * The conventions money AND dates are written in: `de-CH`, `de-DE`, `en-GB`.
   * Blank follows the machine.
   *
   * Separate from the interface language, because they answer different
   * questions. A Swiss household running a machine set to German reads
   * `1.309,98` where it means `1'309.98`, and the two disagree about what a dot
   * is. Nothing about the number changes; only how it is drawn.
   *
   * **Was `numberLocale`, and covered only money.** The dates beside those
   * figures went on following the machine, and the other two plugins had no
   * such setting at all, so one vault could show three conventions at once. It
   * is trail-core's `DISPLAY_CONTRACT` now, shared by all three. A saved
   * `numberLocale` is carried across in `validate.ts`: this plugin shipped a
   * default of `de-CH` where the contract's is blank, and a vault that took
   * that answer keeps it.
   */
  displayLocale: string;

  /**
   * What one unit of a foreign currency is worth in the home one.
   *
   * Stated by the person rather than fetched. A rate nobody chose is a rate
   * nobody can check, and a balance sheet that moved because a web service did
   * would be one nobody trusts. A currency with no rate here stays out of the
   * totals and is listed beside them.
   */
  exchangeRates: ExchangeRateSetting[];

  // What ties a money note to the ledger ---------------------------------
  /** On a bill, a purchase or a standing charge: the income or expense account it belongs to. */
  ledgerAccountProperty: string;
  /** On a bill or a purchase: the asset account the money left. */
  paidFromProperty: string;

  // Recurring cost ------------------------------------------------------
  recurringCompanyProperty: string;
  recurringAreaProperty: string;
  recurringCategoryProperty: string;
  recurringAmountProperty: string;
  recurringCurrencyProperty: string;
  recurringCadenceProperty: string;
  recurringIntervalProperty: string;
  recurringStartProperty: string;
  recurringEndProperty: string;
  recurringStatusProperty: string;
  recurringDocumentProperty: string;
  recurringReferenceProperty: string;
  /** The account every occurrence of a recurring cost is booked to. */
  recurringAccountProperty: string;

  /**
   * Where a sibling plugin keeps its order notes, and what they call things.
   *
   * NODAtrail does not own orders and does not write one. It reads four facts
   * off a note somebody else's plugin wrote -- who, when, how much, and the
   * number the merchant issued -- so a card statement line naming that number
   * can fill itself in. Nothing here is required: a vault with no orders folder
   * simply finds none.
   */
  /**
   * What a company note calls the account and category its invoices usually use.
   *
   * Not part of the shared CRM contract, which governs where company notes live
   * and what identifies one rather than everything a note may carry. The other
   * two plugins read the fields they know and never see these.
   */
  companyAccountProperty: string;
  companyCategoryProperty: string;
  /**
   * What a company note calls the flag marking it a payment provider.
   *
   * Set on Klarna, PayPal, a card acquirer -- a company that collects for other
   * companies. A statement row naming one of these carries the collector's name
   * where the invoice carries the shop's, so such a row is matched to invoices
   * on the amount and date rather than on a name that will never agree.
   */
  companyPaymentProviderProperty: string;

  ordersFolder: string;
  orderTypeValue: string;
  orderCompanyProperty: string;
  orderDateProperty: string;
  orderPriceProperty: string;
  orderPriceCurrencyProperty: string;

  // Budget --------------------------------------------------------------
  /** The year the budget is for. One note a year: the rhythm makes the months. */
  budgetPeriodProperty: string;
  budgetCurrencyProperty: string;
  budgetLinesProperty: string;
  budgetLineAccountField: string;
  budgetLineAmountField: string;
  budgetLineRhythmField: string;
  /** For a rhythm that skips months: which month it first falls in. */
  budgetLineMonthField: string;
  budgetLineNoteField: string;
  /** Month number to amount, where reality departs from the rhythm. */
  budgetLineOverridesField: string;
}
