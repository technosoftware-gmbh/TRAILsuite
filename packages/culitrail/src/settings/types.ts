/**
 * The one flat settings interface for CULItrail, plus the value types it is
 * built from.
 *
 * Every folder location, every frontmatter property name and every `type:`
 * value the plugin reads or writes is a field here, so a vault whose notes
 * already use different names never has to rename anything on disk.
 *
 * The value types live here rather than in the area folders that use them,
 * which is the opposite of the obvious arrangement. The dependency direction
 * is the reason: areas depend on settings, settings must not depend on an
 * area. Everything below is either configuration or persisted state, and
 * `settings.state` owns the latter, so this is their home. `src/planning/`
 * and `src/meals/` import these rather than defining them.
 */
/**
 * Re-exported here rather than imported at each site, because everything in
 * the plugin already says `from '../../settings/types'` and where a type is
 * declared is not what those files are about.
 */
import { type ReheatAppliance } from 'trail-core';

export type { ReheatAppliance };

// ══════════════════════════════════════════════════════════════════════════
// Value types
// ══════════════════════════════════════════════════════════════════════════

export type NutritionDisplay = 'per-serving' | 'total';
export type NutritionSource = 'meal-total' | 'per-serving';
export type GallerySortField =
  'title' | 'date-added' | 'date-modified' | 'last-eaten' | 'times-eaten';
export type GallerySortDirection = 'asc' | 'desc';
export type OrdersSortField = 'order-date' | 'delivery-date' | 'company' | 'total';
export type SortDirection = 'asc' | 'desc';
export type DashboardActivityRangeWeeks = 1 | 2 | 4 | 8 | 12;

export type BadgeColor = 'default' | 'green' | 'blue' | 'purple' | 'yellow' | 'red';
export type BadgeValueType = 'auto' | 'minutes';
export type BadgeType = 'badge' | 'separator' | 'newline';
/**
 * A chip is a pill with its label beside its value; a cell is a column in the
 * figure strip, with the label above it.
 *
 * Absent on every badge that ships and on every saved list, and deliberately
 * left absent: `view-model/badge-display.ts` derives it from what the badge
 * resolved to, so nothing has to be repaired on load and a hand-edited
 * `data.json` cannot carry a value that contradicts what is renderable. Setting
 * it is only how a badge that *could* be a cell asks to stay a chip.
 */
export type BadgeDisplay = 'chip' | 'cell';

/**
 * A badge whose value is computed rather than read.
 *
 * A separate field from `property`, not a reserved property name, because these
 * are **not** frontmatter properties: nothing reads or writes `eatingStreak` in a
 * note, and giving it a configurable property name would promise a property that
 * does not exist. Keeping it out of `property` also means a vault that really
 * does carry a `eatingStreak:` property cannot shadow the computed one.
 *
 * `total` is deliberately not in here. It is arithmetic over two frontmatter
 * values and is expressed as a `formula`, which a user can also write; a streak
 * has to walk the eating-history records, which no formula can.
 */
export type BadgeDerived = 'eatingStreak';

/**
 * One pill in the meal header, or a layout element between them.
 *
 * A built-in badge carries `labelKey` and resolves its label through `t()` at
 * render time; a user-defined one carries `label` and is shown verbatim.
 *
 * That split matters more than it looks. Badges are persisted into
 * `data.json` the first time settings are saved, so a built-in whose label
 * were a plain default string would freeze in whatever language the vault
 * happened to be in on that first save, and no later fix could tell an
 * untouched default from a label the user deliberately typed. Storing the key
 * instead means the label follows the locale forever.
 */
/**
 * One way of reheating a bought pre-eaten dish.
 *
 * `id` and `label` are separate for the same reason a grocery category's id and
 * its display name are: the id is what a rename must preserve, and collapsing
 * the two would make the vocabulary untranslatable without editing every note
 * that names an appliance. A note's sub-heading is matched against the label
 * first, then the id, then the shipped defaults in either language, so a vault
 * writing `## Dampfgarer`, `## Steamer` or `## steamer` all resolve to the same
 * appliance.
 */

