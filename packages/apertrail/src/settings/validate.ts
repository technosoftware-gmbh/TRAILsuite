/**
 * Turns raw plugin data (whatever is in data.json, which a user can hand
 * edit) into a fully typed APERtrailSettings, filling in defaults for
 * anything missing or of the wrong type. Every field goes through a
 * validator so no corrupt value ever reaches the UI.
 */
import { APERtrailSettings } from './types';
import { CLOCK_FORMATS, ClockFormat } from '../shared/clock';
import { UNIT_SYSTEMS, UnitSystem } from '../shared/units';
import { DEFAULT_SETTINGS, getLocalizedFolderDefaults } from './defaults';

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return !!val && typeof val === 'object' && !Array.isArray(val);
}

function str(val: unknown, fallback: string): string {
  return typeof val === 'string' ? val : fallback;
}

function bool(val: unknown, fallback: boolean): boolean {
  return typeof val === 'boolean' ? val : fallback;
}

/** A value from a fixed vocabulary, falling back rather than trusting whatever data.json holds. */
function oneOf<T extends string>(val: unknown, allowed: readonly T[], fallback: T): T {
  return typeof val === 'string' && (allowed as readonly string[]).includes(val)
    ? (val as T)
    : fallback;
}

export function mergeSettings(raw: unknown): APERtrailSettings {
  const r: Record<string, unknown> = isPlainObject(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  // Folder defaults come from the locale-aware resolver rather than
  // DEFAULT_SETTINGS directly, so a first load in a German vault seeds
  // German folder names instead of English ones that would then have to be
  // renamed by hand.
  //
  // The saved module roots are handed in so a vault that relocated its
  // Trips/Places/CRM tree gets any newly-added sub-folder under THOSE roots
  // rather than under the pristine defaults. Only the folder NAME still
  // comes from the locale: the plugin cannot know which language a vault
  // names its folders in, and guessing from a saved root would mean
  // parsing it.
  const f = getLocalizedFolderDefaults({
    rootFolder: typeof r.rootFolder === 'string' ? r.rootFolder : undefined,
    tripsFolder: typeof r.tripsFolder === 'string' ? r.tripsFolder : undefined,
    placesFolder: typeof r.placesFolder === 'string' ? r.placesFolder : undefined,
    crmFolder: typeof r.crmFolder === 'string' ? r.crmFolder : undefined,
  });

  return {
    rootFolder: str(r.rootFolder, f.rootFolder),

    tripsFolder: str(r.tripsFolder, f.tripsFolder),
    bookingsFolder: str(r.bookingsFolder, f.bookingsFolder),
    tripBookingsSubfolder: str(r.tripBookingsSubfolder, d.tripBookingsSubfolder),
    tripExportsSubfolder: str(r.tripExportsSubfolder, d.tripExportsSubfolder),

    placesFolder: str(r.placesFolder, f.placesFolder),
    countriesFolder: str(r.countriesFolder, f.countriesFolder),
    statesFolder: str(r.statesFolder, f.statesFolder),
    citiesFolder: str(r.citiesFolder, f.citiesFolder),
    accommodationFolder: str(r.accommodationFolder, f.accommodationFolder),
    fnbFolder: str(r.fnbFolder, f.fnbFolder),
    landmarksFolder: str(r.landmarksFolder, f.landmarksFolder),
    locationsFolder: str(r.locationsFolder, f.locationsFolder),
    photoSpotsFolder: str(r.photoSpotsFolder, f.photoSpotsFolder),

    crmFolder: str(r.crmFolder, f.crmFolder),

    typePropertyName: str(r.typePropertyName, d.typePropertyName),
    showRibbonIcon: bool(r.showRibbonIcon, d.showRibbonIcon),
    // Read back like any other toggle rather than forced off on load: a
    // settings page left open across a reload should not re-lock under the
    // cursor half way through a rename.
    unlockPropertyNames: bool(r.unlockPropertyNames, d.unlockPropertyNames),

    personsFolder: str(r.personsFolder, f.personsFolder),
    personTypeValue: str(r.personTypeValue, d.personTypeValue),
    personTagProperty: str(r.personTagProperty, d.personTagProperty),
    eligiblePersonTags: str(r.eligiblePersonTags, d.eligiblePersonTags),
    companiesFolder: str(r.companiesFolder, f.companiesFolder),
    companyTypeValue: str(r.companyTypeValue, d.companyTypeValue),
    companyTagProperty: str(r.companyTagProperty, d.companyTagProperty),
    personRolesProperty: str(r.personRolesProperty, d.personRolesProperty),
    companyRolesProperty: str(r.companyRolesProperty, d.companyRolesProperty),

    descriptionProperty: str(r.descriptionProperty, d.descriptionProperty),
    emailProperty: str(r.emailProperty, d.emailProperty),
    phoneProperty: str(r.phoneProperty, d.phoneProperty),
    mobileProperty: str(r.mobileProperty, d.mobileProperty),

    countryProperty: str(r.countryProperty, d.countryProperty),
    stateProperty: str(r.stateProperty, d.stateProperty),
    cityProperty: str(r.cityProperty, d.cityProperty),
    capitalProperty: str(r.capitalProperty, d.capitalProperty),
    statesProperty: str(r.statesProperty, d.statesProperty),
    citiesProperty: str(r.citiesProperty, d.citiesProperty),

    geoLocationProperty: str(r.geoLocationProperty, d.geoLocationProperty),
    addressProperty: str(r.addressProperty, d.addressProperty),
    websiteProperty: str(r.websiteProperty, d.websiteProperty),
    ratingProperty: str(r.ratingProperty, d.ratingProperty),
    visitedProperty: str(r.visitedProperty, d.visitedProperty),
    lastVisitProperty: str(r.lastVisitProperty, d.lastVisitProperty),
    createdProperty: str(r.createdProperty, d.createdProperty),
    modifiedProperty: str(r.modifiedProperty, d.modifiedProperty),

    departureProperty: str(r.departureProperty, d.departureProperty),
    returnProperty: str(r.returnProperty, d.returnProperty),
    travelTypeProperty: str(r.travelTypeProperty, d.travelTypeProperty),
    travelStatusProperty: str(r.travelStatusProperty, d.travelStatusProperty),
    reviewStatusProperty: str(r.reviewStatusProperty, d.reviewStatusProperty),

    tripSubtitleProperty: str(r.tripSubtitleProperty, d.tripSubtitleProperty),
    imageProperty: str(r.imageProperty, d.imageProperty),
    tripHighlightsProperty: str(r.tripHighlightsProperty, d.tripHighlightsProperty),
    tripGalleryProperty: str(r.tripGalleryProperty, d.tripGalleryProperty),
    galleryImageField: str(r.galleryImageField, d.galleryImageField),
    galleryCaptionField: str(r.galleryCaptionField, d.galleryCaptionField),

    tripCitiesProperty: str(r.tripCitiesProperty, d.tripCitiesProperty),
    personsProperty: str(r.personsProperty, d.personsProperty),

    stopsProperty: str(r.stopsProperty, d.stopsProperty),
    tripDaysProperty: str(r.tripDaysProperty, d.tripDaysProperty),
    dayNumberField: str(r.dayNumberField, d.dayNumberField),
    dayTitleField: str(r.dayTitleField, d.dayTitleField),
    dayNoteField: str(r.dayNoteField, d.dayNoteField),
    stopDayField: str(r.stopDayField, d.stopDayField),
    stopPlaceField: str(r.stopPlaceField, d.stopPlaceField),
    stopFromField: str(r.stopFromField, d.stopFromField),
    stopToField: str(r.stopToField, d.stopToField),
    stopNoteField: str(r.stopNoteField, d.stopNoteField),
    stopMotifField: str(r.stopMotifField, d.stopMotifField),
    stopRatingField: str(r.stopRatingField, d.stopRatingField),
    stopCostField: str(r.stopCostField, d.stopCostField),
    stopCurrencyField: str(r.stopCurrencyField, d.stopCurrencyField),
    stopCostUnitField: str(r.stopCostUnitField, d.stopCostUnitField),
    stopPersonsField: str(r.stopPersonsField, d.stopPersonsField),

    nightsProperty: str(r.nightsProperty, d.nightsProperty),
    nightCheckInDayField: str(r.nightCheckInDayField, d.nightCheckInDayField),
    nightCheckOutDayField: str(r.nightCheckOutDayField, d.nightCheckOutDayField),
    nightAccommodationField: str(r.nightAccommodationField, d.nightAccommodationField),
    nightCheckInField: str(r.nightCheckInField, d.nightCheckInField),
    nightCheckOutField: str(r.nightCheckOutField, d.nightCheckOutField),
    nightCostField: str(r.nightCostField, d.nightCostField),
    nightCurrencyField: str(r.nightCurrencyField, d.nightCurrencyField),
    nightCostUnitField: str(r.nightCostUnitField, d.nightCostUnitField),
    nightPersonsField: str(r.nightPersonsField, d.nightPersonsField),

    // `f` and not `d`, like every other folder: a vault that renamed its
    // Places root gets a folder ADDED later under that root rather than under
    // the pristine English default. Written as `d` first, which would have put
    // "Places/Vehicles" beside an existing "Plätze".
    vehiclesFolder: str(r.vehiclesFolder, f.vehiclesFolder),
    vehicleModeProperty: str(r.vehicleModeProperty, d.vehicleModeProperty),
    vehicleOperatorProperty: str(r.vehicleOperatorProperty, d.vehicleOperatorProperty),
    vehicleBuiltProperty: str(r.vehicleBuiltProperty, d.vehicleBuiltProperty),
    vehicleRefurbishedProperty: str(r.vehicleRefurbishedProperty, d.vehicleRefurbishedProperty),
    vehicleCapacityProperty: str(r.vehicleCapacityProperty, d.vehicleCapacityProperty),
    vehicleLengthProperty: str(r.vehicleLengthProperty, d.vehicleLengthProperty),
    vehicleTonnageProperty: str(r.vehicleTonnageProperty, d.vehicleTonnageProperty),
    vehicleCabinsProperty: str(r.vehicleCabinsProperty, d.vehicleCabinsProperty),
    cabinNameField: str(r.cabinNameField, d.cabinNameField),
    cabinDescriptionField: str(r.cabinDescriptionField, d.cabinDescriptionField),

    transportProperty: str(r.transportProperty, d.transportProperty),
    legDirectionField: str(r.legDirectionField, d.legDirectionField),
    legDayField: str(r.legDayField, d.legDayField),
    legToDayField: str(r.legToDayField, d.legToDayField),
    legCarrierField: str(r.legCarrierField, d.legCarrierField),
    legModeField: str(r.legModeField, d.legModeField),
    legFromField: str(r.legFromField, d.legFromField),
    legToField: str(r.legToField, d.legToField),
    legReferenceField: str(r.legReferenceField, d.legReferenceField),
    legOriginField: str(r.legOriginField, d.legOriginField),
    legDestinationField: str(r.legDestinationField, d.legDestinationField),
    legCostField: str(r.legCostField, d.legCostField),
    legCurrencyField: str(r.legCurrencyField, d.legCurrencyField),
    legCostUnitField: str(r.legCostUnitField, d.legCostUnitField),
    legPersonsField: str(r.legPersonsField, d.legPersonsField),
    legVehicleField: str(r.legVehicleField, d.legVehicleField),
    stopVariantsField: str(r.stopVariantsField, d.stopVariantsField),
    nightVariantsField: str(r.nightVariantsField, d.nightVariantsField),
    legVariantsField: str(r.legVariantsField, d.legVariantsField),
    variantNameField: str(r.variantNameField, d.variantNameField),
    variantDescriptionField: str(r.variantDescriptionField, d.variantDescriptionField),
    variantCostField: str(r.variantCostField, d.variantCostField),
    variantCurrencyField: str(r.variantCurrencyField, d.variantCurrencyField),
    variantCostUnitField: str(r.variantCostUnitField, d.variantCostUnitField),
    variantChosenField: str(r.variantChosenField, d.variantChosenField),
    stopOptionalField: str(r.stopOptionalField, d.stopOptionalField),
    nightOptionalField: str(r.nightOptionalField, d.nightOptionalField),
    legOptionalField: str(r.legOptionalField, d.legOptionalField),
    stopChosenField: str(r.stopChosenField, d.stopChosenField),
    nightChosenField: str(r.nightChosenField, d.nightChosenField),
    legChosenField: str(r.legChosenField, d.legChosenField),

    timezoneProperty: str(r.timezoneProperty, d.timezoneProperty),
    openingHoursProperty: str(r.openingHoursProperty, d.openingHoursProperty),
    entryFeeProperty: str(r.entryFeeProperty, d.entryFeeProperty),
    accessibilityProperty: str(r.accessibilityProperty, d.accessibilityProperty),
    parkingProperty: str(r.parkingProperty, d.parkingProperty),

    transitProperty: str(r.transitProperty, d.transitProperty),
    transitModeField: str(r.transitModeField, d.transitModeField),
    transitDetailField: str(r.transitDetailField, d.transitDetailField),

    motifsProperty: str(r.motifsProperty, d.motifsProperty),
    motifNameField: str(r.motifNameField, d.motifNameField),
    motifRoleField: str(r.motifRoleField, d.motifRoleField),
    motifGeoField: str(r.motifGeoField, d.motifGeoField),
    motifDirectionField: str(r.motifDirectionField, d.motifDirectionField),
    motifLightField: str(r.motifLightField, d.motifLightField),
    motifSeasonField: str(r.motifSeasonField, d.motifSeasonField),
    motifLensField: str(r.motifLensField, d.motifLensField),
    motifGearField: str(r.motifGearField, d.motifGearField),
    motifTechniqueField: str(r.motifTechniqueField, d.motifTechniqueField),
    motifNoteField: str(r.motifNoteField, d.motifNoteField),
    motifCapturedField: str(r.motifCapturedField, d.motifCapturedField),
    motifCapturedOnField: str(r.motifCapturedOnField, d.motifCapturedOnField),

    sunTimesEnabled: bool(r.sunTimesEnabled, d.sunTimesEnabled),

    // The language is NOT checked against the registry here: an unknown
    // code resolves to English at lookup time, and clearing the saved value
    // would lose a preference the moment a locale is temporarily absent.
    bookingTripProperty: str(r.bookingTripProperty, d.bookingTripProperty),
    bookingCategoryProperty: str(r.bookingCategoryProperty, d.bookingCategoryProperty),
    bookingStatusProperty: str(r.bookingStatusProperty, d.bookingStatusProperty),
    bookingSupplierProperty: str(r.bookingSupplierProperty, d.bookingSupplierProperty),
    bookingPlaceProperty: str(r.bookingPlaceProperty, d.bookingPlaceProperty),
    bookingDateProperty: str(r.bookingDateProperty, d.bookingDateProperty),
    bookingAmountProperty: str(r.bookingAmountProperty, d.bookingAmountProperty),
    bookingCurrencyProperty: str(r.bookingCurrencyProperty, d.bookingCurrencyProperty),
    bookingReferenceProperty: str(r.bookingReferenceProperty, d.bookingReferenceProperty),
    bookingPayerProperty: str(r.bookingPayerProperty, d.bookingPayerProperty),
    bookingForProperty: str(r.bookingForProperty, d.bookingForProperty),
    bookingDocumentProperty: str(r.bookingDocumentProperty, d.bookingDocumentProperty),

    tripCurrencyProperty: str(r.tripCurrencyProperty, d.tripCurrencyProperty),
    budgetProperty: str(r.budgetProperty, d.budgetProperty),
    budgetCategoryField: str(r.budgetCategoryField, d.budgetCategoryField),
    budgetAmountField: str(r.budgetAmountField, d.budgetAmountField),
    ratesProperty: str(r.ratesProperty, d.ratesProperty),
    rateCurrencyField: str(r.rateCurrencyField, d.rateCurrencyField),
    rateValueField: str(r.rateValueField, d.rateValueField),

    // Not validated against a list of tags: Intl accepts more than any list
    // here could carry, and a tag it rejects falls back rather than throwing, so
    // a typo costs a convention and never costs a figure.
    displayLocale: str(r.displayLocale, d.displayLocale),
    homeCurrency: str(r.homeCurrency, d.homeCurrency),
    currencyOptions: str(r.currencyOptions, d.currencyOptions),
    budgetEnabled: bool(r.budgetEnabled, d.budgetEnabled),

    language: str(r.language, d.language),
    clockFormat: oneOf<ClockFormat>(r.clockFormat, CLOCK_FORMATS, d.clockFormat),
    units: oneOf<UnitSystem>(r.units, UNIT_SYSTEMS, d.units),

    samplesProperty: str(r.samplesProperty, d.samplesProperty),
    sampleImageField: str(r.sampleImageField, d.sampleImageField),
    sampleMotifField: str(r.sampleMotifField, d.sampleMotifField),
    sampleLightField: str(r.sampleLightField, d.sampleLightField),
    sampleExposureField: str(r.sampleExposureField, d.sampleExposureField),
    sampleCreditField: str(r.sampleCreditField, d.sampleCreditField),
  };
}
