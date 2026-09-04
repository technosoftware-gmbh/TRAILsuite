/**
 * The one flat settings interface for APERtrail. Every folder location and
 * every frontmatter property name the plugin reads or writes is a field
 * here, so a vault whose notes already use different names never has to
 * rename anything on disk.
 */
import { ClockFormat } from '../shared/clock';
import { UnitSystem } from '../shared/units';

export interface APERtrailSettings {
  // ══════════════════════════════════════════════════════════════════════
  // Folders. Three modules -- Trips, Places and CRM -- each with its own
  // root, plus one sub-folder per entity type underneath. `rootFolder` is
  // an optional common parent above all three; empty means the vault root,
  // which is the shape the sample vault uses:
  //
  //   Trips/  Places/{Countries,States,Cities,...}  CRM/{People,Companies}
  //
  // Each module moves as a unit: change a module root and its sub-folders
  // follow, or repoint any single sub-folder on its own if a vault
  // organizes that one differently.
  // ══════════════════════════════════════════════════════════════════════
  rootFolder: string;

  tripsFolder: string;

  placesFolder: string;
  countriesFolder: string;
  statesFolder: string;
  citiesFolder: string;
  accommodationFolder: string;
  fnbFolder: string;
  landmarksFolder: string;
  locationsFolder: string;
  photoSpotsFolder: string;

  crmFolder: string;

  typePropertyName: string;
  showRibbonIcon: boolean;

  /**
   * Whether the settings page will let a property name or a type value be
   * typed into.
   *
   * Off, so those rows are read-only until somebody deliberately turns it on.
   * They have to stay settings - both plugins share the CRM notes and have to
   * agree on what the type property is called, and a vault whose notes already
   * use other names never has to rename anything on disk - but the cost of
   * changing one is nothing like the cost of changing a folder. Repointing a
   * folder moves where the plugin looks, and the notes are all still there when
   * it looks somewhere real again. Renaming a property changes what the plugin
   * asks each note for, and every note carrying the old name stops answering:
   * trips lose their dates, places lose their coordinates, and no error appears
   * anywhere, because a property no note has is not an error. Nothing is
   * migrated, because a settings row cannot tell a corrected typo from a vault
   * it is being aimed at.
   */
  unlockPropertyNames: boolean;

  // ══════════════════════════════════════════════════════════════════════
  // CRM -- the people a trip can be shared with, and the companies behind
  // the places it visits. APERtrail owns no contact registry: it reads
  // Person and Company notes out of two configured folders, each matched by
  // its own configured type value (see crm/read-crm.ts). On the tag filter,
  // an empty value means "no filter", so a vault that never configures it
  // still sees every Person rather than none.
  //
  // Unlike every travel type, whose `type:` value is a fixed literal, both
  // CRM type values are settings. That is what lets these stay folders the
  // vault already owned, spelled its own way.
  //
  // Person and Company get a tag property each rather than sharing one, so
  // neither setting's name has to lie about what it covers.
  // ══════════════════════════════════════════════════════════════════════
  personsFolder: string;
  personTypeValue: string;
  personTagProperty: string;
  eligiblePersonTags: string;
  companiesFolder: string;
  companyTypeValue: string;
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

  // Fields a CRM note carries. Address and website are shared with the
  // place types above rather than duplicated here: a street address is a
  // street address whether it belongs to a restaurant or to the company
  // that runs it.
  descriptionProperty: string;
  emailProperty: string;
  phoneProperty: string;
  mobileProperty: string;

  // Geographic-hierarchy wikilink property names, shared across whichever
  // entity types carry them (see docs/design/travel-module-plan.md §3's
  // data model table for which entity has which).
  countryProperty: string;
  stateProperty: string;
  cityProperty: string;
  capitalProperty: string;
  statesProperty: string;
  citiesProperty: string;

  // Fields every place-like entity (Accommodation/FnB/Landmark/Location,
  // plus City) shares.
  geoLocationProperty: string;
  // Contact details a place note carries. English defaults per this
  // codebase's convention; a vault whose notes use different names (the
  // sample vault's photo spots once used `ortAdresse`/`webSeite`) points
  // these settings at them instead of renaming anything on disk.
  addressProperty: string;
  websiteProperty: string;
  ratingProperty: string;
  visitedProperty: string;
  lastVisitProperty: string;
  createdProperty: string;
  modifiedProperty: string;

  // Trip-only fields.
  departureProperty: string;
  returnProperty: string;
  travelTypeProperty: string;
  travelStatusProperty: string;
  reviewStatusProperty: string;