export interface CustomBadge {
  type?: BadgeType;
  property: string;
  /** Translation key. Set on built-ins, absent on user-defined badges. */
  labelKey?: string;
  /** Literal label. Set on user-defined badges; on a built-in it overrides `labelKey`, which is how "edit a built-in's label" works. */
  label?: string;
  icon?: string;
  color: BadgeColor;
  /**
   * A colour per value, for a badge whose property holds a small vocabulary.
   *
   * `diet` is the case this exists for: one badge, four values, and one green
   * pill for all of them says nothing that the word does not already say.
   * A value with no entry here falls back to `color`, so the map only has to
   * name the values it disagrees with.
   *
   * Keys are matched case-insensitively, because a vault's `Vegetarisch` and
   * `vegetarisch` are the same diet and nobody would think to configure both.
   *
   * **A name from `BadgeColor`, never a hex.** The map says which colour each
   * value *means*; what that colour looks like is the stylesheet's, in the
   * `culi-badge-` rules that tint from one Obsidian colour variable each, so a
   * theme redefining `--color-green` gets a matching badge. A hex here would
   * state the appearance in the setting instead, and a setting carrying its own
   * colour is one no theme can correct.
   */
  valueColors?: Record<string, BadgeColor>;
  valueType: BadgeValueType;
  prefix?: string;
  suffix?: string;
  splitArray: boolean;
  enabled: boolean;
  hideLabel?: boolean;
  /** Forces a badge that could be a strip cell to render as a chip instead. */
  display?: BadgeDisplay;
  /** Expression evaluated against the note's frontmatter, for a badge with no property of its own. */
  formula?: string;
  /** Computed rather than read. Wins over `formula` and `property`, both of which such a badge leaves unset. */
  derived?: BadgeDerived;
  builtin: boolean;
}

/**
 * The orders view's whole filter and sort state, persisted as one unit.
 *
 * Same arrangement as the gallery's below, and for the same reason: it is
 * where somebody left the list, not a preference they set, so it belongs in
 * one blob the toolbar owns rather than in six top-level settings with rows of
 * their own. `tests/settings-coverage.test.ts` exempts both on those terms.
 */
export interface OrdersSavedState {
  sortField: OrdersSortField;
  sortDirection: SortDirection;
  /** One company's title, or null for every company. */
  company: string | null;
  /** A four-digit year as a string, or null for every year. */
  year: string | null;
  /** Only orders nothing has been logged as delivered against. */
  withoutDelivery: boolean;
  search: string;
}

/** The gallery's whole filter and sort state, persisted as one unit rather than as eight top-level keys. */
export interface GallerySavedState {
  sortField: GallerySortField;
  sortDirection: GallerySortDirection;
  folder: string | null;
  favoriteOnly: boolean;
  tag: string | null;
  /** One value of the diet property, such as Vegan. Null is every diet. */
  diet: string | null;
  neverEaten: boolean;
  excludeAllergens: boolean;
  search: string;
}

export interface MealPlanEntry {
  id: string;
  /** Empty for a non-meal entry, which carries a `label` instead. */
  mealPath: string;
  label?: string;
  /**
   * Weekday key, always in English (`monday`, `tuesday`, ...), never a date.
   *
   * A stable key rather than a display name, for the same reason grocery
   * categories are: the weekday is written into the note as a `##` heading,
   * and translating it would orphan every meal-plan note that already exists
   * and sort wrong besides. The grid shows a translated label.
   */
  day?: string;
  /** Meal slot key, likewise English and stable: `breakfast`, `lunch`, `dinner`, `snack`. */
  meal?: string;
  /** The Person note title this entry belongs to. Every note file is per-person. */
  person?: string;
  /** ISO week title. Optional for the same backward-compatibility reason as GroceryItemEntry.week. */
  week?: string;
  /** Rating after the fact, 1 to 5. Distinct from the meal's own ongoing `rating:` frontmatter. */
  rating?: number;
  addedDate: string;
  isLeftovers?: boolean;
  /**
   * The meal was eaten, not merely planned – the state of the note line's
   * checkbox.
   *
   * Optional, and absent rather than `false` when it has never been said. An
   * entry written before this field existed has no opinion about its
   * checkbox, and a writer that read the absence as "not eaten" would un-tick
   * a line for no better reason than the age of the state file.
   */
  eaten?: boolean;
}

