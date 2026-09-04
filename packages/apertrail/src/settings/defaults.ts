/**
 * Default settings for APERtrail, plus the locale-aware folder defaults a
 * fresh install starts from.
 *
 * The defaults mirror the shape of the APERtrail sample vault: three
 * top-level modules, each owning its own notes.
 *
 *   Trips/                one note per trip
 *   Places/               everything a trip can point at
 *     Countries, States, Cities,
 *     Accommodation, Food & Beverages, Landmarks, Locations, Photo Spots
 *   CRM/                  the people and companies a trip involves
 *     People, Companies
 *
 * `rootFolder` is an optional common parent above all three. It defaults to
 * empty, meaning "the vault root", so a vault dedicated to travel gets the
 * clean three-folder tree above; set it to e.g. `4 Resources/Travel` and
 * the whole tree moves underneath that in one step. That empty root is why
 * every path here is built with trail-core's `joinFolder()`, which drops a
 * blank segment instead of producing a leading slash.
 */
import { CRM_CONTRACT, DISPLAY_CONTRACT, joinFolder } from 'trail-core';
import { APERtrailSettings } from './types';
import { I18nManager, t } from '../lang/I18nManager';

export const DEFAULT_SETTINGS: APERtrailSettings = {
  rootFolder: '',

  tripsFolder: 'Trips',
  bookingsFolder: 'Trips/Bookings',
  tripBookingsSubfolder: 'Bookings',
  tripExportsSubfolder: 'Exports',

  placesFolder: 'Places',
  countriesFolder: 'Places/Countries',
  statesFolder: 'Places/States',
  citiesFolder: 'Places/Cities',
  accommodationFolder: 'Places/Accommodation',
  fnbFolder: 'Places/Food & Beverages',
  landmarksFolder: 'Places/Landmarks',
  locationsFolder: 'Places/Locations',
  photoSpotsFolder: 'Places/Photo Spots',

  crmFolder: 'CRM',
  // The seven values below come from trail-core's CRM_CONTRACT rather than
  // being spelled here, because CULItrail has to ship the identical ones for
  // both plugins to find each other's Person and Company notes in a fresh
  // vault. They were prose in each plugin's CLAUDE.md until one side drifted.
  // tests/crm-contract.test.ts fails if this stops matching.
  personsFolder: CRM_CONTRACT.personsFolder,
  companiesFolder: CRM_CONTRACT.companiesFolder,

  typePropertyName: CRM_CONTRACT.typePropertyName,
  showRibbonIcon: true,
  // Locked, on a fresh install as much as on an old one: every property name
  // below is what existing notes are read by, and a vault that needs different
  // ones turns this on once and off again.
  unlockPropertyNames: false,

  personTypeValue: CRM_CONTRACT.personTypeValue,
  personTagProperty: CRM_CONTRACT.personTagProperty,
  eligiblePersonTags: '',
  companyTypeValue: CRM_CONTRACT.companyTypeValue,
  companyTagProperty: CRM_CONTRACT.companyTagProperty,
  personRolesProperty: CRM_CONTRACT.personRolesProperty,
  companyRolesProperty: CRM_CONTRACT.companyRolesProperty,

  descriptionProperty: 'description',
  emailProperty: 'email',
  phoneProperty: 'phone',
  mobileProperty: 'mobile',

  countryProperty: 'country',
  stateProperty: 'state',
  cityProperty: 'city',
  capitalProperty: 'capital',
  statesProperty: 'states',
  citiesProperty: 'cities',

  geoLocationProperty: 'geoLocation',
  addressProperty: 'address',
  websiteProperty: 'website',
  ratingProperty: 'rating',
  visitedProperty: 'visited',
  lastVisitProperty: 'lastVisit',
  createdProperty: 'created',
  modifiedProperty: 'modified',

  departureProperty: 'departure',
  returnProperty: 'return',
  travelTypeProperty: 'travelType',
  travelStatusProperty: 'travelStatus',
  reviewStatusProperty: 'reviewStatus',

  tripSubtitleProperty: 'subtitle',
  imageProperty: 'image',
  tripHighlightsProperty: 'highlights',
  tripGalleryProperty: 'gallery',
  galleryImageField: 'image',
  galleryCaptionField: 'caption',
  tripCitiesProperty: 'cities',
  personsProperty: 'persons',

  stopsProperty: 'stops',
  tripDaysProperty: 'days',
  dayNumberField: 'day',
  dayTitleField: 'title',
  dayNoteField: 'note',
  stopDayField: 'day',
  stopPlaceField: 'place',
  stopFromField: 'from',
  stopToField: 'to',
  stopNoteField: 'note',
  stopMotifField: 'motif',
  stopRatingField: 'rating',
  stopCostField: 'cost',
  stopCurrencyField: 'currency',
  stopCostUnitField: 'costUnit',
  stopPersonsField: 'persons',

  nightsProperty: 'nights',
  nightCheckInDayField: 'checkInDay',
  nightCheckOutDayField: 'checkOutDay',
  nightAccommodationField: 'accommodation',
  nightCheckInField: 'checkIn',
  nightCheckOutField: 'checkOut',
  nightCostField: 'cost',
  nightCurrencyField: 'currency',
  nightCostUnitField: 'costUnit',
  nightPersonsField: 'persons',

  transportProperty: 'transport',
  legDirectionField: 'direction',
  legDayField: 'day',
  legToDayField: 'toDay',
  legCarrierField: 'carrier',
  legModeField: 'mode',
  legFromField: 'from',
  legToField: 'to',
  legReferenceField: 'reference',
  legOriginField: 'origin',
  legDestinationField: 'destination',
  legCostField: 'cost',
  legCurrencyField: 'currency',
  legCostUnitField: 'costUnit',
  legPersonsField: 'persons',

  timezoneProperty: 'timezone',
  openingHoursProperty: 'openingHours',
  entryFeeProperty: 'entryFee',
  accessibilityProperty: 'accessibility',
  parkingProperty: 'parking',

  transitProperty: 'transit',
  transitModeField: 'mode',
  transitDetailField: 'detail',

  motifsProperty: 'motifs',
  motifNameField: 'name',
  motifRoleField: 'role',
  motifGeoField: 'geoLocation',
  motifDirectionField: 'direction',
  motifLightField: 'light',
  motifSeasonField: 'season',
  motifLensField: 'lens',
  motifGearField: 'gear',
  motifTechniqueField: 'technique',
  motifNoteField: 'note',
  motifCapturedField: 'captured',
  motifCapturedOnField: 'capturedOn',

  sunTimesEnabled: true,

  // Follow Obsidian, render times the way the locale does, and measure in
  // kilometres until somebody says otherwise. Only the last of the three is
  // a guess rather than a deferral, and it is the one a single row changes.
  bookingTripProperty: 'trip',
  bookingCategoryProperty: 'category',
  bookingStatusProperty: 'status',
  bookingSupplierProperty: 'supplier',
  bookingPlaceProperty: 'place',
  bookingDateProperty: 'date',
  bookingAmountProperty: 'amount',
  bookingCurrencyProperty: 'currency',
  bookingReferenceProperty: 'reference',
  bookingPayerProperty: 'payer',
  bookingForProperty: 'for',
  bookingDocumentProperty: 'document',

  tripCurrencyProperty: 'currency',
  budgetProperty: 'budget',
  budgetCategoryField: 'category',
  budgetAmountField: 'amount',
  ratesProperty: 'rates',
  rateCurrencyField: 'currency',
  rateValueField: 'rate',

  displayLocale: DISPLAY_CONTRACT.displayLocale,
  homeCurrency: 'CHF',
  currencyOptions: 'CHF, EUR, USD',
  budgetEnabled: true,

  language: 'auto',
  clockFormat: 'auto',
  units: 'metric',

  samplesProperty: 'samples',
  sampleImageField: 'image',
  sampleMotifField: 'motif',
  sampleLightField: 'light',
  sampleExposureField: 'exposure',
  sampleCreditField: 'credit',
};