  // ══════════════════════════════════════════════════════════════════════
  // Trip structure -- participants, the cities a trip touches, its timed
  // itinerary, accommodation nights and transport legs. See
  // docs/design/trip-model-redesign.md; the Trip entity previously
  // modeled only a title, a Country and two dates, which could not
  // represent even a single-day trip.
  //
  // tripCitiesProperty is deliberately NOT citiesProperty: that one
  // already means "the Cities belonging to a State" and lives on State
  // notes. Same word, different relationship, so they need distinct
  // settings even though both default to a `cities`-shaped name.
  //
  // The *Field settings name sub-keys WITHIN a list entry, rather than a
  // top-level frontmatter property.
  // ══════════════════════════════════════════════════════════════════════
  /** What the trip is, under what it is called. */
  tripSubtitleProperty: string;
  /** The one picture that stands for the trip, in the gallery and on the sheet. */
  imageProperty: string;
  /** A list of lines, in the order they should read. */
  tripHighlightsProperty: string;
  /** A list of `{image, caption}`. */
  tripGalleryProperty: string;
  galleryImageField: string;
  galleryCaptionField: string;
  tripCitiesProperty: string;
  personsProperty: string;

  stopsProperty: string;
  /**
   * Which day of the trip a stop is on, for an itinerary written before the
   * dates are known. When it is set, the stop's from/to carry a bare time.
   */
  /**
   * What a day of the trip is called, and what it says for itself. Sparse:
   * only a day that carries a title or a paragraph has an entry.
   */
  tripDaysProperty: string;
  dayNumberField: string;
  dayTitleField: string;
  dayNoteField: string;
  stopDayField: string;
  stopPlaceField: string;
  stopFromField: string;
  stopToField: string;
  stopNoteField: string;
  /** Which motif at a photo spot this stop is for. Free text matched against the spot's motif names; see docs/design/photo-spots.md and the enhancements doc §4.1. */
  stopMotifField: string;
  stopRatingField: string;
  /**
   * What a stop is expected to cost, and what that figure is per.
   *
   * Museum entries, guides and cable cars are the third kind of estimate,
   * and the only one that had nowhere to live but a booking note each.
   */
  stopCostField: string;
  stopCurrencyField: string;
  stopCostUnitField: string;
  /** Who this stop is for. Empty means everybody on the trip; see docs/design/trip-budget-and-bookings.md §16.2. */
  stopPersonsField: string;

  nightsProperty: string;
  /** Which day of the trip a stay begins and ends on, for a trip with no dates yet. */
  nightCheckInDayField: string;
  nightCheckOutDayField: string;
  nightAccommodationField: string;
  nightCheckInField: string;
  nightCheckOutField: string;
  /** The same estimate a leg carries, for the other half of a trip that gets priced before it is booked. */
  nightCostField: string;
  nightCurrencyField: string;
  /** What the stay's figure is per: a room per night, the whole stay, or a bed per person. One of the four values in costs/line-cost.ts. */
  nightCostUnitField: string;
  nightPersonsField: string;

  transportProperty: string;
  legDirectionField: string;
  /** Which day of the trip a leg leaves and arrives on. Two, because an overnight leg is ordinary. */
  legDayField: string;
  legToDayField: string;
  /** Who runs a leg: an airline, a railway, a named train. Free text or a wikilink. */
  legCarrierField: string;
  legModeField: string;
  legFromField: string;
  legToField: string;
  legReferenceField: string;
  /**
   * Where a leg starts and ends.
   *
   * `origin`/`destination` rather than `from`/`to`, which already mean the
   * two times. A flight from Zurich to Pretoria is a fact about the leg that
   * neither its mode nor its times can carry, and without it the itinerary's
   * transport band says "Outward journey" and a clock range.
   */
  legOriginField: string;
  legDestinationField: string;
  /**
   * What a leg is expected to cost, while it is still being planned.
   *
   * A figure on the leg rather than a booking note, because the point in a
   * trip's life where this gets typed is the point where there is nothing to
   * book yet. Once a booking carries the same `reference`, the booking wins
   * and this stops counting: see trips/costs/estimates.ts.
   */
  legCostField: string;
  legCurrencyField: string;
  /** What the leg's figure is per. A ticket is quoted per passenger, which is why this exists at all. */
  legCostUnitField: string;
  legPersonsField: string;
  // ══════════════════════════════════════════════════════════════════════
  // Photo spot structure -- the access details a printed location guide
  // prints in its grey box, plus the motifs you actually came for and the
  // sample frames. See docs/design/photo-spots.md §3.
  //
  // The five access fields are deliberately flat top-level properties
  // rather than sub-keys under one `access:` map: Obsidian's property
  // editor renders top-level scalars and refuses nested maps, and every
  // one of these is a value someone will want to edit in the sidebar.
  // motifs/samples/transit are lists of maps, which the property editor
  // already declines to render -- the same bargain stops/nights/transport
  // made on the Trip side.
  //
  // Like the trip-structure sub-key settings above, the *Field settings
  // name sub-keys WITHIN a list entry and get no row on the settings tab.
  // ══════════════════════════════════════════════════════════════════════
  timezoneProperty: string;
  openingHoursProperty: string;
  entryFeeProperty: string;
  accessibilityProperty: string;
  parkingProperty: string;

  transitProperty: string;
  transitModeField: string;
  transitDetailField: string;