// ══════════════════════════════════════════════════════════════════════════
// The settings interface
// ══════════════════════════════════════════════════════════════════════════

export interface CULItrailSettings {
  // ────────────────────────────────────────────────────────────────────────
  // Folders. One CULItrail root, `Eating`, with three sub-folders, plus the
  // two CRM folders shared with APERtrail. `rootFolder` is an optional
  // common parent above both; empty means the vault root, which is the shape
  // the sample vault uses.
  //
  // Each root moves as a unit: change it and its sub-folders follow, or
  // repoint any single sub-folder on its own if a vault organizes that one
  // differently.
  // ────────────────────────────────────────────────────────────────────────
  rootFolder: string;

  eatingFolder: string;
  mealsFolder: string;
  /**
   * Further folders to include in the meal scan scope, for a vault whose
   * meals are spread across more than one place. Never written into: new
   * meals always land in `mealsFolder`.
   *
   * A module root has to be one path or it cannot be a root, which is why
   * this is a second setting rather than `mealsFolder` being an array.
   */
  additionalMealFolders: string[];
  mealPlansFolder: string;
  ordersFolder: string;
  /**
   * One note per delivery.
   *
   * Its own kind rather than a section on the order, because a delivery is not
   * a property of an order: one order can arrive in two boxes a week apart, and
   * one box can settle two orders. Both happen, and neither fits inside an
   * order note without lying about the other.
   */
  deliveriesFolder: string;

  crmFolder: string;
  personsFolder: string;
  companiesFolder: string;

  /**
   * Full path templates rather than folder settings, because the filename
   * encodes which week and which person the note belongs to.
   *
   * `{GGGG}` and `{WW}` are moment.js ISO week-year and week-number tokens,
   * deliberately not `{YYYY}`/`{ww}`, which are calendar-year based and
   * disagree with the ISO week near a year boundary. `{person}` is a second,
   * non-moment token substituted separately, before the date tokens resolve,
   * and holds that person's FULL note title with spaces removed. An earlier
   * version used the first name only and collided when two people shared one.
   */
  mealPlanPath: string;

  // ────────────────────────────────────────────────────────────────────────
  // Identification. A note is identified by folder AND type together, so
  // every kind gets a type value, and all six are settings rather than
  // literals: CULItrail has no folder it can claim was always its own.
  //
  // A blank folder is skipped rather than treated as the vault root, and a
  // blank type value matches nothing rather than everything. Both guards
  // exist so an unconfigured setting hides its folder instead of claiming
  // every note in the vault.
  // ────────────────────────────────────────────────────────────────────────
  typePropertyName: string;
  mealTypeValue: string;
  orderTypeValue: string;
  deliveryTypeValue: string;
  personTypeValue: string;
  companyTypeValue: string;

  /**
   * Whether the settings page will let a property name or a type value be
   * typed into.
   *
   * Off, so those rows are read-only until somebody deliberately turns this on.
   * They have to remain settings - both plugins share the CRM notes and have
   * to agree on what the type property is called, and a vault that already had
   * meal notes before CULItrail existed has its own spelling - but the cost of
   * changing one is nothing like the cost of changing a folder. Renaming a
   * folder moves where the plugin looks. Renaming a property orphans every note
   * that carries the old name, silently: the plugin asks for a property nothing
   * has, so the gallery empties, the diet filter offers nothing, and no error
   * appears anywhere, because "no note has this property" is not an error.
   *
   * A switch rather than a confirmation dialog per row, because the rows are
   * spread over four tabs and the decision is one decision. It is not stored
   * per row for the same reason.
   */
  unlockPropertyNames: boolean;