export type FolderDefaultKey =
  | 'rootFolder'
  | 'tripsFolder'
  | 'bookingsFolder'
  | 'placesFolder'
  | 'countriesFolder'
  | 'statesFolder'
  | 'citiesFolder'
  | 'accommodationFolder'
  | 'fnbFolder'
  | 'landmarksFolder'
  | 'locationsFolder'
  | 'photoSpotsFolder'
  | 'crmFolder'
  | 'personsFolder'
  | 'companiesFolder';

export type FolderDefaults = Record<FolderDefaultKey, string>;

/** The three module roots a vault can move independently; everything else hangs off one of them. */
export interface SavedFolderRoots {
  rootFolder?: string;
  tripsFolder?: string;
  placesFolder?: string;
  crmFolder?: string;
}

/**
 * Folder defaults resolved through the active locale, so a German-locale
 * install starts at "Orte/Länder" rather than a stray English tree sitting
 * next to an already-localized vault.
 *
 * Every folder is derived from one of the three module roots rather than
 * being its own independent literal -- that is what keeps each module
 * relocatable as a unit. Falls back to the English literals above when the
 * I18n manager is not initialized yet, which is the case in unit tests and
 * during the very first moments of plugin load.
 *
 * The saved roots are handed in so a vault that already moved its tree gets
 * any sub-folder setting added LATER under THAT root instead of under the
 * pristine default. The saved root is the vault owner's answer to "where
 * does this module live", and it applies to every sub-folder, including
 * ones that did not exist when they answered.
 */