  motifsProperty: string;
  motifNameField: string;
  motifRoleField: string;
  motifGeoField: string;
  motifDirectionField: string;
  motifLightField: string;
  motifSeasonField: string;
  motifLensField: string;
  motifGearField: string;
  motifTechniqueField: string;
  motifNoteField: string;
  motifCapturedField: string;
  motifCapturedOnField: string;

  /**
   * Master switch for everything the sun calculation drives: the light
   * panel, the clock times on a motif's light chips, and the front/side/
   * back-lit badges. Off means photo spots still work as place notes.
   *
   * A behaviour toggle rather than a folder or a property name, which is
   * why it sits apart from its neighbours here.
   */
  sunTimesEnabled: boolean;

  /**
   * The UI language, or `auto` to follow Obsidian's own.
   *
   * Following Obsidian is the right default and a poor only-option: a vault
   * owner who runs Obsidian in English and keeps a German vault gets
   * English folder names on first run, and folder names are written into
   * the vault rather than merely displayed.
   */
  /**
   * A booking note's own property names, and the two lists a Trip grows to
   * carry its plan. See docs/design/trip-budget-and-bookings.md §4.
   *
   * Every one of these is a top-level scalar or a list of links, which is
   * what lets Obsidian's own property editor be the booking editor. The four
   * `*Field` names at the end are sub-keys inside a list entry and get no row
   * on the settings tab, the same bargain `stopPlaceField` already made.
   */
  bookingTripProperty: string;
  bookingCategoryProperty: string;
  bookingStatusProperty: string;
  bookingSupplierProperty: string;
  bookingPlaceProperty: string;
  bookingDateProperty: string;
  bookingAmountProperty: string;
  bookingCurrencyProperty: string;
  bookingReferenceProperty: string;
  bookingPayerProperty: string;
  bookingForProperty: string;
  bookingDocumentProperty: string;

  /** The currency a trip plans in, falling back to `homeCurrency`. */
  tripCurrencyProperty: string;
  /** The trip's plan: a ceiling per category. A list of maps, so it is edited from the costs block rather than the property editor. */
  budgetProperty: string;
  budgetCategoryField: string;
  budgetAmountField: string;
  /** The trip's own conversion rates, as the user typed them. Never fetched. */
  ratesProperty: string;
  rateCurrencyField: string;
  rateValueField: string;

  /**
   * Where booking notes live. Under the Trips folder by default, because a
   * booking belongs to a trip and has no meaning without one; the
   * folder-and-type rule and the health check's longest-match rule both
   * handle the nesting. See docs/design/trip-budget-and-bookings.md §3.
   */
  bookingsFolder: string;
  /**
   * The folder a trip keeps its bookings in, inside the trip's own folder.
   * Blank puts every booking in `bookingsFolder` instead.
   */
  tripBookingsSubfolder: string;

  /**
   * The folder a trip keeps its exported sheets in, inside the trip's own
   * folder. Blank writes them beside the note instead.
   */
  tripExportsSubfolder: string;

  /**
   * The convention numbers and dates are shown in: a BCP 47 tag, or blank for
   * whatever the machine says.
   *
   * **A formatting convention is a fact about a place, not about a language.**
   * `I18nManager` follows Obsidian's interface language, which is right for
   * words and useless for separators: every German locale renders a hundred
   * thousand francs as `100.120,20` and Switzerland writes `100'120.20`. The
   * two disagree about what a dot means, which is the one disagreement about a
   * number that matters. Set this to `de-CH` and the vault reads Swiss in
   * German.
   *
   * Shared with the other two plugins through trail-core's `DISPLAY_CONTRACT`,
   * so one vault does not have to be told three times.
   */
  displayLocale: string;

  /**
   * The currency a trip is assumed to be planned in when neither the booking
   * nor the trip says. The one figure in the money feature that starts as a
   * guess, and one settings row changes it.
   */
  homeCurrency: string;

  /**
   * The currencies the money dropdowns offer, in the order they offer them.
   *
   * A short list, not the 180 ISO codes: a vault spends in two or three, and
   * picking one beats typing three letters right every time. The home
   * currency and whatever a note already holds are always offered on top of
   * this, so a cleared list still leaves every field usable. See
   * trips/costs/currency-options.ts.
   */
  currencyOptions: string;

  /**
   * Master switch for everything the cost model drives: the trip costs
   * block, the dashboard's budget tile and the itinerary's cost chips. Off
   * leaves booking notes as ordinary notes, the same bargain
   * `sunTimesEnabled` makes for photo spots.
   */
  budgetEnabled: boolean;

  language: string;

  /** 24-hour, 12-hour, or whatever the locale does. See shared/clock.ts. */
  clockFormat: ClockFormat;

  /** Kilometres or miles. See shared/units.ts. */
  units: UnitSystem;

  samplesProperty: string;
  sampleImageField: string;
  sampleMotifField: string;
  sampleLightField: string;
  sampleExposureField: string;
  sampleCreditField: string;
}