  /**
   * The note header every note CULItrail writes carries: when the plugin made
   * it, and when it last changed it.
   *
   * Names rather than switches, and a blank one is how a vault turns that
   * stamp off. They are spelled the same as APERtrail's, which reads and
   * writes the shared CRM notes: two plugins stamping one note under two
   * property names would leave it carrying both.
   */
  createdProperty: string;
  modifiedProperty: string;

  // CRM. Person and company get one tag property each rather than sharing
  // one, so neither setting's name has to lie about what it covers. An empty
  // tag filter means "everyone", never "nobody".
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

  // ────────────────────────────────────────────────────────────────────────
  // What a company charges, read off its own note and never written. The
  // reader behind these is deliberately unit-agnostic; see
  // `crm/company-terms.ts` for why, and for what happens when APERtrail wants
  // the same block for hotels.
  // ────────────────────────────────────────────────────────────────────────
  companyCurrencyProperty: string;
  companyPaymentMethodProperty: string;
  companyInvoiceTimingProperty: string;
  companyShippingFeeProperty: string;
  /** Shipping is free from this many meals in one order upward. */
  companyFreeShippingFromProperty: string;
  /** A ladder of `from`/`percent` rows, counted in meals. */
  companyDiscountTableProperty: string;
  /** The ranges a company sells the same dish under, e.g. Alltag, Sport, Weightloss. */
  companyLinesProperty: string;
  eligiblePersonTags: string;
  /**
   * Which company sells a dish, when the answer is not the company on the most
   * recent order naming it.
   *
   * A property rather than a derived value alone, because a dish nobody has
   * ordered yet has no order history to derive from, and because a supplier that
   * has changed its packaging makes the newest order the wrong answer.
   */
  supplierProperty: string;

  // ────────────────────────────────────────────────────────────────────────
  // Library and browsing
  // ────────────────────────────────────────────────────────────────────────
  enableDashboard: boolean;
  showRibbonIcons: boolean;
  openGalleryOnFolderClick: boolean;
  openGalleryOnFolderClickSubfolders: boolean;
  dashboardActivityRangeWeeks: DashboardActivityRangeWeeks;
  gallerySavedState: GallerySavedState;
  ordersSavedState: OrdersSavedState;

  // ────────────────────────────────────────────────────────────────────────
  // Meal view
  // ────────────────────────────────────────────────────────────────────────
  autoOpenMealView: boolean;
  cleanNoteBody: boolean;
  useFirstBodyImageWhenFrontmatterEmpty: boolean;
  defaultMealImage: string;

  notesHeading: string;

  // How to reheat a dish that was bought pre-eaten rather than eaten. One
  // sub-heading per appliance under this heading, in a meal note and, as the
  // supplier's boilerplate, in a company note. See docs/design/ready-meals.md.
  reheatingHeading: string;
  reheatAppliances: ReheatAppliance[];
  // The inline fields a dish uses to supply only the numbers, letting the
  // supplier's wording carry the rest: `[temp:: 95 °C] [time:: 25 min]`.
  reheatTempField: string;
  reheatTimeField: string;

  // The two per-100 g label sections. READ ONLY as of the move to
  // frontmatter: the meal editor writes the four `*Per100g` properties below
  // instead and emits neither section any more.
  //
  // They stay settings because the reader still needs them. A vault is full of
  // meals written before the move, and the only thing that can find the
  // figures in one of those is the heading they were written under. Drop these
  // and every unmigrated meal reads as having no nutrition at all, silently,
  // since a section a note does not have is not an error. They go when the last
  // note has been migrated, which is not a call this plugin gets to make.
  //
  // Plain English literals rather than locale-aware defaults, unlike the three
  // above: these name a section format shared with the packaged-food importer
  // and with every note already carried into the vault, all of which write
  // these exact words. A German default would leave the reader unable to find
  // the table in the notes that already exist. The reader matches
  // case-insensitively, and the setting is here for a vault that names them
  // differently on purpose.
  /** Read-only legacy: the old per-100 g macronutrient section. Nothing writes it. */
  nutritionHeading: string;
  /** Read-only legacy: the old per-100 g micronutrient section. Nothing writes it. */
  micronutrientHeading: string;