export function getLocalizedFolderDefaults(saved: SavedFolderRoots = {}): FolderDefaults {
  const fallback: FolderDefaults = {
    rootFolder: DEFAULT_SETTINGS.rootFolder,
    tripsFolder: DEFAULT_SETTINGS.tripsFolder,
    bookingsFolder: DEFAULT_SETTINGS.bookingsFolder,
    placesFolder: DEFAULT_SETTINGS.placesFolder,
    countriesFolder: DEFAULT_SETTINGS.countriesFolder,
    statesFolder: DEFAULT_SETTINGS.statesFolder,
    citiesFolder: DEFAULT_SETTINGS.citiesFolder,
    accommodationFolder: DEFAULT_SETTINGS.accommodationFolder,
    fnbFolder: DEFAULT_SETTINGS.fnbFolder,
    landmarksFolder: DEFAULT_SETTINGS.landmarksFolder,
    locationsFolder: DEFAULT_SETTINGS.locationsFolder,
    photoSpotsFolder: DEFAULT_SETTINGS.photoSpotsFolder,
    crmFolder: DEFAULT_SETTINGS.crmFolder,
    personsFolder: DEFAULT_SETTINGS.personsFolder,
    companiesFolder: DEFAULT_SETTINGS.companiesFolder,
  };

  let localized: FolderDefaults;
  try {
    I18nManager.getInstance();
    const rootFolder = (saved.rootFolder ?? t('settings.folders.defaults.rootFolderPath')).trim();
    const tripsFolder =
      saved.tripsFolder?.trim() ||
      joinFolder(rootFolder, t('settings.folders.defaults.tripsFolderName'));
    const placesFolder =
      saved.placesFolder?.trim() ||
      joinFolder(rootFolder, t('settings.folders.defaults.placesFolderName'));
    const crmFolder =
      saved.crmFolder?.trim() ||
      joinFolder(rootFolder, t('settings.folders.defaults.crmFolderName'));

    localized = {
      rootFolder,
      tripsFolder,
      // Under the Trips folder, so relocating the Trips module takes its
      // bookings with it. The same derivation the place sub-folders use.
      bookingsFolder: joinFolder(tripsFolder, t('settings.folders.defaults.bookingsFolderName')),
      placesFolder,
      countriesFolder: joinFolder(placesFolder, t('settings.folders.defaults.countriesFolderName')),
      statesFolder: joinFolder(placesFolder, t('settings.folders.defaults.statesFolderName')),
      citiesFolder: joinFolder(placesFolder, t('settings.folders.defaults.citiesFolderName')),
      accommodationFolder: joinFolder(
        placesFolder,
        t('settings.folders.defaults.accommodationFolderName')
      ),
      fnbFolder: joinFolder(placesFolder, t('settings.folders.defaults.fnbFolderName')),
      landmarksFolder: joinFolder(placesFolder, t('settings.folders.defaults.landmarksFolderName')),
      locationsFolder: joinFolder(placesFolder, t('settings.folders.defaults.locationsFolderName')),
      photoSpotsFolder: joinFolder(
        placesFolder,
        t('settings.folders.defaults.photoSpotsFolderName')
      ),
      crmFolder,
      personsFolder: joinFolder(crmFolder, t('settings.folders.defaults.personsFolderName')),
      companiesFolder: joinFolder(crmFolder, t('settings.folders.defaults.companiesFolderName')),
    };
  } catch {
    return resolveFallback(fallback, saved);
  }

  return localized;
}

/**
 * The English-literal path through the same derivation, used when no locale
 * catalogue is loaded. Saved roots still win, so the "a later-added
 * sub-folder lands under the saved root" guarantee holds in unit tests too.
 */
function resolveFallback(fallback: FolderDefaults, saved: SavedFolderRoots): FolderDefaults {
  const rootFolder = (saved.rootFolder ?? '').trim();
  const tripsFolder = saved.tripsFolder?.trim() || joinFolder(rootFolder, 'Trips');
  const placesFolder = saved.placesFolder?.trim() || joinFolder(rootFolder, 'Places');
  const crmFolder = saved.crmFolder?.trim() || joinFolder(rootFolder, 'CRM');

  return {
    ...fallback,
    rootFolder,
    tripsFolder,
    placesFolder,
    countriesFolder: joinFolder(placesFolder, 'Countries'),
    statesFolder: joinFolder(placesFolder, 'States'),
    citiesFolder: joinFolder(placesFolder, 'Cities'),
    accommodationFolder: joinFolder(placesFolder, 'Accommodation'),
    fnbFolder: joinFolder(placesFolder, 'Food & Beverages'),
    landmarksFolder: joinFolder(placesFolder, 'Landmarks'),
    locationsFolder: joinFolder(placesFolder, 'Locations'),
    photoSpotsFolder: joinFolder(placesFolder, 'Photo Spots'),
    crmFolder,
    personsFolder: joinFolder(crmFolder, 'People'),
    companiesFolder: joinFolder(crmFolder, 'Companies'),
  };
}