  headerBadges: CustomBadge[];
  showTagsInHeader: boolean;
  prefixTagsWithHash: boolean;
  showFullTagPath: boolean;

  nutritionDisplay: NutritionDisplay;
  nutritionSource: NutritionSource;

  // Meal frontmatter property names.
  imageProperty: string;
  servingsProperty: string;
  favoriteProperty: string;
  prepTimeProperty: string;
  reheatTimeProperty: string;
  totalTimeProperty: string;
  dietProperty: string;
  allergensProperty: string;
  caloriesProperty: string;
  proteinProperty: string;
  fatProperty: string;
  carbsProperty: string;
  /**
   * What one portion of this dish costs to buy ready-made.
   *
   * Only meaningful for a dish somebody orders, but read from any meal that
   * states it: a note is the source of truth, and hiding a value somebody typed
   * because the plugin thinks it does not apply is worse than showing it. The
   * currency comes from `orderDefaultCurrency`; there is deliberately no
   * per-meal currency, since a field that is right to leave blank on every
   * note is how a setting becomes noise. See docs/design/badges-and-prices.md.
   */
  priceProperty: string;
  /**
   * Both written by the manual-entry flow. `kjProperty` is read back by
   * nothing and still gets a configurable name, because in this codebase every
   * frontmatter property a feature writes gets one; `servingSizeProperty` is
   * read back by the editor as the weight the per-serving figures derive from,
   * which is why it is the only serving weight a note now carries.
   */
  kjProperty: string;
  servingSizeProperty: string;
  /**
   * Which of the supplier's ranges this meal belongs to.
   *
   * A property rather than a variant inside the note: a company sells the same
   * dish under several lines with different nutrition, different prices and
   * different pictures, which makes them different meals that happen to share a
   * name. One note each is also what this vault already does by hand.
   */
  mealLineProperty: string;
  /**
   * The currency this meal's price is in.
   *
   * Read through a chain rather than as a lone setting: the meal's own property
   * wins, then its supplier's currency, then `orderDefaultCurrency`. A company
   * that bills in one currency therefore states it once, on its own note.
   */
  mealPriceCurrencyProperty: string;

  // ────────────────────────────────────────────────────────────────────────
  // Per-100 g nutrition, in frontmatter.
  //
  // What used to be two Markdown sections in the note body is four properties:
  // two energy scalars and two lists, one entry per nutrient. The move is what
  // lets a meal state a nutrient other than the six the old renderer knew how
  // to print, and what lets Obsidian's own property editor, a Dataview query
  // and every other reader see these figures at all, which a heading buried in
  // the body never allowed.
  //
  // Both energy names carry `Per100g` on purpose. `caloriesProperty` above is
  // the per-serving figure the header badge and the gallery read, and the two
  // have been confused often enough to be worth the longer word: a note
  // carrying `calories: 380` and `caloriesPer100g: 190` states two different
  // true things, and neither name can be shortened without one of them
  // starting to lie about which basis it is on.
  // ────────────────────────────────────────────────────────────────────────
  caloriesPer100gProperty: string;
  kjPer100gProperty: string;
  /** The macronutrient list: fat, saturates, carbohydrates, sugar, fibre, protein. */
  macronutrientsProperty: string;
  /** The micronutrient list: salt, sodium and the vitamins and minerals a label may declare. */
  micronutrientsProperty: string;

  /**
   * Sub-keys WITHIN one entry of the two lists above rather than top-level
   * properties, which is what the `Field` suffix says and why neither list's
   * own name covers them.
   *
   * An entry is `{name, unit, value}`: which nutrient, in what unit, how much.
   * All three get names for the same reason every other frontmatter name here
   * does - a vault already writing `nutrient` and `amount` should change the
   * setting rather than every note - and because `trail-core`'s list reader
   * takes them as arguments instead of assuming them, so nothing downstream
   * has a spelling of its own to fall back on.
   *
   * The unit is stored per entry rather than derived from the nutrient because
   * a label states it: iron is usually mg and occasionally µg, and a reader
   * that assumed the usual would be out by a factor of a thousand without
   * anything looking wrong.
   */
  nutrientNameField: string;
  nutrientUnitField: string;
  nutrientValueField: string;

  // ────────────────────────────────────────────────────────────────────────
  // Planning: the plan note and the eating history it holds. Every property
  // name here is configurable; the week and the person are also in the
  // filename, and the property wins over it.
  // ────────────────────────────────────────────────────────────────────────
  mealPlanTypeValue: string;
  mealPlanWeekProperty: string;
  mealPlanPersonProperty: string;
  mealPlanEntriesProperty: string;
  planEntryMealField: string;
  planEntryDayField: string;
  planEntrySlotField: string;
  planEntryEatenField: string;
  planEntryRatingField: string;
  planEntryTimeField: string;
  planEntryNoteField: string;
  planEntryLeftoversField: string;
  planEntryIdField: string;
  /**
   * The field name a pre-frontmatter plan line wrote its slot under.
   *
   * **Read only.** Nothing writes a checklist line any more, but a note that
   * has not been converted yet still carries `#meal/lunch` or
   * `[meal:: lunch]`, and this is what names that field. It goes when the last
   * vault has been converted, which is not a call this plugin gets to make.
   */
  mealSlotFieldName: string;
  autoOpenMealPlanView: boolean;

  eatingHistoryEnabled: boolean;
  eatingHistoryHeading: string;
  eatingHistoryFrontmatterProperty: string;
  lastEatenProperty: string;
  eatenCountProperty: string;

  myAllergens: string[];

  /**
   * The vocabularies the meal editor offers for the three fields that have one.
   *
   * **Offered, never enforced.** A meal already carrying a value this list does
   * not name keeps it and can still be chosen again: the editor unions these
   * with what the vault actually uses, so configuring the setting late cannot
   * make an existing value unselectable. Empty is therefore a working state and
   * the default, meaning "offer whatever the notes already say".
   *
   * Lines are a third source deep: a supplier that publishes its ranges on its
   * company note contributes those too, and they win the top of the list
   * because they are the answer for a meal from that supplier.
   */
  mealDietOptions: string[];
  mealAllergenOptions: string[];
  mealLineOptions: string[];

  /**
   * The company role a supplier must carry to be offered on a meal.
   *
   * **Empty by default, which offers every company** -- the list this vault has
   * always seen. A vault accumulates every company anybody has ever paid, and
   * a supplier dropdown over two hundred of them is unusable, but narrowing
   * before the companies are classified would hide the ones that are right.
   *
   * So this is the switch, and filling it in is the deliberate act that says
   * "I have marked my suppliers". Set it to `meals` once the companies carry
   * `roles: [meals]`; a company with no roles is then not offered, which is the
   * point.
   */
  mealSupplierRole: string;

  // ────────────────────────────────────────────────────────────────────────
  // Orders. Property names are all configurable; the order number is not
  // among them, because it lives only in the filename
  // (`yyyy-mm-dd-ordernumber.md`).
  // ────────────────────────────────────────────────────────────────────────
  orderCompanyProperty: string;
  orderDateProperty: string;
  orderDeliveryDateProperty: string;
  orderPriceProperty: string;
  /** Taken off the whole order. A line may carry one of its own as well. */
  orderDiscountProperty: string;
  orderShippingProperty: string;
  orderPriceCurrencyProperty: string;
  /**
   * The convention numbers and dates are shown in: a BCP 47 tag, or blank for
   * whatever the machine says.
   *
   * Separate from the interface language, which answers a different question.
   * Every German locale writes a thousand francs `1.000,00` and Switzerland
   * writes `1'000.00`, and the two disagree about what a dot means. Shared with
   * the other two plugins through trail-core's `DISPLAY_CONTRACT`, so one vault
   * is not asked three times.
   */
  displayLocale: string;

  orderDefaultCurrency: string;
  /** The v2 selections list, one entry per person. */
  orderSelectionsProperty: string;
  /** Sub-keys WITHIN a selections entry, not top-level properties, so neither gets a settings-tab row. */
  orderSelectionPersonField: string;
  orderSelectionMealsField: string;
  /**
   * The v3 priced line list, which replaces the bare meal list once any line
   * carries a price or a quantity. An order with neither stays in the v2 shape, so
   * these are unused on a vault that never records what a dish cost.
   */
  orderSelectionItemsField: string;
  orderItemMealField: string;
  orderItemPriceField: string;
  orderItemQuantityField: string;
  /** A discount on this line alone, on top of whatever comes off the whole order. */
  orderItemDiscountField: string;
  /**
   * VAT, stated rather than computed.
   *
   * **Prices are gross.** Every figure in an order note is what was charged,
   * tax included, which is what the notes already hold and what an invoice from
   * a meal company states. These two properties let an order additionally say
   * how much of that was tax, so the invoice can show it as an included line.
   * Nothing is derived from them and no existing order changes meaning by not
   * carrying them.
   */
  orderVatRateProperty: string;
  orderVatAmountProperty: string;
  /**
   * The v1 flat-property-per-person prefix (`selection` -> `selectionStefan`).
   * READ ONLY: kept so pre-v2 order notes still parse and get upgraded on the
   * next save. The v1 scheme keys by first name and collides when two people
   * share one, which is why it was replaced.
   */
  orderSelectionPropertyPrefix: string;
  /**
   * Opening an order note shows it as an invoice rather than as Markdown.
   *
   * The order half of `autoOpenMealView`, and a separate switch rather than
   * one shared with it: somebody who wants a meal rendered has said nothing
   * about how they want to read an order.
   */
  autoOpenOrderView: boolean;
  /**
   * Opening a delivery note shows it as a document rather than as Markdown.
   *
   * Its own switch rather than riding on the order one, for the same reason
   * that one does not ride on the meal one. It defaults on for a reason the
   * order setting does not have: a delivery note holds everything it knows in
   * frontmatter, so Obsidian's own rendering of one is a blank page.
   */
  autoOpenDeliveryView: boolean;

  // ────────────────────────────────────────────────────────────────────────
  // Deliveries: what actually arrived, and when. An order says what was
  // asked for; a delivery says what turned up.
  // ────────────────────────────────────────────────────────────────────────
  /** The date the box arrived. */
  deliveryDatePropertyName: string;
  /** The order or orders this delivery settles, as wikilinks. */
  deliveryOrdersProperty: string;
  /** The list of what arrived, each entry naming a meal and optionally a quantity. */
  deliveryItemsProperty: string;
  deliveryItemMealField: string;
  deliveryItemQuantityField: string;

  // ────────────────────────────────────────────────────────────────────────
  // Persisted runtime state. Data and view state, not configuration, and it
  // appears nowhere on the settings page. The notes are authoritative; the
  // meal-plan entries here are a rebuild-on-demand mirror.
  // ────────────────────────────────────────────────────────────────────────
  state: {
    mealPlan: MealPlanEntry[];
    /** Whose plan the meal-plan view and dashboard currently show. Empty until a person is picked, or when none are configured. */
    mealPlanActivePerson: string;
    /**
     * Which ISO week the meal-plan view is browsing, and which the grocery
     * view is. Two fields because moving one must not move the other: somebody
     * planning next week is usually still shopping for this one.
     *
     * Empty means the current week, resolved at render. Storing the actual
     * week title instead would mean reopening the vault in January still
     * showing whatever week was last looked at in December.
     */
    mealPlanViewedWeek: string;
  };
}
